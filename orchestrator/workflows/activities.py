"""
Durable Workflow Activities for Temporal & Inngest
Executes discrete, idempotent recovery sub-steps with state persistence.
"""

import logging
import os
import sys
from typing import Dict, Any
from temporalio import activity

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from orchestrator.memory.customer_memory import get_customer_profile, get_episodic_history
from orchestrator.memory.merchant_memory import get_merchant_policy, get_channel_capacity_remaining
from orchestrator.nodes import (
    classify_root_cause,
    score_policy_options,
    check_guardrails,
    hitl_escalation,
    execute_action,
)
from orchestrator.audit import log_audit_entry
from orchestrator.state import RecoveryState

logger = logging.getLogger(__name__)


@activity.defn(name="enrich_memory_activity")
async def enrich_memory_activity(event: Dict[str, Any]) -> Dict[str, Any]:
    """Pulls 4-tier behavioral priors (profile, 54k episodic history, merchant policies)."""
    customer_id = event.get("customer_id", "cust_0001")
    merchant_id = event.get("merchant_id", "merch_01")

    profile = get_customer_profile(customer_id)
    episodes = get_episodic_history(customer_id, limit=5)
    merchant_policy = get_merchant_policy(merchant_id)
    channel_capacity = get_channel_capacity_remaining(merchant_id)

    event_copy = dict(event)
    event_copy.update({
        "customer_profile": profile,
        "episodic_history": episodes,
        "merchant_policy": merchant_policy,
        "channel_capacity": channel_capacity,
    })
    return event_copy


@activity.defn(name="diagnose_root_cause_activity")
async def diagnose_root_cause_activity(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Executes rules-first + Azure OpenAI hybrid root-cause classification."""
    state: RecoveryState = state_dict  # type: ignore
    diff = classify_root_cause(state)
    state_copy = dict(state_dict)
    state_copy.update(diff)
    return state_copy


@activity.defn(name="score_policy_activity")
async def score_policy_activity(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Calculates deterministic Expected Value (EV) across interventions including do_nothing."""
    state: RecoveryState = state_dict  # type: ignore
    diff = score_policy_options(state)
    state_copy = dict(state_dict)
    state_copy.update(diff)
    return state_copy


@activity.defn(name="check_guardrails_activity")
async def check_guardrails_activity(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Enforces deterministic financial caps (₹1L threshold, 2-contact max, 24h quiet period)."""
    state: RecoveryState = state_dict  # type: ignore
    diff = check_guardrails(state)
    state_copy = dict(state_dict)
    state_copy.update(diff)
    return state_copy


@activity.defn(name="execute_recovery_action_activity")
async def execute_recovery_action_activity(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Executes chosen recovery action (WhatsApp / Telegram / Email / Silent Gateway Reroute)."""
    state: RecoveryState = state_dict  # type: ignore
    diff = execute_action(state)
    state_copy = dict(state_dict)
    state_copy.update(diff)
    return state_copy


@activity.defn(name="send_hitl_telegram_activity")
async def send_hitl_telegram_activity(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Sends interactive Approve/Reject Telegram alert to merchant admins without LangGraph interrupt."""
    from orchestrator.channels.telegram_bot import send_hitl_alert_to_merchant
    event_id = state_dict.get("event_id", "unknown")
    amount = float(state_dict.get("amount", 0))
    customer_id = state_dict.get("customer_id", "unknown")
    customer_name = state_dict.get("customer_name") or customer_id
    merchant_id = state_dict.get("merchant_id", "merch_01")
    root_cause = state_dict.get("root_cause", "receivable_overdue")

    send_hitl_alert_to_merchant(
        merchant_id=merchant_id,
        event_id=event_id,
        customer_name=customer_name,
        amount=amount,
        root_cause=root_cause,
    )
    state_copy = dict(state_dict)
    state_copy["escalated_to_human"] = True
    return state_copy


@activity.defn(name="seal_audit_entry_activity")
async def seal_audit_entry_activity(state_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Appends state transition and cryptographic SHA-256 hash to audit chain."""
    event_id = state_dict.get("event_id", "unknown")
    action_taken = state_dict.get("chosen_action", {}).get("action_type", "do_nothing")
    
    audit_entry = log_audit_entry(
        event_id=event_id,
        node_name="temporal_recovery_workflow",
        action_taken=action_taken,
        details={
            "payment_status": state_dict.get("payment_status"),
            "recovered_amount": state_dict.get("recovered_amount", 0.0),
            "guardrail_result": state_dict.get("guardrail_result"),
            "channel_used": state_dict.get("channel_used"),
        },
        reasoning=f"Durable workflow executed: status={state_dict.get('payment_status')}",
    )
    
    state_copy = dict(state_dict)
    trail = list(state_copy.get("audit_trail", []))
    trail.append(audit_entry)
    state_copy["audit_trail"] = trail
    return state_copy
