"""
Subscription Lifecycle & Involuntary vs. Voluntary Churn Intelligence Engine
=============================================================================
Analyzes product engagement telemetry and subscription lifecycle context
to separate genuine payment hitches from disengaged retention problems:

  1. INVOLUNTARY_CHURN_ENGAGED: Active user with card/balance issue -> Full smart recovery (pay-cycle retry, 1-click update link, 14-day grace period).
  2. VOLUNTARY_CHURN_DISENGAGED: Inactive user (>45 days no login, disabled auto-renew) -> Dunning Kill Switch: 1 graceful pause/downgrade notification -> STOP (prevents credit card chargebacks).
  3. ENTERPRISE_WHITE_GLOVE: High-value enterprise account -> Suppress bot messages, trigger Telegram HITL alert for account manager / CFO outreach.
  4. PLAN_DOWNGRADE_OPPORTUNITY: Repeated failures on expensive plan -> Offer 50% cheaper tier / 30-day pause instead of binary cancellation.

Guarantees:
  - Stops aggressive dunning of customers who already mentally cancelled.
  - Protects merchant reputation and reduces payment processor dispute rates.
  - Aligns retries with customer income cycles (72h wait for insufficient funds).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger("orchestrator.subscription_recovery")


class SubscriptionPlanTier(str, Enum):
    ENTERPRISE = "enterprise"
    PRO = "pro"
    STARTER = "starter"
    HOBBY = "hobby"


class SubscriptionArchetype(str, Enum):
    INVOLUNTARY_CHURN_ENGAGED = "involuntary_churn_engaged"
    VOLUNTARY_CHURN_DISENGAGED = "voluntary_churn_disengaged"
    ENTERPRISE_WHITE_GLOVE = "enterprise_white_glove"
    PLAN_DOWNGRADE_OPPORTUNITY = "plan_downgrade_opportunity"


class SubscriptionLifecycleTelemetry(BaseModel):
    tenure_months: int = Field(default=1, ge=0)
    plan_tier: SubscriptionPlanTier = SubscriptionPlanTier.PRO
    last_login_days_ago: int = Field(default=2, ge=0)
    billing_cycle_failure_count: int = Field(default=1, ge=1)
    auto_renew_status: str = "active"  # "active" | "disabled"
    monthly_amount: float = Field(default=1999.0, ge=0.0)
    decline_code: str = "insufficient_funds"
    has_support_ticket_asking_cancel: bool = False


@dataclass(frozen=True)
class SubscriptionDiagnosisResult:
    archetype: SubscriptionArchetype
    confidence: float
    reasoning: str
    recommended_action: str
    target_channel: str
    requires_hitl_escalation: bool
    grace_period_days: int
    allow_downgrade_offer: bool
    suggested_message: str
    merchant_lifecycle_alert: Optional[str]


def diagnose_subscription_failure(
    telemetry: SubscriptionLifecycleTelemetry,
    customer_name: str = "Subscriber",
    recovery_payment_link: str = "https://rzp.io/rzp/subscription_update",
) -> SubscriptionDiagnosisResult:
    """
    Diagnoses a failed recurring subscription charge by reading decline codes
    through the lens of product usage telemetry and customer lifecycle context.
    """
    tenure = telemetry.tenure_months
    tier = telemetry.plan_tier
    days_since_login = telemetry.last_login_days_ago
    failures = telemetry.billing_cycle_failure_count
    auto_renew = telemetry.auto_renew_status.lower()
    amount = telemetry.monthly_amount
    code = telemetry.decline_code.lower()
    asked_cancel = telemetry.has_support_ticket_asking_cancel

    # ──────────────────────────────────────────────────────────────────────────
    # Archetype 1: Enterprise High-Value Account (White-Glove Path)
    # Tier is Enterprise or Amount >= ₹25,000
    # ──────────────────────────────────────────────────────────────────────────
    if tier == SubscriptionPlanTier.ENTERPRISE or amount >= 25000.0:
        return SubscriptionDiagnosisResult(
            archetype=SubscriptionArchetype.ENTERPRISE_WHITE_GLOVE,
            confidence=0.98,
            reasoning=(
                f"High-value {tier.value.upper()} account (₹{amount:,.0f}/mo, {tenure}mo tenure). "
                "Automated bot messaging suppressed to protect client relationship. Dispatched to Account Manager via Telegram HITL."
            ),
            recommended_action="enterprise_hitl_escalation",
            target_channel="none",  # Suppress direct customer outreach; alert internal admin
            requires_hitl_escalation=True,
            grace_period_days=21,
            allow_downgrade_offer=False,
            suggested_message=(
                f"Enterprise Renewal Notice for {customer_name}: Invoice ₹{amount:,.0f} encountered an issuing bank decline ({code}). "
                "Your Account Manager is reviewing this transaction."
            ),
            merchant_lifecycle_alert=(
                f"[Enterprise Alert] Renewal failed: ₹{amount:,.0f}/mo subscription for {customer_name} ({code}). "
                "Automated messages paused. Review and approve direct executive outreach."
            ),
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Archetype 2: Voluntary Churn in Disguise (Dormant / Disengaged User)
    # No login for 45+ days, or auto-renew disabled, or support asked to cancel
    # ──────────────────────────────────────────────────────────────────────────
    if days_since_login >= 45 or auto_renew == "disabled" or asked_cancel:
        churn_trigger = (
            "asked support to cancel"
            if asked_cancel
            else ("auto-renew was disabled" if auto_renew == "disabled" else f"inactive for {days_since_login} days")
        )
        return SubscriptionDiagnosisResult(
            archetype=SubscriptionArchetype.VOLUNTARY_CHURN_DISENGAGED,
            confidence=0.94,
            reasoning=(
                f"Retention problem in payment-failure disguise: Customer {churn_trigger}. "
                "Dunning Kill Switch active: 1 single polite off-ramp notification sent, then outreach halts to prevent chargebacks."
            ),
            recommended_action="graceful_cancellation_offramp",
            target_channel="email",
            requires_hitl_escalation=False,
            grace_period_days=7,
            allow_downgrade_offer=True,
            suggested_message=(
                f"Hi {customer_name}, we noticed you haven't been active recently and your renewal of ₹{amount:,.0f} didn't go through. "
                f"Would you like to pause your subscription or switch to our free tier? Manage your account: {recovery_payment_link}"
            ),
            merchant_lifecycle_alert=(
                f"[Churn Warning] Voluntary churn risk: {customer_name} ({tier.value}) was inactive for {days_since_login} days. "
                "Routed to graceful exit survey / downgrade to prevent credit card disputes."
            ),
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Archetype 3: Plan Downgrade Opportunity (Repeated Failure on Mid/High Tier)
    # 2nd or 3rd failure on Pro tier, active user
    # ──────────────────────────────────────────────────────────────────────────
    if failures >= 2 and tier in (SubscriptionPlanTier.PRO, SubscriptionPlanTier.STARTER) and amount >= 1500.0:
        return SubscriptionDiagnosisResult(
            archetype=SubscriptionArchetype.PLAN_DOWNGRADE_OPPORTUNITY,
            confidence=0.88,
            reasoning=(
                f"Customer experienced {failures} consecutive billing failures despite active product usage ({days_since_login}d ago). "
                "Indicates payment or budget constraint. Presenting a 30-day pause or 50% cheaper plan option."
            ),
            recommended_action="plan_downgrade_or_pause_offer",
            target_channel="whatsapp",
            requires_hitl_escalation=False,
            grace_period_days=14,
            allow_downgrade_offer=True,
            suggested_message=(
                f"Hi {customer_name}, your subscription (₹{amount:,.0f}) is in a 14-day grace period. "
                f"To keep your account active without interruptions, you can update your card, pause for 30 days, or switch to our Starter plan here: {recovery_payment_link}"
            ),
            merchant_lifecycle_alert=None,
        )

    # ──────────────────────────────────────────────────────────────────────────
    # Archetype 4: Active / Engaged Subscriber (Involuntary Churn)
    # Active usage within last 14 days, auto-renew active, 1st failure
    # ──────────────────────────────────────────────────────────────────────────
    timing_tip = " (Scheduled for Friday payroll window)" if code == "insufficient_funds" else ""
    return SubscriptionDiagnosisResult(
        archetype=SubscriptionArchetype.INVOLUNTARY_CHURN_ENGAGED,
        confidence=0.95,
        reasoning=(
            f"Genuine involuntary churn: Highly engaged user ({days_since_login}d since last login, {tenure}mo tenure) "
            f"hit a fixable payment hitch ({code}). Full smart recovery sequence initiated with 14-day grace period{timing_tip}."
        ),
        recommended_action="smart_subscription_retry_link",
        target_channel="whatsapp",
        requires_hitl_escalation=False,
        grace_period_days=14,
        allow_downgrade_offer=False,
        suggested_message=(
            f"Hi {customer_name}, your monthly subscription of ₹{amount:,.0f} had a temporary payment issue ({code.replace('_', ' ')}). "
            f"Your access remains uninterrupted during your 14-day grace period. Update your card with 1 tap: {recovery_payment_link}"
        ),
        merchant_lifecycle_alert=None,
    )
