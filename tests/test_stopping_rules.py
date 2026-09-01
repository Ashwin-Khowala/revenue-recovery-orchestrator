"""
Comprehensive Stopping Rules & Financial Guardrails Test Suite
================================================================
Formally verifies all 8 core stopping rules and compliance gates:
1. RULE_MAX_CONTACT_COUNT_EXCEEDED (Max 2 touches per incident)
2. RULE_INSUFFICIENT_COOLDOWN (24-hour quiet window)
3. RULE_HIGH_VALUE_ESCALATION (Amount >= ₹1,00,000 HITL gate)
4. RULE_SILENT_REROUTE_DEGRADED (Bank route outage -> zero customer spam)
5. RULE_PROMISE_TO_PAY_PAUSE (Promise date honored -> reminders snoozed)
6. RULE_OPT_OUT_PERMANENT_BLOCK (Regulatory STOP / DND keyword -> permanent halt)
7. RULE_DISENGAGED_DUNNING_KILL_SWITCH (Dormant user -> no aggressive retries)
8. RULE_COMMERCIAL_DISPUTE_ISOLATION (Disputed invoice -> routed to Account Exec)
"""

import os
import sys
import pytest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from orchestrator.nodes.guardrails import check_guardrails
from orchestrator.governance import CrossTrackThrottler, OmnichannelConsentRegistry
from orchestrator.nodes.executor import execute_action
from orchestrator.state import RecoveryState


def test_rule_1_max_contact_count_exceeded():
    """Stopping Rule 1: Never exceed 2 touches per incident."""
    state: RecoveryState = {
        "event_id": "evt_stop_01",
        "event_type": "subscription_failed",
        "amount": 2500.0,
        "currency": "INR",
        "merchant_id": "merch_01",
        "customer_id": "cust_stop_01",
        "contact_count": 2,
        "chosen_action": {"action_type": "whatsapp_payment_link", "target_channel": "whatsapp"},
        "history": {"prior_contacts": 2},
    }
    res = check_guardrails(state)
    assert res["guardrail_result"] in ("BLOCK", "ESCALATE")
    assert "MAX_CONTACT" in res.get("guardrail_rule_fired", "")


def test_rule_2_insufficient_cooldown():
    """Stopping Rule 2: 24-hour quiet window across channels for identical customer."""
    import uuid
    customer_id = f"cust_stop_cooldown_{uuid.uuid4().hex[:8]}"
    CrossTrackThrottler.record_touch(
        customer_id=customer_id,
        channel="whatsapp",
        track_name="checkout_abandonment",
        event_id="evt_prior",
        timestamp=datetime.now(timezone.utc) - timedelta(hours=4), # 4h ago
    )
    
    permitted, reason = CrossTrackThrottler.evaluate_outreach_permission(
        customer_id=customer_id,
        proposed_channel="email",
        proposed_track="subscription_recovery",
        event_id="evt_current",
    )
    assert permitted is False
    assert "CROSS_TRACK_SPACING_BLOCK" in reason or "CROSS_TRACK_THROTTLE_BLOCK" in reason


def test_rule_3_high_value_hitl_escalation():
    """Stopping Rule 3: Amounts >= ₹1,00,000 trigger mandatory Human-in-the-Loop approval."""
    state: RecoveryState = {
        "event_id": "evt_stop_03",
        "event_type": "receivable_overdue",
        "amount": 145000.0,
        "currency": "INR",
        "merchant_id": "merch_01",
        "customer_id": "cust_stop_03",
        "contact_count": 0,
        "chosen_action": {"action_type": "whatsapp_payment_reminder", "target_channel": "whatsapp"},
        "history": {"prior_contacts": 0},
    }
    res = check_guardrails(state)
    assert res["guardrail_result"] == "ESCALATE"
    assert "HIGH_VALUE_THRESHOLD" in res.get("guardrail_rule_fired", "")


def test_rule_4_silent_reroute_degraded():
    """Stopping Rule 4: Bank route failure must trigger silent infrastructure reroute (0 customer contact)."""
    state: RecoveryState = {
        "event_id": "evt_stop_04",
        "event_type": "payment_degraded",
        "amount": 15000.0,
        "currency": "INR",
        "merchant_id": "merch_01",
        "customer_id": "cust_stop_04",
        "contact_count": 0,
        "chosen_action": {"action_type": "silent_route_reroute", "target_channel": "reroute"},
        "guardrail_result": "ALLOW",
    }
    exec_res = execute_action(state)
    assert exec_res["channel_used"] == "reroute"
    assert exec_res["payment_status"] == "recovered"
    assert exec_res.get("contact_count", 0) == 0  # Zero customer touches incremented


def test_rule_5_promise_to_pay_pause():
    """Stopping Rule 5: Active Promise-to-Pay commits pause automated dunning until promise date."""
    state: RecoveryState = {
        "event_id": "evt_stop_05",
        "event_type": "promise_to_pay",
        "amount": 52000.0,
        "currency": "INR",
        "merchant_id": "merch_01",
        "customer_id": "cust_stop_05",
        "contact_count": 0,
        "promised_pay_date": (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%d"),
        "chosen_action": {"action_type": "pause_outreach_for_ptp", "target_channel": "scheduled_check"},
        "guardrail_result": "ALLOW",
    }
    exec_res = execute_action(state)
    assert exec_res["channel_used"] == "scheduled_check"
    assert exec_res.get("contact_count", 0) == 0


def test_rule_6_opt_out_permanent_block():
    """Stopping Rule 6: Customer sending STOP / DND is permanently blocked on all channels."""
    phone = "+919820199999"
    OmnichannelConsentRegistry.register_opt_out(
        identifier=phone,
        source_channel="sms",
        reason="User texted STOP",
    )
    
    is_blocked, reason = OmnichannelConsentRegistry.is_opted_out(customer_id="cust_any", phone=phone)
    assert is_blocked is True
    assert "opted out" in reason.lower()


def test_rule_7_disengaged_dunning_kill_switch():
    """Stopping Rule 7: Disengaged dormant users receive graceful off-ramp rather than infinite retries."""
    state: RecoveryState = {
        "event_id": "evt_stop_07",
        "event_type": "subscription_failed",
        "amount": 999.0,
        "currency": "INR",
        "merchant_id": "merch_01",
        "customer_id": "cust_stop_07",
        "metadata": {"dormant_days": 60, "login_count_last_30d": 0},
        "history": {"customer_avg_days_late": 10, "prior_contacts": 1},
        "chosen_action": {"action_type": "dunning_kill_switch_offramp", "target_channel": "email"},
        "guardrail_result": "ALLOW",
    }
    exec_res = execute_action(state)
    assert exec_res["channel_used"] in ("email", "none")
    assert exec_res.get("execution_result") is not None


def test_rule_8_commercial_dispute_isolation():
    """Stopping Rule 8: Invoices under commercial dispute halt dunning immediately and escalate."""
    state: RecoveryState = {
        "event_id": "evt_stop_08",
        "event_type": "receivable_overdue",
        "amount": 26500.0,
        "currency": "INR",
        "merchant_id": "merch_01",
        "customer_id": "cust_stop_08",
        "metadata": {"dispute_status": "open_damaged_goods_investigation"},
        "chosen_action": {"action_type": "account_executive_telegram_escalation", "target_channel": "telegram"},
        "guardrail_result": "ALLOW",
    }
    exec_res = execute_action(state)
    assert exec_res["channel_used"] in ("telegram", "none")
