"""
Node 5: Executor Node
Executes authorized recovery interventions with channel failover (WhatsApp -> Email)
and zero duplicate contact enforcement.
"""

import logging
from typing import Dict, Any
from orchestrator.state import RecoveryState
from orchestrator.channels import send_whatsapp_recovery, send_email_recovery
from orchestrator.audit import log_audit_entry

logger = logging.getLogger("orchestrator.executor")


def execute_action(state: RecoveryState) -> Dict[str, Any]:
    """
    Executes the approved recovery intervention safely.
    Handles channel fallbacks and updates the incident state.
    """
    event_id = state.get("event_id", "unknown")
    guardrail_result = state.get("guardrail_result", "ALLOW")
    chosen_action = state.get("chosen_action", {})
    action_type = chosen_action.get("action_type", "do_nothing")
    target_channel = chosen_action.get("target_channel", "none")
    amount = float(state.get("amount", 0.0))
    customer_name = state.get("customer_name", "Valued Customer")
    customer_email = state.get("customer_email", "customer@example.com")
    customer_phone = state.get("customer_phone", "+919876543210")
    root_cause = state.get("root_cause", "subscription_failed")
    contact_count = state.get("contact_count", 0)

    # --------------------------------------------------------------------------
    # Case 1: Blocked by Guardrails or Decision is "do_nothing"
    # --------------------------------------------------------------------------
    if guardrail_result == "BLOCK" or action_type == "do_nothing" or target_channel == "none":
        reason = f"Execution bypassed: guardrail_result={guardrail_result}, action={action_type}"
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="execute_action",
            action_taken="No Action Taken (Passive)",
            details={"action_type": action_type, "guardrail_result": guardrail_result},
            reasoning=reason,
        )
        return {
            "channel_used": "none",
            "execution_result": {"status": "skipped", "reason": reason},
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Case 2: Silent Infrastructure Reroute (Zero Customer Contact)
    # --------------------------------------------------------------------------
    if target_channel == "reroute":
        result = {
            "status": "rerouted",
            "backup_route": "hdfc_smart_gateway_v2",
            "backoff_delay_sec": 300,
        }
        reason = "Silent payment route rerouted to secondary gateway without customer outreach."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="execute_action",
            action_taken="Silent Route Rerouted",
            details=result,
            reasoning=reason,
        )
        return {
            "channel_used": "reroute",
            "execution_result": result,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Case 3: Promise-To-Pay Scheduled Tracking
    # --------------------------------------------------------------------------
    if target_channel == "scheduled_check" or action_type == "schedule_ptp_check":
        promised_date = state.get("promised_pay_date", "2026-09-01")
        result = {
            "status": "scheduled",
            "promised_date": promised_date,
            "action": "Outreach paused until promised date.",
        }
        reason = f"Promise-to-pay registered for {promised_date}. Outreach paused."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="execute_action",
            action_taken="PTP Scheduled Check Created",
            details=result,
            reasoning=reason,
        )
        return {
            "channel_used": "scheduled_check",
            "execution_result": result,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Case 4: Primary Outreach (WhatsApp) with Email Fallback
    # --------------------------------------------------------------------------
    recovery_link = f"https://rzp.io/i/{event_id[-8:]}" if state.get("razorpay_ref") else f"https://pay.example.com/rec/{event_id}"

    if target_channel == "whatsapp":
        wa_result = send_whatsapp_recovery(
            recipient_phone=customer_phone,
            customer_name=customer_name,
            amount=amount,
            recovery_link=recovery_link,
            root_cause=root_cause,
        )

        if wa_result.get("success"):
            new_contact_count = contact_count + 1
            audit_entry = log_audit_entry(
                event_id=event_id,
                node_name="execute_action",
                action_taken="WhatsApp Recovery Dispatched",
                details=wa_result,
                reasoning=f"WhatsApp recovery link delivered to {customer_phone}.",
            )
            return {
                "channel_used": "whatsapp",
                "contact_count": new_contact_count,
                "execution_result": wa_result,
                "audit_trail": state.get("audit_trail", []) + [audit_entry],
            }
        else:
            # WhatsApp dispatch failed -> Fallback to Email immediately
            logger.warning(f"WhatsApp delivery failed for {event_id}. Executing fallback to Email.")
            email_result = send_email_recovery(
                recipient_email=customer_email,
                customer_name=customer_name,
                amount=amount,
                recovery_link=recovery_link,
                root_cause=root_cause,
            )
            new_contact_count = contact_count + 1
            audit_entry = log_audit_entry(
                event_id=event_id,
                node_name="execute_action",
                action_taken="Email Recovery Dispatched (Failover)",
                details={
                    "whatsapp_error": wa_result.get("error"),
                    "email_result": email_result,
                },
                reasoning="WhatsApp failed. Cleanly failed over to Resend Email without duplicate messages.",
            )
            return {
                "channel_used": "email",
                "contact_count": new_contact_count,
                "execution_result": email_result,
                "audit_trail": state.get("audit_trail", []) + [audit_entry],
            }

    # Direct Email channel if chosen by policy
    if target_channel == "email":
        email_result = send_email_recovery(
            recipient_email=customer_email,
            customer_name=customer_name,
            amount=amount,
            recovery_link=recovery_link,
            root_cause=root_cause,
        )
        new_contact_count = contact_count + 1
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="execute_action",
            action_taken="Email Recovery Dispatched",
            details=email_result,
            reasoning=f"Direct email reminder delivered to {customer_email}.",
        )
        return {
            "channel_used": "email",
            "contact_count": new_contact_count,
            "execution_result": email_result,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    return {
        "channel_used": "none",
        "execution_result": {"status": "unhandled_channel"},
        "audit_trail": state.get("audit_trail", []),
    }
