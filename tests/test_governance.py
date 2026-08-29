"""
Unit Tests for Governance, Omnichannel Consent Registry, Cross-Track Throttling, and PII Sanitization
"""

import pytest
from datetime import datetime, timezone, timedelta
from orchestrator.governance import (
    CrossTrackThrottler,
    OmnichannelConsentRegistry,
    sanitize_pii_for_llm,
    mask_phone_for_display,
    OutcomeLearningFlywheel,
    MAX_CROSS_TRACK_WEEKLY_CONTACTS,
)
from orchestrator.nodes.guardrails import check_guardrails


def test_pii_sanitizer_redacts_sensitive_tokens():
    """Verify that card numbers, mobile phones, emails, PANs, and IFSCs are sanitized."""
    raw_prompt = (
        "Customer Aarav Sharma (Phone: +91 9876543210, Email: aarav.sharma@example.com) "
        "attempted paying with card 4111-2222-3333-4444. PAN: ABCDE1234F, IFSC: HDFC0001234."
    )
    sanitized = sanitize_pii_for_llm(raw_prompt)

    assert "[PHONE_MASKED]" in sanitized
    assert "9876543210" not in sanitized
    assert "[EMAIL_REDACTED]" in sanitized
    assert "aarav.sharma@example.com" not in sanitized
    assert "[CARD_REDACTED]" in sanitized
    assert "4111-2222-3333-4444" not in sanitized
    assert "[PAN_REDACTED]" in sanitized
    assert "ABCDE1234F" not in sanitized
    assert "[IFSC_REDACTED]" in sanitized
    assert "HDFC0001234" not in sanitized


def test_phone_masking_for_display():
    """Verify clean display masking on phone numbers."""
    masked = mask_phone_for_display("+919876543210")
    assert "98*** **210" in masked or "98***" in masked


def test_cross_track_contact_throttler():
    """Verify cross-track throttling prevents excessive touches across different workflows."""
    cid = "cust_throttled_99"

    # Touch 1: Subscriptions track (6 days ago)
    t1 = datetime.now(timezone.utc) - timedelta(days=6)
    CrossTrackThrottler.record_touch(cid, "whatsapp", "subscriptions", "evt_1", timestamp=t1)

    # Touch 2: B2B Receivables track (4 days ago)
    t2 = datetime.now(timezone.utc) - timedelta(days=4)
    CrossTrackThrottler.record_touch(cid, "email", "b2b_receivables", "evt_2", timestamp=t2)

    # Touch 3: Checkout Funnel track (2 days ago)
    t3 = datetime.now(timezone.utc) - timedelta(days=2)
    CrossTrackThrottler.record_touch(cid, "whatsapp", "checkout_funnel", "evt_3", timestamp=t3)

    # 4th Touch: Proposed on Voice track -> MUST BE BLOCKED
    permitted, reason = CrossTrackThrottler.evaluate_outreach_permission(cid, "voice", "voice_track", "evt_4")
    assert permitted is False
    assert "CROSS_TRACK_THROTTLE_BLOCK" in reason


def test_omnichannel_consent_registry_propagation():
    """Verify that an opt-out on one channel blocks all tracks in guardrails."""
    cid = "cust_dnd_test_01"
    OmnichannelConsentRegistry.register_opt_out(cid, "whatsapp", "User sent STOP keyword")

    state = {
        "event_id": "evt_test_consent",
        "customer_id": cid,
        "amount": 4999.0,
        "root_cause": "subscription_failed",
        "chosen_action": {"target_channel": "email"},
        "metadata": {},
        "history": {},
    }

    res = check_guardrails(state)
    assert res["guardrail_result"] == "BLOCK"
    assert res["guardrail_rule_fired"] == "RULE_OPT_OUT_ENFORCED"


def test_outcome_learning_flywheel():
    """Verify feedback loop increments trials and updates leaderboard."""
    playbook = "technical_form_friction"
    res = OutcomeLearningFlywheel.record_outcome(playbook, "recovered", "cust_01", 4999.0)
    assert res["conversion_rate_pct"] > 0

    leaderboard = OutcomeLearningFlywheel.get_playbook_leaderboard()
    assert len(leaderboard) >= 5
    assert all("conversion_rate_pct" in item for item in leaderboard)
