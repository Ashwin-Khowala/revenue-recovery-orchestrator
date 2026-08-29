"""
Node 1: Root-Cause Classifier
Hybrid approach: Deterministic rules for unambiguous cases (0 latency / 0 LLM cost) +
Azure OpenAI for ambiguous behavioral reasoning and candidate action generation.
"""

import json
import logging
from typing import Dict, Any
from orchestrator.state import RecoveryState
from orchestrator.llm import get_azure_chat_llm
from orchestrator.audit import log_audit_entry
from orchestrator.decline_codes import lookup_decline_code, FaultDomain, RetryStrategy

logger = logging.getLogger("orchestrator.classifier")


def classify_root_cause(state: RecoveryState) -> Dict[str, Any]:
    """
    Classifies the revenue at risk into one of 6 categories and synthesizes candidate interventions.
    """
    event_id = state.get("event_id", "unknown")
    event_type = state.get("event_type")
    amount = state.get("amount", 0.0)
    history = state.get("history", {})
    metadata = state.get("metadata", {})

    # Extract decline code / failure reason from event metadata
    raw_decline = metadata.get("decline_code") or metadata.get("failure_reason") or event_type
    decline_info = lookup_decline_code(raw_decline)

    # --------------------------------------------------------------------------
    # Deterministic Rule Check 1: Payment Route / Gateway Degradation (Merchant Fault)
    # --------------------------------------------------------------------------
    if (
        event_type == "payment_degraded"
        or decline_info.fault_domain == FaultDomain.MERCHANT_SYSTEM
        or metadata.get("pct_merchant_failures_same_route", 0) >= 0.35
    ):
        root_cause = "payment_degraded"
        confidence = 0.99
        reasoning = (
            f"Deterministic match ({decline_info.code}): Route degradation detected. "
            "Fault Domain: MERCHANT_SYSTEM. Customer must NOT be contacted."
        )
        candidate_actions = [
            {"action_type": "silent_route_reroute", "target_channel": "reroute", "cost": 0.0, "description": "Reroute payment to secondary bank gateway with 5m backoff"},
            {"action_type": "do_nothing", "target_channel": "none", "cost": 0.0, "description": "Wait for gateway route health recovery"}
        ]
        
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="classify_root_cause",
            action_taken=f"Classified as {root_cause} (Decline Taxonomy / Rule Engine)",
            details={
                "root_cause": root_cause,
                "confidence": confidence,
                "fault_domain": decline_info.fault_domain.value,
                "decline_code": decline_info.code,
                "recommended_wait_hours": decline_info.recommended_wait_hours,
                "candidate_actions": candidate_actions,
            },
            reasoning=reasoning,
        )
        return {
            "root_cause": root_cause,
            "confidence": confidence,
            "fault_domain": decline_info.fault_domain.value,
            "decline_code": decline_info.code,
            "recommended_wait_hours": decline_info.recommended_wait_hours,
            "classification_reasoning": reasoning,
            "candidate_actions": candidate_actions,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Deterministic Rule Check 2: RBI > ₹15,000 Mandate AFA Step Missing
    # --------------------------------------------------------------------------
    if (event_type == "mandate_auth_failed" or amount > 15000 or decline_info.code == "mandate_auth_failed") and metadata.get("afa_step_reached") is False:
        root_cause = "mandate_auth_failed"
        confidence = 0.98
        reasoning = f"Deterministic match: Mandate amount ₹{amount} > ₹15,000 without RBI Additional Factor Authentication (AFA)."
        candidate_actions = [
            {"action_type": "whatsapp_mandate_afa_link", "target_channel": "whatsapp", "cost": 0.80, "description": "Send pre-authenticated RBI mandate consent link via WhatsApp"},
            {"action_type": "email_mandate_afa_link", "target_channel": "email", "cost": 0.05, "description": "Send mandate re-authentication email"},
            {"action_type": "do_nothing", "target_channel": "none", "cost": 0.0, "description": "Do nothing (Low EV due to mandatory RBI regulatory block)"}
        ]
        
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="classify_root_cause",
            action_taken=f"Classified as {root_cause} (Rule Engine)",
            details={"root_cause": root_cause, "confidence": confidence, "candidate_actions": candidate_actions},
            reasoning=reasoning,
        )
        return {
            "root_cause": root_cause,
            "confidence": confidence,
            "classification_reasoning": reasoning,
            "candidate_actions": candidate_actions,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Deterministic Rule Check 3: Checkout Drop-Off Funnel Telemetry
    # --------------------------------------------------------------------------
    if event_type == "checkout_abandoned" or "dropped_step" in metadata or "funnel_telemetry" in metadata:
        from orchestrator.checkout_funnel import (
            diagnose_checkout_dropoff,
            CheckoutFunnelTelemetry,
            CheckoutStep,
        )
        
        telemetry_raw = metadata.get("funnel_telemetry") or {}
        dropped_step_val = metadata.get("dropped_step") or telemetry_raw.get("dropped_step", "cart")
        
        # Safe enum mapping
        try:
            step_enum = CheckoutStep(dropped_step_val)
        except ValueError:
            step_enum = CheckoutStep.CART

        telemetry = CheckoutFunnelTelemetry(
            dropped_step=step_enum,
            time_on_step_sec=metadata.get("time_on_step_sec") or telemetry_raw.get("time_on_step_sec", 30),
            repeat_visits_count=metadata.get("repeat_visits_count") or telemetry_raw.get("repeat_visits_count", 1),
            has_form_error=metadata.get("has_form_error") or telemetry_raw.get("has_form_error", False),
            error_message=metadata.get("error_message") or telemetry_raw.get("error_message"),
            device_type=metadata.get("device_type") or telemetry_raw.get("device_type", "mobile"),
            cart_value=amount,
            shipping_cost=metadata.get("shipping_cost") or telemetry_raw.get("shipping_cost", 0.0),
        )
        
        diag = diagnose_checkout_dropoff(
            telemetry=telemetry,
            customer_name=state.get("customer_name", "Customer"),
            resume_payment_link=state.get("metadata", {}).get("recovery_link", "https://rzp.io/rzp/checkout_resume"),
        )
        
        candidate_actions = [
            {
                "action_type": diag.recommended_action,
                "target_channel": diag.target_channel,
                "cost": 0.80 if diag.target_channel == "whatsapp" else 0.05,
                "description": diag.suggested_message,
            },
            {
                "action_type": "do_nothing",
                "target_channel": "none",
                "cost": 0.0,
                "description": "Do nothing (Preserve merchant margin and avoid customer coupon gaming)",
            }
        ]

        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="classify_root_cause",
            action_taken=f"Classified as checkout_abandoned ({diag.behavioral_cause.value})",
            details={
                "root_cause": "checkout_abandoned",
                "behavioral_cause": diag.behavioral_cause.value,
                "confidence": diag.confidence,
                "allow_discount": diag.allow_discount,
                "max_discount_pct": diag.max_discount_pct,
                "merchant_ux_alert": diag.merchant_ux_alert,
                "candidate_actions": candidate_actions,
            },
            reasoning=diag.reasoning,
        )
        return {
            "root_cause": "checkout_abandoned",
            "behavioral_cause": diag.behavioral_cause.value,
            "confidence": diag.confidence,
            "allow_discount": diag.allow_discount,
            "max_discount_pct": diag.max_discount_pct,
            "merchant_ux_alert": diag.merchant_ux_alert,
            "classification_reasoning": diag.reasoning,
            "candidate_actions": candidate_actions,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Deterministic Rule Check 4: Subscription Lifecycle & Churn Intelligence
    # --------------------------------------------------------------------------
    if (
        event_type == "subscription_failed"
        or "plan_tier" in metadata
        or "last_login_days_ago" in metadata
        or "subscription_telemetry" in metadata
    ):
        from orchestrator.subscription_recovery import (
            diagnose_subscription_failure,
            SubscriptionLifecycleTelemetry,
            SubscriptionPlanTier,
        )
        
        telemetry_raw = metadata.get("subscription_telemetry") or {}
        tier_val = metadata.get("plan_tier") or telemetry_raw.get("plan_tier", "pro")
        try:
            tier_enum = SubscriptionPlanTier(tier_val.lower())
        except ValueError:
            tier_enum = SubscriptionPlanTier.PRO

        sub_telemetry = SubscriptionLifecycleTelemetry(
            tenure_months=metadata.get("tenure_months") or telemetry_raw.get("tenure_months", history.get("tenure_months", 1)),
            plan_tier=tier_enum,
            last_login_days_ago=metadata.get("last_login_days_ago") or telemetry_raw.get("last_login_days_ago", 2),
            billing_cycle_failure_count=metadata.get("billing_cycle_failure_count") or telemetry_raw.get("billing_cycle_failure_count", 1),
            auto_renew_status=metadata.get("auto_renew_status") or telemetry_raw.get("auto_renew_status", "active"),
            monthly_amount=amount,
            decline_code=decline_info.code,
            has_support_ticket_asking_cancel=metadata.get("has_support_ticket_asking_cancel", False),
        )

        sub_diag = diagnose_subscription_failure(
            telemetry=sub_telemetry,
            customer_name=state.get("customer_name", "Subscriber"),
            recovery_payment_link=state.get("metadata", {}).get("recovery_link", "https://rzp.io/rzp/sub_update"),
        )

        candidate_actions = [
            {
                "action_type": sub_diag.recommended_action,
                "target_channel": sub_diag.target_channel,
                "cost": 0.80 if sub_diag.target_channel == "whatsapp" else (0.05 if sub_diag.target_channel == "email" else 0.0),
                "description": sub_diag.suggested_message,
            },
            {
                "action_type": "do_nothing",
                "target_channel": "none",
                "cost": 0.0,
                "description": "Do nothing (Natural settlement or respect customer disengagement)",
            }
        ]

        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="classify_root_cause",
            action_taken=f"Classified as subscription_failed ({sub_diag.archetype.value})",
            details={
                "root_cause": "subscription_failed",
                "subscription_archetype": sub_diag.archetype.value,
                "confidence": sub_diag.confidence,
                "requires_hitl_escalation": sub_diag.requires_hitl_escalation,
                "grace_period_days": sub_diag.grace_period_days,
                "allow_downgrade_offer": sub_diag.allow_downgrade_offer,
                "merchant_lifecycle_alert": sub_diag.merchant_lifecycle_alert,
                "candidate_actions": candidate_actions,
            },
            reasoning=sub_diag.reasoning,
        )
        return {
            "root_cause": "subscription_failed",
            "subscription_archetype": sub_diag.archetype.value,
            "confidence": sub_diag.confidence,
            "requires_hitl_escalation": sub_diag.requires_hitl_escalation,
            "grace_period_days": sub_diag.grace_period_days,
            "allow_downgrade_offer": sub_diag.allow_downgrade_offer,
            "merchant_lifecycle_alert": sub_diag.merchant_lifecycle_alert,
            "classification_reasoning": sub_diag.reasoning,
            "candidate_actions": candidate_actions,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Ambiguous / Behavioral Classification: Azure OpenAI Reasoning
    # --------------------------------------------------------------------------
    llm = get_azure_chat_llm(temperature=0.0)

    if llm is not None:
        try:
            prompt = f"""You are the Root-Cause Classifier for an AI Revenue Recovery Orchestrator.
Analyze the following payment/revenue incident and output structured JSON.

Event Details:
- Event ID: {event_id}
- Event Type: {event_type}
- Amount: ₹{amount}
- Customer History: {json.dumps(history)}
- Incident Metadata: {json.dumps(metadata)}

Possible Categories:
1. 'subscription_failed': Recurring billing decline (card expired, soft decline, insufficient funds).
2. 'checkout_abandoned': Cart drop-off by high-intent user.
3. 'receivable_overdue': B2B unpaid invoice past terms.
4. 'payment_degraded': Technical failure/route degradation.
5. 'mandate_auth_failed': Recurring mandate > ₹15,000 lacking AFA consent.
6. 'promise_to_pay': Customer promised to pay on a specific date.

Respond ONLY with a valid JSON object formatted as:
{{
  "root_cause": "<category>",
  "confidence": <float 0.0 to 1.0>,
  "reasoning": "<brief explanation>",
  "candidate_actions": [
    {{
      "action_type": "<e.g. whatsapp_quick_link | email_invoice_reminder | do_nothing | scheduled_ptp_check>",
      "target_channel": "<whatsapp | email | reroute | scheduled_check | none>",
      "cost": <float estimated execution cost in INR>,
      "description": "<action description>"
    }}
  ]
}}
"""
            try:
                response = llm.invoke(prompt)
            except Exception as azure_err:
                logger.warning(f"Azure OpenAI failed for event {event_id}: {azure_err}. Attempting Gemini fallback.")
                from orchestrator.llm import get_gemini_chat_llm
                gemini_llm = get_gemini_chat_llm(temperature=0.0)
                if gemini_llm is not None:
                    response = gemini_llm.invoke(prompt)
                else:
                    raise azure_err

            content = response.content.strip()
            # Clean markdown codeblocks if present
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            parsed = json.loads(content.strip())
            
            root_cause = parsed.get("root_cause", event_type or "subscription_failed")
            confidence = float(parsed.get("confidence", 0.85))
            reasoning = parsed.get("reasoning", "LLM reasoning classification")
            candidate_actions = parsed.get("candidate_actions", [])

            # Always ensure 'do_nothing' exists as a candidate for evaluation
            has_do_nothing = any(a.get("action_type") == "do_nothing" for a in candidate_actions)
            if not has_do_nothing:
                candidate_actions.append({
                    "action_type": "do_nothing",
                    "target_channel": "none",
                    "cost": 0.0,
                    "description": "Natural recovery without outreach friction"
                })

            audit_entry = log_audit_entry(
                event_id=event_id,
                node_name="classify_root_cause",
                action_taken=f"Classified as {root_cause} (LLM)",
                details={"root_cause": root_cause, "confidence": confidence, "candidate_actions": candidate_actions},
                reasoning=reasoning,
            )
            return {
                "root_cause": root_cause,
                "confidence": confidence,
                "classification_reasoning": reasoning,
                "candidate_actions": candidate_actions,
                "audit_trail": state.get("audit_trail", []) + [audit_entry],
            }
        except Exception as e:
            logger.error(f"LLM Classification failed for event {event_id}: {e}. Falling back to heuristic baseline.")

    # --------------------------------------------------------------------------
    # Heuristic Fallback (if Azure OpenAI unavailable or offline)
    # --------------------------------------------------------------------------
    fallback_cause = event_type or "subscription_failed"
    fallback_actions = [
        {"action_type": "whatsapp_recovery_nudge", "target_channel": "whatsapp", "cost": 0.80, "description": "WhatsApp recovery link"},
        {"action_type": "email_invoice_reminder", "target_channel": "email", "cost": 0.05, "description": "Email recovery notification"},
        {"action_type": "do_nothing", "target_channel": "none", "cost": 0.0, "description": "Allow natural customer recovery"}
    ]
    audit_entry = log_audit_entry(
        event_id=event_id,
        node_name="classify_root_cause",
        action_taken=f"Classified as {fallback_cause} (Heuristic Fallback)",
        details={"root_cause": fallback_cause, "confidence": 0.70, "candidate_actions": fallback_actions},
        reasoning="Deterministic heuristic fallback path executed.",
    )
    return {
        "root_cause": fallback_cause,
        "confidence": 0.70,
        "classification_reasoning": "Heuristic fallback classification.",
        "candidate_actions": fallback_actions,
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }
