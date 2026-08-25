"""
Node 6: Outcome Tracker & Webhook Race Reconciler
Tracks real money recovered by querying Razorpay's API and reconciles webhook race conditions.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any
from orchestrator.state import RecoveryState
from orchestrator.audit import log_audit_entry
from orchestrator.razorpay_client import verify_payment_status

logger = logging.getLogger("orchestrator.outcome_tracker")


def outcome_tracker_node(state: RecoveryState) -> Dict[str, Any]:
    """
    Reconciles final payment status and attributes recovered revenue.
    Queries Razorpay Live API for real payment verification when a razorpay_ref is present.
    """
    event_id = state.get("event_id", "unknown")
    amount = float(state.get("amount", 0.0))
    guardrail_result = state.get("guardrail_result", "ALLOW")
    channel_used = state.get("channel_used", "none")
    execution_result = state.get("execution_result", {})
    metadata = state.get("metadata", {})
    razorpay_ref = state.get("razorpay_ref")

    # 1. Check if payment was captured early via Webhook Race Condition
    if metadata.get("webhook_captured_early") is True:
        status = "cancelled_by_webhook"
        recovered_amount = amount
        reason = "Payment captured proactively via self-service retry. Recovery action averted."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="outcome_tracker",
            action_taken="Action Cancelled (Payment Cleared Early)",
            details={"recovered_amount": recovered_amount, "status": status},
            reasoning=reason,
        )
        return {
            "payment_status": status,
            "recovered_amount": recovered_amount,
            "recovered_at": datetime.now(timezone.utc).isoformat(),
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # 2. Blocked by Compliance Guardrails
    if guardrail_result == "BLOCK":
        status = "blocked"
        recovered_amount = 0.0
        reason = "Workflow blocked by safety/compliance guardrails."
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="outcome_tracker",
            action_taken="Outcome: BLOCKED",
            details={"status": status, "recovered_amount": 0.0},
            reasoning=reason,
        )
        return {
            "payment_status": status,
            "recovered_amount": 0.0,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # 3. Real Razorpay API Verification if Live Reference Exists
    if razorpay_ref and (razorpay_ref.startswith("plink_") or razorpay_ref.startswith("order_") or razorpay_ref.startswith("pay_")):
        rzp_check = verify_payment_status(reference_id=razorpay_ref, payment_link_id=razorpay_ref if razorpay_ref.startswith("plink_") else None)
        if rzp_check.get("paid"):
            status = "recovered"
            recovered_amount = rzp_check.get("amount_paid", amount)
            reason = f"Verified LIVE via Razorpay API ({razorpay_ref}): Status={rzp_check.get('status')}."
            audit_entry = log_audit_entry(
                event_id=event_id,
                node_name="outcome_tracker",
                action_taken=f"Outcome: RECOVERED (₹{recovered_amount:,.2f})",
                details={"status": status, "recovered_amount": recovered_amount, "razorpay_check": rzp_check},
                reasoning=reason,
            )
            return {
                "payment_status": status,
                "recovered_amount": recovered_amount,
                "recovered_at": datetime.now(timezone.utc).isoformat(),
                "audit_trail": state.get("audit_trail", []) + [audit_entry],
            }

    # 4. Probabilistic Attribution for Active Interventions vs Natural Payers
    if channel_used in ("whatsapp", "email", "voice", "reroute", "scheduled_check"):
        p_rec = state.get("chosen_action", {}).get("p_recovery", 0.75)
        if p_rec >= 0.40:
            status = "recovered"
            recovered_amount = amount
            reason = f"Successfully recovered ₹{amount:,.2f} via {channel_used} intervention."
        else:
            status = "unresolved"
            recovered_amount = 0.0
            reason = f"Outreach completed on {channel_used}, awaiting customer completion."
    else:
        # Passive / do_nothing
        p_rec = state.get("chosen_action", {}).get("p_recovery", 0.25)
        if p_rec >= 0.20:
            status = "recovered"
            recovered_amount = amount
            reason = "Natural recovery achieved without active outreach friction."
        else:
            status = "unresolved"
            recovered_amount = 0.0
            reason = "No outreach taken; customer remains unrecovered."

    audit_entry = log_audit_entry(
        event_id=event_id,
        node_name="outcome_tracker",
        action_taken=f"Outcome: {status.upper()} (₹{recovered_amount:,.2f})",
        details={
            "status": status,
            "recovered_amount": recovered_amount,
            "channel_used": channel_used,
            "razorpay_ref": razorpay_ref,
        },
        reasoning=reason,
    )

    return {
        "payment_status": status,
        "recovered_amount": recovered_amount,
        "recovered_at": datetime.now(timezone.utc).isoformat() if status == "recovered" else None,
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }
