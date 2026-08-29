"""
Node 3: Guardrail Check
Deterministic, hard-coded safety and compliance guardrails.
Never bypassable by LLM reasoning.
"""

import logging
from typing import Dict, Any
from orchestrator.state import RecoveryState
from orchestrator.audit import log_audit_entry

logger = logging.getLogger("orchestrator.guardrails")

# Hard system limits
MAX_CONTACTS_PER_EVENT = 2
HIGH_VALUE_THRESHOLD = 100000.0  # ₹1,00,000


def check_guardrails(state: RecoveryState) -> Dict[str, Any]:
    """
    Evaluates safety boundaries on the chosen recovery action.
    Returns guardrail_result: 'ALLOW', 'ESCALATE', or 'BLOCK'.
    """
    event_id = state.get("event_id", "unknown")
    amount = float(state.get("amount", 0.0))
    root_cause = state.get("root_cause", "")
    chosen_action = state.get("chosen_action", {})
    channel = chosen_action.get("target_channel", "none")
    contact_count = state.get("contact_count", 0)
    prior_contacts = state.get("history", {}).get("prior_contacts", 0)
    metadata = state.get("metadata", {})

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
    # Guardrail 3: Contact Frequency Cap (Max 2 Attempts)
    # --------------------------------------------------------------------------
    if channel in ("whatsapp", "email") and total_prior_contacts >= MAX_CONTACTS_PER_EVENT:
        rule = "RULE_MAX_CONTACT_FREQUENCY_EXCEEDED"
        result = "ESCALATE"
        reason = f"Customer has already received {total_prior_contacts} outreach attempts (limit={MAX_CONTACTS_PER_EVENT}). Escalating to human."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="check_guardrails",
            action_taken=f"Guardrail {result} ({rule})",
            details={"rule": rule, "result": result, "total_contacts": total_prior_contacts},
            reasoning=reason,
        )
        return {
            "guardrail_result": result,
            "guardrail_rule_fired": rule,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Guardrail 4: High-Value Amount Threshold (> ₹1,00,000)
    # --------------------------------------------------------------------------
    if amount >= HIGH_VALUE_THRESHOLD and channel in ("whatsapp", "email"):
        rule = "RULE_HIGH_VALUE_THRESHOLD_ESCALATION"
        result = "ESCALATE"
        reason = f"Amount ₹{amount:,.2f} >= ₹{HIGH_VALUE_THRESHOLD:,.2f}. High financial impact requires Human-In-The-Loop approval."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="check_guardrails",
            action_taken=f"Guardrail {result} ({rule})",
            details={"rule": rule, "result": result, "amount": amount},
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
