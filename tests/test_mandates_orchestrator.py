"""
Unit & Scheme Compliance Tests for Mandate Orchestrator & Rule-Pack Engine
"""

import pytest
from orchestrator.mandate_orchestrator import (
    PaymentRail,
    MandateStatus,
    DebitFailureCategory,
    MandateRootCause,
    RAIL_RULE_PACKS,
    normalize_bank_return_reason,
    evaluate_mandate_debit_attempt,
    get_mandate_portfolio_summary,
)
from orchestrator.tools.merchant_tools import (
    get_mandate_portfolio_health,
    simulate_mandate_rail_decision,
    trigger_mandate_renewal_flow,
    dispatch_afa_pre_debit_notification,
)


def test_rail_rule_packs_structure():
    """Verify all 4 core payment rails have declared regulatory rule-packs."""
    assert PaymentRail.UPI_AUTOPAY in RAIL_RULE_PACKS
    assert PaymentRail.ENACH in RAIL_RULE_PACKS
    assert PaymentRail.BACS_DIRECT_DEBIT in RAIL_RULE_PACKS
    assert PaymentRail.SEPA_CORE in RAIL_RULE_PACKS

    upi_pack = RAIL_RULE_PACKS[PaymentRail.UPI_AUTOPAY]
    assert upi_pack.max_retry_count_per_cycle == 2
    assert upi_pack.afa_threshold_amount_inr == 15000.0
    assert upi_pack.cooldown_period_hours == 24

    enach_pack = RAIL_RULE_PACKS[PaymentRail.ENACH]
    assert enach_pack.max_retry_count_per_cycle == 3
    assert enach_pack.cooldown_period_hours == 72


def test_bank_return_reason_normalization():
    """Verify raw bank return codes and free text normalize to clean root causes."""
    # R01 -> Insufficient funds
    rc, cat, msg = normalize_bank_return_reason(raw_return_code="R01")
    assert rc == MandateRootCause.INSUFFICIENT_FUNDS_CYCLE
    assert cat == DebitFailureCategory.DEBIT_LEVEL_RETRYABLE

    # MD06 -> Mandate revoked
    rc, cat, msg = normalize_bank_return_reason(raw_return_code="MD06")
    assert rc == MandateRootCause.MANDATE_REVOKED_BY_PAYER
    assert cat == DebitFailureCategory.MANDATE_LEVEL_BROKEN

    # MD01 -> Mandate expired
    rc, cat, msg = normalize_bank_return_reason(raw_return_code="MD01")
    assert rc == MandateRootCause.MANDATE_EXPIRED
    assert cat == DebitFailureCategory.MANDATE_LEVEL_BROKEN

    # Free text matching
    rc, cat, msg = normalize_bank_return_reason(raw_error_message="Customer revoked standing order in mobile app")
    assert rc == MandateRootCause.MANDATE_REVOKED_BY_PAYER


def test_afa_threshold_breach_blocks_silent_retry():
    """
    CRITICAL DEMO BEAT:
    Debits > ₹15,000 on UPI Autopay must REFUSE silent retries and trigger active AFA prompts.
    """
    decision = evaluate_mandate_debit_attempt(
        mandate_id="man_upi_9821",
        rail=PaymentRail.UPI_AUTOPAY,
        amount_inr=24500.0,
        current_cycle_failures=1,
        mandate_status=MandateStatus.ACTIVE,
        raw_error_message="U30 - AFA authentication required for transaction above threshold",
        customer_name="Priya Sharma",
    )

    assert decision.is_silent_retry_allowed is False
    assert decision.afa_prompt_required is True
    assert decision.failure_category == DebitFailureCategory.AFA_AUTHORIZATION_REQUIRED
    assert decision.root_cause == MandateRootCause.RBI_AFA_AUTH_REQUIRED_ABOVE_THRESHOLD
    assert "₹15,000 RBI AFA limit" in decision.plain_english_rationale
    assert "Pre-Debit" in decision.recommended_action


def test_expired_mandate_requires_reregistration():
    """
    CRITICAL DEMO BEAT:
    Expired mandates must NOT waste debit retries; must route to proactive re-registration.
    """
    decision = evaluate_mandate_debit_attempt(
        mandate_id="man_enach_0411",
        rail=PaymentRail.ENACH,
        amount_inr=4999.0,
        current_cycle_failures=1,
        mandate_status=MandateStatus.EXPIRED,
        customer_name="Aditi Chawla",
    )

    assert decision.is_silent_retry_allowed is False
    assert decision.is_hard_compliance_stop is True
    assert decision.proactive_renewal_required is True
    assert decision.root_cause == MandateRootCause.MANDATE_EXPIRED
    assert "Re-Registration" in decision.one_click_action_label


def test_revoked_mandate_hard_compliance_stop():
    """Revoked mandate triggers immediate compliance halt (zero dunning/outreach)."""
    decision = evaluate_mandate_debit_attempt(
        mandate_id="man_upi_1122",
        rail=PaymentRail.UPI_AUTOPAY,
        amount_inr=999.0,
        current_cycle_failures=1,
        mandate_status=MandateStatus.REVOKED_BY_PAYER,
        customer_name="Vikram Singh",
    )

    assert decision.is_silent_retry_allowed is False
    assert decision.is_hard_compliance_stop is True
    assert decision.proactive_renewal_required is False
    assert decision.root_cause == MandateRootCause.MANDATE_REVOKED_BY_PAYER
    assert "Stop Dunning" in decision.one_click_action_label


def test_healthy_mandate_enforces_scheme_cooldown():
    """Healthy mandate with temporary balance delay enforces 72h cooldown on eNACH."""
    decision = evaluate_mandate_debit_attempt(
        mandate_id="man_enach_7712",
        rail=PaymentRail.ENACH,
        amount_inr=2499.0,
        current_cycle_failures=1,
        mandate_status=MandateStatus.ACTIVE,
        raw_return_code="R01",
        customer_name="Rohan Gupta",
    )

    assert decision.is_silent_retry_allowed is True
    assert decision.cooldown_hours_enforced == 72
    assert decision.current_cycle_attempt == 2
    assert decision.max_allowed_attempts == 3
    assert "72h" in decision.recommended_action


def test_retry_cap_exceeded_blocks_bounce_penalty():
    """When cycle attempts reach max limit, further automatic representments are blocked."""
    decision = evaluate_mandate_debit_attempt(
        mandate_id="man_enach_7712",
        rail=PaymentRail.ENACH,
        amount_inr=2499.0,
        current_cycle_failures=3,  # Reached max 3 for eNACH
        mandate_status=MandateStatus.ACTIVE,
        raw_return_code="R01",
    )

    assert decision.is_silent_retry_allowed is False
    assert decision.is_hard_compliance_stop is True
    assert decision.root_cause == MandateRootCause.RETRY_COUNT_EXCEEDED_SCHEME_CAP


def test_mandate_tools_execution():
    """Verify tool execution via registry tools."""
    summary = get_mandate_portfolio_health("merch_01")
    assert "total_active_mandates" in summary
    assert summary["compliance_rate_pct"] == 100.0
    assert len(summary["bank_registration_matrix"]) == 4

    sim_res = simulate_mandate_rail_decision(
        rail="upi_autopay",
        amount=24500.0,
        failure_reason="AFA authentication required",
    )
    assert sim_res["afa_prompt_required"] is True
    assert sim_res["is_silent_retry_allowed"] is False

    renewal_res = trigger_mandate_renewal_flow("man_001", "Priya Sharma")
    assert renewal_res["status"] == "renewal_link_dispatched"

    afa_res = dispatch_afa_pre_debit_notification("man_002", 18500.0, "Priya Sharma")
    assert afa_res["status"] == "afa_prompt_dispatched"
