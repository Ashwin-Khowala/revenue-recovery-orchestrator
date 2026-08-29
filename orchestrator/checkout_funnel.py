"""
Checkout Drop-Off Intelligence & Margin-Shield Engine
=====================================================
Analyzes step-level funnel telemetry to infer behavioral root causes for cart abandonment:
  1. Technical Form Friction (payment input errors / glitches) -> Direct 1-click fix link (Zero marketing spam)
  2. Price / Shipping Shock (bounced on shipping reveal) -> Free shipping threshold / bundling clarification
  3. Comparison / Window Shopping (rapid repeat browses) -> STRICT MARGIN SHIELD (0% discount, prevent coupon harvesting)
  4. Genuine Hesitation / Trust (high time on payment step) -> Trust assurance, return policy, social proof

Guarantees:
  - Protects merchant margins by forbidding blanket discounting.
  - Prevents training customers to deliberately abandon carts for coupons.
  - Diagnoses UX bugs and alerts merchants to checkout friction points.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("orchestrator.checkout_funnel")


class CheckoutStep(str, Enum):
    CART = "cart"
    SHIPPING_REVEAL = "shipping_reveal"
    PAYMENT_SELECT = "payment_select"
    PAYMENT_INPUT = "payment_input"
    ORDER_CONFIRM = "order_confirm"


class CheckoutBehavioralCause(str, Enum):
    TECHNICAL_FORM_FRICTION = "technical_form_friction"
    PRICE_SHIPPING_SHOCK = "price_shipping_shock"
    COMPARISON_WINDOW_SHOPPING = "comparison_window_shopping"
    GENUINE_HESITATION_TRUST = "genuine_hesitation_trust"


class CheckoutFunnelTelemetry(BaseModel):
    dropped_step: CheckoutStep = CheckoutStep.CART
    time_on_step_sec: int = Field(default=30, ge=0)
    repeat_visits_count: int = Field(default=1, ge=1)
    has_form_error: bool = False
    error_message: Optional[str] = None
    device_type: str = "mobile"  # "mobile" | "desktop"
    cart_value: float = Field(default=0.0, ge=0.0)
    shipping_cost: float = Field(default=0.0, ge=0.0)
    items_count: int = Field(default=1, ge=1)


@dataclass(frozen=True)
class CheckoutDiagnosisResult:
    behavioral_cause: CheckoutBehavioralCause
    confidence: float
    reasoning: str
    recommended_action: str
    target_channel: str
    allow_discount: bool
    max_discount_pct: float
    suggested_message: str
    merchant_ux_alert: Optional[str]


def diagnose_checkout_dropoff(
    telemetry: CheckoutFunnelTelemetry,
    customer_name: str = "Customer",
    resume_payment_link: str = "https://rzp.io/rzp/recovery_link",
) -> CheckoutDiagnosisResult:
    """
    Diagnoses step-level checkout funnel telemetry using deterministic heuristic rules.
    Outputs the behavioral root cause, margin-shield rules, and cause-matched recovery action.
    """
    step = telemetry.dropped_step
    time_spent = telemetry.time_on_step_sec
    repeats = telemetry.repeat_visits_count
    has_error = telemetry.has_form_error
    cart_val = telemetry.cart_value
    shipping = telemetry.shipping_cost

    # ──────────────────────────────────────────────────────────────────────────
    # Archetype 1: Technical / Form Friction
    # Dropped at payment input with error or mobile form glitch
    # ──────────────────────────────────────────────────────────────────────────
    if (step == CheckoutStep.PAYMENT_INPUT and has_error) or (
        step in (CheckoutStep.PAYMENT_INPUT, CheckoutStep.PAYMENT_SELECT)
        and telemetry.error_message is not None
    ):
        return CheckoutDiagnosisResult(
            behavioral_cause=CheckoutBehavioralCause.TECHNICAL_FORM_FRICTION,
            confidence=0.96,
            reasoning=(
                f"Customer encountered a technical or validation friction at '{step.value}' "
                f"(Error: '{telemetry.error_message or 'Form error'}'). High purchase intent confirmed."
            ),
            recommended_action="direct_fix_resume_link",
            target_channel="whatsapp",
            allow_discount=False,  # Don't discount a technical error; just fix the link
            max_discount_pct=0.0,
            suggested_message=(
                f"Hi {customer_name}, we noticed your checkout was interrupted due to a technical glitch. "
                f"We saved your order (₹{cart_val:,.0f}). Tap here to complete securely with 1 click: {resume_payment_link}"
            ),
            merchant_ux_alert=(
                f"⚠️ UX Alert: Form validation failure at checkout step '{step.value}' "
                f"on {telemetry.device_type}. Error: {telemetry.error_message or 'Form glitch'}"
            ),
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Archetype 2: Price / Shipping Shock
    # Dropped immediately after shipping / tax was revealed
    # ──────────────────────────────────────────────────────────────────────────
    if step == CheckoutStep.SHIPPING_REVEAL or (
        shipping > 0 and time_spent <= 20 and step in (CheckoutStep.SHIPPING_REVEAL, CheckoutStep.PAYMENT_SELECT)
    ):
        free_shipping_gap = max(0.0, 1500.0 - cart_val)
        shipping_msg = (
            f"Add ₹{int(free_shipping_gap)} more for FREE shipping, or complete your order here: {resume_payment_link}"
            if free_shipping_gap > 0 and free_shipping_gap <= 500
            else f"Your cart is saved! Complete your checkout with transparent shipping rates here: {resume_payment_link}"
        )
        return CheckoutDiagnosisResult(
            behavioral_cause=CheckoutBehavioralCause.PRICE_SHIPPING_SHOCK,
            confidence=0.92,
            reasoning=(
                f"Customer dropped at '{step.value}' within {time_spent}s of shipping fee (₹{shipping}) reveal. "
                "Classic price/shipping shock."
            ),
            recommended_action="shipping_clarification_link",
            target_channel="whatsapp",
            allow_discount=True,  # Allow light incentive/shipping waiver if EV permits
            max_discount_pct=5.0,
            suggested_message=f"Hi {customer_name}, {shipping_msg}",
            merchant_ux_alert=(
                f"💡 Conversion Insight: {cart_val:,.0f} cart dropped at shipping reveal. "
                "Consider displaying shipping calculators earlier in the product page."
            ),
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Archetype 3: Comparison / Window Shopping
    # Rapid visit (<20s), multiple repeat browses (>=3), dropped at cart
    # STRICT MARGIN SHIELD APPLIED: 0% DISCOUNT
    # ──────────────────────────────────────────────────────────────────────────
    if repeats >= 3 and time_spent < 25 and step == CheckoutStep.CART:
        return CheckoutDiagnosisResult(
            behavioral_cause=CheckoutBehavioralCause.COMPARISON_WINDOW_SHOPPING,
            confidence=0.94,
            reasoning=(
                f"Customer viewed cart {repeats} times with brief duration ({time_spent}s) without initiating checkout. "
                "Comparison / window shopping behavior. Margin-Shield activated: ZERO DISCOUNT to prevent margin cannibalization."
            ),
            recommended_action="non_discounted_cart_reminder",
            target_channel="email",
            allow_discount=False,  # STRICT MARGIN SHIELD
            max_discount_pct=0.0,
            suggested_message=(
                f"Hi {customer_name}, items in your cart (₹{cart_val:,.0f}) are popular and in stock. "
                f"Review your cart whenever you are ready: {resume_payment_link}"
            ),
            merchant_ux_alert=None,
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Archetype 4: Genuine Hesitation / Trust Sensitivity
    # High time-on-step (>90s) at payment selection, first time buyer
    # ──────────────────────────────────────────────────────────────────────────
    if time_spent >= 60 and step in (CheckoutStep.PAYMENT_SELECT, CheckoutStep.PAYMENT_INPUT):
        return CheckoutDiagnosisResult(
            behavioral_cause=CheckoutBehavioralCause.GENUINE_HESITATION_TRUST,
            confidence=0.90,
            reasoning=(
                f"Customer spent {time_spent}s evaluating payment options at '{step.value}'. "
                "Indicates purchase intent with trust/return-policy hesitation. Trust assurance prioritized over discounts."
            ),
            recommended_action="trust_assurance_and_reviews",
            target_channel="whatsapp",
            allow_discount=False,  # Lead with trust on Touch 1, not discounts
            max_discount_pct=0.0,
            suggested_message=(
                f"Hi {customer_name}, your order of ₹{cart_val:,.0f} is protected by our 100% money-back guarantee "
                f"and 30-day hassle-free returns. Complete securely via Razorpay: {resume_payment_link}"
            ),
            merchant_ux_alert=None,
        )

    # Default general checkout drop-off
    return CheckoutDiagnosisResult(
        behavioral_cause=CheckoutBehavioralCause.GENUINE_HESITATION_TRUST,
        confidence=0.80,
        reasoning="General cart abandonment with high intent.",
        recommended_action="standard_cart_recovery",
        target_channel="whatsapp",
        allow_discount=True,
        max_discount_pct=5.0,
        suggested_message=f"Hi {customer_name}, your cart (₹{cart_val:,.0f}) is waiting for you! Complete your order: {resume_payment_link}",
        merchant_ux_alert=None,
    )
