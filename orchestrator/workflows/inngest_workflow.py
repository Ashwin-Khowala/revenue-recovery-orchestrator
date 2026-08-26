"""
Inngest Durable Revenue Recovery Workflow
Implements serverless, event-driven durable recovery functions.
"""

import logging
import inngest
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Initialize Inngest client
inngest_client = inngest.Inngest(
    app_id="revenue-recovery-orchestrator",
    logger=logger,
)


@inngest_client.create_function(
    fn_id="durable-revenue-recovery",
    name="Durable Multi-Day Revenue Recovery",
    trigger=inngest.TriggerEvent(event="razorpay/payment.failed"),
)
async def revenue_recovery_inngest_workflow(ctx: inngest.Context, step: inngest.Step) -> Dict[str, Any]:
    """
    Inngest serverless durable workflow for payment recovery.
    """
    event = ctx.event.data

    # Step 1: Memory Enrichment Activity
    enriched_state = await step.run(
        "enrich-memory",
        lambda: _sync_enrich_memory(event),
    )

    # Step 2: Root-Cause Diagnosis
    diagnosed_state = await step.run(
        "diagnose-root-cause",
        lambda: _sync_diagnose(enriched_state),
    )

    # Step 3: Expected Value Policy Scoring
    scored_state = await step.run(
        "score-ev-policy",
        lambda: _sync_score_ev(diagnosed_state),
    )

    # Step 4: Guardrail Verification
    guardrail_state = await step.run(
        "check-guardrails",
        lambda: _sync_guardrails(scored_state),
    )

    # Step 5: Execute Initial Action
    action_type = guardrail_state.get("chosen_action", {}).get("action_type", "do_nothing")
    if action_type != "do_nothing":
        await step.run(
            "execute-recovery-action",
            lambda: _sync_execute(guardrail_state),
        )

    # Step 6: Durable Wait for Payment Captured Webhook (up to 24 hours)
    payment_event = await step.wait_for_event(
        "wait-for-payment-captured",
        event="razorpay/payment.captured",
        timeout="24h",
        if_exp=f"event.data.customer_id == '{event.get('customer_id')}'",
    )

    if payment_event:
        guardrail_state["payment_status"] = "recovered"
        guardrail_state["recovered_amount"] = float(payment_event.data.get("amount", event.get("amount", 0)))
    else:
        # Step 7: Multi-Day Escalation if unpaid
        guardrail_state["payment_status"] = "unresolved"

    # Step 8: Seal Tamper-Evident SHA-256 Audit Entry
    final_state = await step.run(
        "seal-audit-entry",
        lambda: _sync_seal_audit(guardrail_state),
    )

    return final_state


def _sync_enrich_memory(event: Dict[str, Any]) -> Dict[str, Any]:
    from orchestrator.memory.customer_memory import get_customer_profile, get_episodic_history
    from orchestrator.memory.merchant_memory import get_merchant_policy, get_channel_capacity_remaining
    c_id = event.get("customer_id", "cust_0001")
    m_id = event.get("merchant_id", "merch_01")
    e = dict(event)
    e["customer_profile"] = get_customer_profile(c_id)
    e["episodic_history"] = get_episodic_history(c_id, limit=5)
    e["merchant_policy"] = get_merchant_policy(m_id)
    e["channel_capacity"] = get_channel_capacity_remaining(m_id)
    return e


def _sync_diagnose(state: Dict[str, Any]) -> Dict[str, Any]:
    from orchestrator.nodes.root_cause import classify_root_cause
    diff = classify_root_cause(state)  # type: ignore
    s = dict(state)
    s.update(diff)
    return s


def _sync_score_ev(state: Dict[str, Any]) -> Dict[str, Any]:
    from orchestrator.nodes.policy_engine import score_policy_options
    diff = score_policy_options(state)  # type: ignore
    s = dict(state)
    s.update(diff)
    return s


def _sync_guardrails(state: Dict[str, Any]) -> Dict[str, Any]:
    from orchestrator.nodes.guardrails import check_guardrails
    diff = check_guardrails(state)  # type: ignore
    s = dict(state)
    s.update(diff)
    return s


def _sync_execute(state: Dict[str, Any]) -> Dict[str, Any]:
    from orchestrator.nodes.executor import execute_action
    diff = execute_action(state)  # type: ignore
    s = dict(state)
    s.update(diff)
    return s


def _sync_seal_audit(state: Dict[str, Any]) -> Dict[str, Any]:
    from orchestrator.nodes.audit_logger import write_audit_entry
    diff = write_audit_entry(state)  # type: ignore
    s = dict(state)
    s.update(diff)
    return s
