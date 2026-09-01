"""
Unit & Integration Tests for Temporal Durable Execution Engine
Uses Temporal's in-memory time-skipping WorkflowEnvironment.
"""

import asyncio
import os
import sys
import pytest
from datetime import timedelta

# Disable remote DB during testing
os.environ["DISABLE_AUDIT_DB"] = "true"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker, UnsandboxedWorkflowRunner

from orchestrator.workflows.temporal_workflow import RevenueRecoveryWorkflow
from orchestrator.workflows.activities import (
    enrich_memory_activity,
    diagnose_root_cause_activity,
    score_policy_activity,
    check_guardrails_activity,
    execute_recovery_action_activity,
    send_hitl_telegram_activity,
    seal_audit_entry_activity,
)


@pytest.mark.asyncio
async def test_temporal_durable_workflow_standard_flow():
    """Tests normal workflow execution with in-memory time skipping."""
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(
            env.client,
            task_queue="revenue-recovery-queue",
            workflows=[RevenueRecoveryWorkflow],
            activities=[
                enrich_memory_activity,
                diagnose_root_cause_activity,
                score_policy_activity,
                check_guardrails_activity,
                execute_recovery_action_activity,
                send_hitl_telegram_activity,
                seal_audit_entry_activity,
            ],
            workflow_runner=UnsandboxedWorkflowRunner(),
        ):
            event = {
                "event_id": "test_temporal_001",
                "event_type": "payment.failed",
                "amount": 4999.0,
                "currency": "INR",
                "customer_id": "cust_0001",
                "merchant_id": "merch_01",
                "razorpay_ref": "pay_temp_001",
                "history": {"prior_payment_success_rate": 0.85},
                "metadata": {"decline_code": "insufficient_funds"},
            }

            handle = await env.client.start_workflow(
                RevenueRecoveryWorkflow.run,
                event,
                id="workflow_test_001",
                task_queue="revenue-recovery-queue",
                start_signal="signal_payment_captured",
                start_signal_args=[{"amount": 4999.0, "razorpay_payment_id": "pay_captured_123"}],
            )

            result = await handle.result()
            print("Temporal Workflow Execution Result:", result.get("payment_status"), "Recovered:", result.get("recovered_amount"))

            assert result is not None
            assert result.get("payment_status") == "recovered"
            assert result.get("recovered_amount") == 4999.0
            print("[PASS] Test 1 Passed: Temporal workflow executed with payment captured signal!")


@pytest.mark.asyncio
async def test_temporal_hitl_escalation_and_approval():
    """Tests high-value incident (>= ₹1L) requiring merchant approval signal."""
    async with await WorkflowEnvironment.start_time_skipping() as env:
        async with Worker(
            env.client,
            task_queue="revenue-recovery-queue",
            workflows=[RevenueRecoveryWorkflow],
            activities=[
                enrich_memory_activity,
                diagnose_root_cause_activity,
                score_policy_activity,
                check_guardrails_activity,
                execute_recovery_action_activity,
                send_hitl_telegram_activity,
                seal_audit_entry_activity,
            ],
            workflow_runner=UnsandboxedWorkflowRunner(),
        ):
            import uuid
            high_value_event = {
                "event_id": f"test_temporal_high_val_{uuid.uuid4().hex[:6]}",
                "event_type": "invoice.overdue",
                "amount": 145000.0,  # Exceeds ₹1,00,000 threshold
                "currency": "INR",
                "customer_id": f"cust_temp_hitl_{uuid.uuid4().hex[:6]}",
                "merchant_id": "merch_01",
                "razorpay_ref": "inv_high_001",
                "history": {"prior_payment_success_rate": 0.40},
                "metadata": {"days_overdue": 15},
            }

            handle = await env.client.start_workflow(
                RevenueRecoveryWorkflow.run,
                high_value_event,
                id="workflow_test_hitl",
                task_queue="revenue-recovery-queue",
                start_signal="signal_merchant_decision",
                start_signal_args=["APPROVE"],
            )

            result = await handle.result()
            print("Temporal HITL Execution Result:", result.get("guardrail_result"), "Decision:", result.get("human_decision"))

            assert result is not None
            assert result.get("guardrail_result") == "ESCALATE"
            assert result.get("human_decision") == "APPROVED"
            print("[PASS] Test 2 Passed: High-value HITL escalation & approval signal verified in Temporal!")


if __name__ == "__main__":
    asyncio.run(test_temporal_durable_workflow_standard_flow())
    asyncio.run(test_temporal_hitl_escalation_and_approval())
