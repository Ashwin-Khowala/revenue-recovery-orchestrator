"""
Test Suite: Checkout Drop-Off Intelligence & Margin-Shield Engine
==================================================================
Validates step-level funnel telemetry diagnosis, behavioral archetype classification,
and strict margin-protection guardrails (0% discount for comparison shoppers).
"""

import pytest
from orchestrator.checkout_funnel import (
    diagnose_checkout_dropoff,
    CheckoutFunnelTelemetry,
    CheckoutStep,
    CheckoutBehavioralCause,
)
from orchestrator.nodes.root_cause_classifier import classify_root_cause
from orchestrator.nodes.policy_engine import score_policy_options


class TestCheckoutFunnelIntelligence:
    """Tests for the 4 behavioral checkout abandonment archetypes."""

    def test_technical_form_friction_dropoff(self):
        telemetry = CheckoutFunnelTelemetry(
            dropped_step=CheckoutStep.PAYMENT_INPUT,
            time_on_step_sec=45,
            repeat_visits_count=1,
            has_form_error=True,
            error_message="Card network timeout on mobile",
            device_type="mobile",
            cart_value=3499.0,
        )
        diag = diagnose_checkout_dropoff(telemetry, customer_name="Aarav")
        assert diag.behavioral_cause == CheckoutBehavioralCause.TECHNICAL_FORM_FRICTION
        assert diag.allow_discount is False  # Never discount a technical glitch
        assert diag.max_discount_pct == 0.0
        assert "technical glitch" in diag.suggested_message.lower()
        assert diag.merchant_ux_alert is not None

    def test_price_shipping_shock_dropoff(self):
        telemetry = CheckoutFunnelTelemetry(
            dropped_step=CheckoutStep.SHIPPING_REVEAL,
            time_on_step_sec=12,
            repeat_visits_count=1,
            shipping_cost=150.0,
            cart_value=1200.0,
        )
        diag = diagnose_checkout_dropoff(telemetry, customer_name="Priya")
        assert diag.behavioral_cause == CheckoutBehavioralCause.PRICE_SHIPPING_SHOCK
        assert diag.allow_discount is True  # Allow light shipping waiver
        assert diag.max_discount_pct <= 5.0
        assert "shipping" in diag.suggested_message.lower()

    def test_comparison_window_shopping_margin_shield(self):
        """CRITICAL: Verifies that comparison shoppers are NEVER given a discount."""
        telemetry = CheckoutFunnelTelemetry(
            dropped_step=CheckoutStep.CART,
            time_on_step_sec=15,
            repeat_visits_count=4,
            cart_value=4999.0,
        )
        diag = diagnose_checkout_dropoff(telemetry, customer_name="Neha")
        assert diag.behavioral_cause == CheckoutBehavioralCause.COMPARISON_WINDOW_SHOPPING
        assert diag.allow_discount is False  # STRICT MARGIN SHIELD
        assert diag.max_discount_pct == 0.0
        assert "margin" in diag.reasoning.lower()
        assert "discount" not in diag.suggested_message.lower()

    def test_genuine_hesitation_trust_dropoff(self):
        telemetry = CheckoutFunnelTelemetry(
            dropped_step=CheckoutStep.PAYMENT_SELECT,
            time_on_step_sec=140,  # Hesitated for >2 minutes
            repeat_visits_count=1,
            cart_value=2500.0,
        )
        diag = diagnose_checkout_dropoff(telemetry, customer_name="Sameer")
        assert diag.behavioral_cause == CheckoutBehavioralCause.GENUINE_HESITATION_TRUST
        assert diag.allow_discount is False  # Lead with trust on Touch 1
        assert "money-back guarantee" in diag.suggested_message.lower()

    def test_end_to_end_classifier_and_policy_margin_protection(self):
        """Verifies full node execution with comparison shopper margin shield."""
        state = {
            "event_id": "test_checkout_margin_01",
            "event_type": "checkout_abandoned",
            "amount": 5000.0,
            "metadata": {
                "dropped_step": "cart",
                "time_on_step_sec": 10,
                "repeat_visits_count": 3,
            },
            "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.8},
            "audit_trail": [],
        }

        # 1. Classification
        class_res = classify_root_cause(state)
        assert class_res["root_cause"] == "checkout_abandoned"
        assert class_res["behavioral_cause"] == "comparison_window_shopping"
        assert class_res["allow_discount"] is False

        # 2. Policy Engine scoring
        state.update(class_res)
        policy_res = score_policy_options(state)
        # Margin Shield must enforce discount = 0.0
        assert policy_res["discount_applied"] == 0.0
        assert policy_res["ev_breakdown"]["margin_shield_active"] is True
