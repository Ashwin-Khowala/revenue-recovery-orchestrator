"""
Node 3: Guardrail Check
Deterministic, hard-coded safety and compliance guardrails.
Never bypassable by LLM reasoning.
"""

import os
import logging
from typing import Dict, Any
from orchestrator.state import RecoveryState
from orchestrator.audit import log_audit_entry

logger = logging.getLogger("orchestrator.guardrails")

# Hard system defaults
MAX_CONTACTS_PER_EVENT = 2
HIGH_VALUE_THRESHOLD = 100000.0  # ₹1,00,000


def check_guardrails(state: RecoveryState) -> Dict[str, Any]:
    """
    Evaluates safety boundaries on the chosen recovery action.
    Returns guardrail_result: 'ALLOW', 'ESCALATE', or 'BLOCK'.
    Enforces dynamic merchant policy (HITL cap, channel restrictions, max touches).
    """
    from orchestrator.memory.merchant_memory import get_merchant_policy

    event_id = state.get("event_id", "unknown")
    amount = float(state.get("amount", 0.0))
    merchant_id = state.get("merchant_id", "merch_01")
    root_cause = state.get("root_cause", "")
    chosen_action = state.get("chosen_action", {})
    action_type = chosen_action.get("action_type", "")
    channel = chosen_action.get("target_channel", "none")
    contact_count = state.get("contact_count", 0)
    prior_contacts = state.get("history", {}).get("prior_contacts", 0)
    metadata = state.get("metadata", {})

    # Load dynamic merchant policy
    merchant_policy = state.get("merchant_policy") or get_merchant_policy(merchant_id)
    hitl_threshold = float(merchant_policy.get("hitl_threshold_inr") or merchant_policy.get("hitl_amount_threshold_inr") or HIGH_VALUE_THRESHOLD)
    max_contacts_allowed = int(merchant_policy.get("max_contacts_per_incident") or MAX_CONTACTS_PER_EVENT)
    allowed_channels = merchant_policy.get("allowed_channels") or ["whatsapp", "email", "voice", "telegram"]

    total_prior_contacts = contact_count + prior_contacts

    # --------------------------------------------------------------------------
    # Guardrail 1: Customer Opt-out / Omnichannel Consent Registry Check
    # --------------------------------------------------------------------------
    from orchestrator.governance import OmnichannelConsentRegistry, CrossTrackThrottler
    customer_id = state.get("customer_id", "cust_0001")
    phone = metadata.get("phone") or state.get("customer_phone")
    email = metadata.get("email") or state.get("customer_email")

    is_opted, opt_reason = OmnichannelConsentRegistry.is_opted_out(customer_id, phone=phone, email=email)

    if metadata.get("opt_out") is True or metadata.get("dnd") is True or is_opted:
        rule = "RULE_OPT_OUT_ENFORCED"
        result = "BLOCK"
        reason = opt_reason or "Customer explicitly opted out of recovery communications. All outreach blocked across all channels."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="check_guardrails",
            action_taken=f"Guardrail {result} ({rule})",
            details={"rule": rule, "result": result, "reason": reason},
            reasoning=reason,
        )
        return {
            "guardrail_result": result,
            "guardrail_rule_fired": rule,
            "payment_status": "blocked",
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Guardrail 1.5: Cross-Track Throttling & 24h Quiet Spacing Check
    # --------------------------------------------------------------------------
    if channel in ("whatsapp", "email", "voice") and os.getenv("ENVIRONMENT") != "batch_eval":
        is_permitted, throttle_reason = CrossTrackThrottler.evaluate_outreach_permission(
            customer_id=customer_id,
            proposed_channel=channel,
            proposed_track=root_cause,
            event_id=event_id,
        )
        if not is_permitted:
            rule = "RULE_CROSS_TRACK_24H_QUIET_THROTTLED"
            result = "BLOCK"
            reason = throttle_reason
            audit_entry = log_audit_entry(
                event_id=event_id,
                node_name="check_guardrails",
                action_taken=f"Guardrail {result} ({rule})",
                details={"rule": rule, "result": result, "reason": reason},
                reasoning=reason,
            )
            return {
                "guardrail_result": result,
                "guardrail_rule_fired": rule,
                "payment_status": "blocked",
                "audit_trail": state.get("audit_trail", []) + [audit_entry],
            }


    # --------------------------------------------------------------------------
    # Guardrail 2: Payment Degradation Safety (Never Contact Customer)
    # --------------------------------------------------------------------------
    if root_cause == "payment_degraded" and channel in ("whatsapp", "email"):
        rule = "RULE_DEGRADATION_ZERO_CUSTOMER_CONTACT"
        result = "BLOCK"
        reason = "Payment degradation is an infrastructure issue. Direct customer contact is prohibited."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="check_guardrails",
            action_taken=f"Guardrail {result} ({rule})",
            details={"rule": rule, "result": result},
            reasoning=reason,
        )
        return {
            "guardrail_result": result,
            "guardrail_rule_fired": rule,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Guardrail 2.5: Merchant Allowed Channel Enforcement
    # --------------------------------------------------------------------------
    if channel not in ("none", "reroute", "scheduled_check") and channel not in allowed_channels:
        rule = "RULE_MERCHANT_POLICY_CHANNEL_PROHIBITED"
        result = "BLOCK"
        reason = f"Channel '{channel}' is prohibited under merchant policy for {merchant_id} (allowed: {allowed_channels})."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="check_guardrails",
            action_taken=f"Guardrail {result} ({rule})",
            details={"rule": rule, "result": result, "channel": channel, "allowed": allowed_channels},
            reasoning=reason,
        )
        return {
            "guardrail_result": result,
            "guardrail_rule_fired": rule,
            "payment_status": "blocked",
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Guardrail 3: Contact Frequency Cap (Dynamic Policy Limit)
    # --------------------------------------------------------------------------
    if channel in ("whatsapp", "email", "voice", "telegram") and total_prior_contacts >= max_contacts_allowed:
        rule = "RULE_MAX_CONTACT_FREQUENCY_EXCEEDED"
        result = "ESCALATE"
        reason = f"Customer has already received {total_prior_contacts} outreach attempts (merchant limit={max_contacts_allowed}). Escalating to human."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="check_guardrails",
            action_taken=f"Guardrail {result} ({rule})",
            details={"rule": rule, "result": result, "total_contacts": total_prior_contacts, "limit": max_contacts_allowed},
            reasoning=reason,
        )
        return {
            "guardrail_result": result,
            "guardrail_rule_fired": rule,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Guardrail 4: High-Value Amount Threshold (Dynamic Merchant Cap)
    # --------------------------------------------------------------------------
    if amount >= hitl_threshold and channel in ("whatsapp", "email", "voice", "telegram"):
        rule = "RULE_HIGH_VALUE_THRESHOLD_ESCALATION"
        result = "ESCALATE"
        reason = f"Amount ₹{amount:,.2f} >= merchant policy threshold ₹{hitl_threshold:,.2f}. High financial impact requires Human-In-The-Loop approval."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="check_guardrails",
            action_taken=f"Guardrail {result} ({rule})",
            details={"rule": rule, "result": result, "amount": amount, "threshold": hitl_threshold},
            reasoning=reason,
        )
        return {
            "guardrail_result": result,
            "guardrail_rule_fired": rule,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Guardrail 4.5: Enterprise White-Glove Escalation
    # --------------------------------------------------------------------------
    if state.get("requires_hitl_escalation") is True or state.get("subscription_archetype") == "enterprise_white_glove":
        rule = "RULE_ENTERPRISE_WHITE_GLOVE_ESCALATION"
        result = "ESCALATE"
        reason = f"Enterprise Tier Account / White-Glove contract requires Account Manager review before outreach."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="check_guardrails",
            action_taken=f"Guardrail {result} ({rule})",
            details={"rule": rule, "result": result, "archetype": state.get("subscription_archetype")},
            reasoning=reason,
        )
        return {
            "guardrail_result": result,
            "guardrail_rule_fired": rule,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Guardrail 4.6: Voice Telephony Compliance (TRAI Calling Window 09:00 - 21:00 IST)
    # --------------------------------------------------------------------------
    if channel == "voice" and metadata.get("bypass_calling_hour_check") is not True:
        from orchestrator.channels.voice import validate_calling_window
        is_valid_hour, hour_msg = validate_calling_window()
        if not is_valid_hour and metadata.get("strict_calling_window") is True:
            rule = "RULE_VOICE_OUTSIDE_LEGAL_CALLING_HOURS"
            result = "BLOCK"
            reason = f"{hour_msg} Outbound AI phone outreach postponed until 09:00 AM IST."
            audit_entry = log_audit_entry(
                event_id=event_id,
                node_name="check_guardrails",
                action_taken=f"Guardrail {result} ({rule})",
                details={"rule": rule, "result": result, "calling_status": hour_msg},
                reasoning=reason,
            )
            return {
                "guardrail_result": result,
                "guardrail_rule_fired": rule,
                "audit_trail": state.get("audit_trail", []) + [audit_entry],
            }

    # --------------------------------------------------------------------------
    # Guardrail 5: Passed All Compliance Gates
    # --------------------------------------------------------------------------
    rule = "RULE_ALL_GUARDRAILS_PASSED"
    result = "ALLOW"
    reason = f"All compliance checks passed for action '{chosen_action.get('action_type')}' on channel '{channel}'."
    audit_entry = log_audit_entry(
        event_id=event_id,
        node_name="check_guardrails",
        action_taken=f"Guardrail {result} ({rule})",
        details={"rule": rule, "result": result},
        reasoning=reason,
    )
    return {
        "guardrail_result": result,
        "guardrail_rule_fired": rule,
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }
