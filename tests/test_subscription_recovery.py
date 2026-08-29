"""
Test Suite: Subscription Lifecycle & Involuntary vs. Voluntary Churn Intelligence
==================================================================================
Validates subscription engagement telemetry diagnosis, behavioral archetype segregation,
enterprise white-glove human escalation, and Dunning Kill Switches.
"""

import pytest
from orchestrator.subscription_recovery import (
    diagnose_subscription_failure,
    SubscriptionLifecycleTelemetry,
    SubscriptionPlanTier,
    SubscriptionArchetype,
)
from orchestrator.nodes.root_cause_classifier import classify_root_cause
from orchestrator.nodes.guardrails import check_guardrails


class TestSubscriptionRecoveryIntelligence:
    """Tests for subscription lifecycle and involuntary vs voluntary churn."""

    def test_engaged_subscriber_involuntary_churn(self):
        telemetry = SubscriptionLifecycleTelemetry(
            tenure_months=8,
            plan_tier=SubscriptionPlanTier.PRO,
            last_login_days_ago=1,  # Active yesterday
            billing_cycle_failure_count=1,
            auto_renew_status="active",
            monthly_amount=1999.0,
            decline_code="insufficient_funds",
        )
        diag = diagnose_subscription_failure(telemetry, customer_name="Aditya")
        assert diag.archetype == SubscriptionArchetype.INVOLUNTARY_CHURN_ENGAGED
        assert diag.requires_hitl_escalation is False
        assert diag.grace_period_days == 14
        assert diag.allow_downgrade_offer is False
        assert "grace period" in diag.suggested_message.lower()

    def test_disengaged_subscriber_voluntary_churn_kill_switch(self):
        """CRITICAL: Verifies that dormant subscribers get an off-ramp, NOT aggressive dunning."""
        telemetry = SubscriptionLifecycleTelemetry(
            tenure_months=6,
            plan_tier=SubscriptionPlanTier.PRO,
            last_login_days_ago=65,  # Inactive for over 2 months
            billing_cycle_failure_count=1,
            auto_renew_status="active",
            monthly_amount=1999.0,
            decline_code="insufficient_funds",
        )
        diag = diagnose_subscription_failure(telemetry, customer_name="Siddharth")
        assert diag.archetype == SubscriptionArchetype.VOLUNTARY_CHURN_DISENGAGED
        assert diag.allow_downgrade_offer is True
        assert "pause your subscription" in diag.suggested_message.lower()
        assert "dunning kill switch" in diag.reasoning.lower()

    def test_enterprise_white_glove_hitl_escalation(self):
        telemetry = SubscriptionLifecycleTelemetry(
            tenure_months=18,
            plan_tier=SubscriptionPlanTier.ENTERPRISE,
            last_login_days_ago=3,
            monthly_amount=50000.0,
            decline_code="gateway_timeout",
        )
        diag = diagnose_subscription_failure(telemetry, customer_name="Acme Corp")
        assert diag.archetype == SubscriptionArchetype.ENTERPRISE_WHITE_GLOVE
        assert diag.requires_hitl_escalation is True
        assert diag.merchant_lifecycle_alert is not None

    def test_plan_downgrade_opportunity(self):
        telemetry = SubscriptionLifecycleTelemetry(
            tenure_months=4,
            plan_tier=SubscriptionPlanTier.PRO,
            last_login_days_ago=2,
            billing_cycle_failure_count=3,  # 3rd failure
            monthly_amount=2499.0,
            decline_code="insufficient_funds",
        )
        diag = diagnose_subscription_failure(telemetry, customer_name="Meera")
        assert diag.archetype == SubscriptionArchetype.PLAN_DOWNGRADE_OPPORTUNITY
        assert diag.allow_downgrade_offer is True
        assert "starter plan" in diag.suggested_message.lower()

    def test_identical_decline_code_contrast_side_by_side(self):
        """
        THE CORE DEMO CONTRAST:
        Two users with the EXACT SAME decline code ('insufficient_funds').
        - Active user gets full smart recovery + WhatsApp link.
        - Dormant user gets Dunning Kill Switch + graceful pause/downgrade.
        """
        # User A: Engaged
        tel_a = SubscriptionLifecycleTelemetry(
            last_login_days_ago=2,
            decline_code="insufficient_funds",
            monthly_amount=1999.0,
        )
        diag_a = diagnose_subscription_failure(tel_a)

        # User B: Dormant
        tel_b = SubscriptionLifecycleTelemetry(
            last_login_days_ago=60,
            decline_code="insufficient_funds",
            monthly_amount=1999.0,
        )
        diag_b = diagnose_subscription_failure(tel_b)

        assert diag_a.archetype == SubscriptionArchetype.INVOLUNTARY_CHURN_ENGAGED
        assert diag_b.archetype == SubscriptionArchetype.VOLUNTARY_CHURN_DISENGAGED
        assert diag_a.recommended_action != diag_b.recommended_action

    def test_end_to_end_enterprise_guardrail_escalation(self):
        state = {
            "event_id": "test_sub_ent_01",
            "event_type": "subscription_failed",
            "amount": 35000.0,
            "metadata": {
                "plan_tier": "enterprise",
                "last_login_days_ago": 1,
            },
            "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.95},
            "audit_trail": [],
        }

        # 1. Classification
        class_res = classify_root_cause(state)
        assert class_res["root_cause"] == "subscription_failed"
        assert class_res["subscription_archetype"] == "enterprise_white_glove"
        assert class_res["requires_hitl_escalation"] is True

        # 2. Guardrails check
        state.update(class_res)
        state["chosen_action"] = {"action_type": "enterprise_hitl_escalation", "target_channel": "email"}
        state["contact_count"] = 0
        guard_res = check_guardrails(state)
        assert guard_res["guardrail_result"] == "ESCALATE"
        assert guard_res["guardrail_rule_fired"] == "RULE_ENTERPRISE_WHITE_GLOVE_ESCALATION"
