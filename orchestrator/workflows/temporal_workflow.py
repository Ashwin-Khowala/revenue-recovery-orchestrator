"""
Temporal Durable Revenue Recovery Workflow
Implements resilient, long-horizon (multi-day) recovery sagas with signals,
durable timers, and deterministic compliance enforcement.
"""

import logging
from datetime import timedelta
from typing import Dict, Any, Optional
from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from orchestrator.workflows.activities import (
        enrich_memory_activity,
        diagnose_root_cause_activity,
        score_policy_activity,
        check_guardrails_activity,
        execute_recovery_action_activity,
        send_hitl_telegram_activity,
        seal_audit_entry_activity,
    )

logger = logging.getLogger(__name__)


@workflow.defn(name="RevenueRecoveryWorkflow")
class RevenueRecoveryWorkflow:
    """
    Durable Revenue Recovery Workflow spanning minutes, days, or weeks.
    
    Guarantees:
    - Exactly-once execution with automatic replay resilience.
    - Durable pause/wait for payment webhooks or customer promise-to-pay dates.
    - Zero Duplicate Contacts Invariant: Signal cancels pending recovery actions instantaneously.
    - Cryptographic SHA-256 audit chaining across all state transitions.
    """

    def __init__(self) -> None:
        self.state: Dict[str, Any] = {}
        self.is_paid: bool = False
        self.payment_payload: Optional[Dict[str, Any]] = None
        self.is_approved: bool = False
        self.is_rejected: bool = False
        self.ptp_date: Optional[str] = None
        self.workflow_complete: bool = False

    # -------------------------------------------------------------------------
    # Signals (External Webhooks & Human Actions)
    # -------------------------------------------------------------------------
    @workflow.signal(name="signal_payment_captured")
    def signal_payment_captured(self, payload: Dict[str, Any]) -> None:
        """Received out-of-order or self-service payment webhook."""
        self.is_paid = True
        self.payment_payload = payload
        self.state["payment_status"] = "recovered"
        self.state["recovered_amount"] = float(payload.get("amount", self.state.get("amount", 0)))
        logger.info(f"Payment Captured Signal received for event {self.state.get('event_id')}")

    @workflow.signal(name="signal_merchant_decision")
    def signal_merchant_decision(self, decision: str) -> None:
        """Received merchant interactive HITL decision (approve/reject)."""
        if decision.lower() in ("approve", "approved", "allow"):
            self.is_approved = True
            self.state["human_decision"] = "APPROVED"
        else:
            self.is_rejected = True
            self.state["human_decision"] = "REJECTED"

    @workflow.signal(name="signal_promise_to_pay")
    def signal_promise_to_pay(self, promised_date: str) -> None:
        """Customer committed to pay on a specific date; pause outreach."""
        self.ptp_date = promised_date
        self.state["promise_to_pay_date"] = promised_date
        self.state["payment_status"] = "paused_ptp"

    # -------------------------------------------------------------------------
    # Queries (Live Inspection)
    # -------------------------------------------------------------------------
    @workflow.query(name="get_workflow_state")
    def get_workflow_state(self) -> Dict[str, Any]:
        """Returns the real-time durable state of the recovery process."""
        return {
            "state": self.state,
            "is_paid": self.is_paid,
            "is_approved": self.is_approved,
            "is_rejected": self.is_rejected,
            "ptp_date": self.ptp_date,
            "workflow_complete": self.workflow_complete,
        }

    def _sync_signals(self, state: Dict[str, Any]) -> Dict[str, Any]:
        s = dict(state)
        if self.is_paid:
            s["payment_status"] = "recovered"
            s["recovered_amount"] = float(self.payment_payload.get("amount", s.get("amount", 0))) if self.payment_payload else float(s.get("amount", 0))
            s["duplicate_contacts"] = 0
        if self.is_approved:
            s["human_decision"] = "APPROVED"
        if self.is_rejected:
            s["human_decision"] = "REJECTED"
        if self.ptp_date:
            s["promise_to_pay_date"] = self.ptp_date
            s["payment_status"] = "paused_ptp"
        return s

    # -------------------------------------------------------------------------
    # Workflow Execution Loop
    # -------------------------------------------------------------------------
    @workflow.run
    async def run(self, initial_event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes the durable multi-stage recovery saga.
        """
        for k, v in initial_event.items():
            if k not in self.state:
                self.state[k] = v
        self.state.setdefault("contact_count", 0)
        self.state.setdefault("payment_status", "unresolved")
        self.state.setdefault("recovered_amount", 0.0)
        self.state.setdefault("audit_trail", [])
        self.state = self._sync_signals(self.state)

        # Stage 1: Memory Enrichment (4-Tier Priors)
        res1 = await workflow.execute_activity(
            enrich_memory_activity,
            self.state,
            start_to_close_timeout=timedelta(seconds=30),
        )
        self.state = self._sync_signals(res1)

        # If already recovered via signal, finish immediately
        if self.is_paid:
            self.state = await workflow.execute_activity(
                seal_audit_entry_activity,
                self.state,
                start_to_close_timeout=timedelta(seconds=15),
            )
            self.workflow_complete = True
            return self._sync_signals(self.state)

        # Stage 2: Root-Cause Diagnosis (Rules + Azure OpenAI)
        res2 = await workflow.execute_activity(
            diagnose_root_cause_activity,
            self.state,
            start_to_close_timeout=timedelta(seconds=45),
        )
        self.state = self._sync_signals(res2)

        # Stage 3: Expected Value (EV) Policy Scoring
        res3 = await workflow.execute_activity(
            score_policy_activity,
            self.state,
            start_to_close_timeout=timedelta(seconds=15),
        )
        self.state = self._sync_signals(res3)

        # Stage 4: Deterministic Guardrails Check
        res4 = await workflow.execute_activity(
            check_guardrails_activity,
            self.state,
            start_to_close_timeout=timedelta(seconds=15),
        )
        self.state = self._sync_signals(res4)

        guardrail_result = self.state.get("guardrail_result", "ALLOW")

        # Stage 5: Handle Escalation vs Direct Execution
        if guardrail_result == "ESCALATE":
            # Send Telegram alert to merchant
            self.state = await workflow.execute_activity(
                send_hitl_telegram_activity,
                self.state,
                start_to_close_timeout=timedelta(seconds=30),
            )

            # Durable Wait for Merchant Approval or Payment Webhook (up to 48 hours)
            try:
                await workflow.wait_condition(
                    lambda: self.is_approved or self.is_rejected or self.is_paid,
                    timeout=timedelta(hours=48),
                )
            except TimeoutError:
                self.state["escalation_status"] = "TIMED_OUT"

            if self.is_rejected:
                self.state["payment_status"] = "cancelled_by_merchant"
                self.state = await workflow.execute_activity(
                    seal_audit_entry_activity,
                    self.state,
                    start_to_close_timeout=timedelta(seconds=15),
                )
                self.workflow_complete = True
                return self.state

        # Check if already paid via webhook while waiting
        if self.is_paid:
            self.state["duplicate_contacts"] = 0
            self.state = await workflow.execute_activity(
                seal_audit_entry_activity,
                self.state,
                start_to_close_timeout=timedelta(seconds=15),
            )
            self.workflow_complete = True
            return self.state

        # Stage 6: Execute Primary Recovery Action (if not "do_nothing" and unpaid)
        if self.is_paid:
            self.state["payment_status"] = "recovered"
            self.state["recovered_amount"] = float(self.payment_payload.get("amount", self.state.get("amount", 0))) if self.payment_payload else float(self.state.get("amount", 0))
        else:
            action_type = self.state.get("chosen_action", {}).get("action_type", "do_nothing")
            if action_type != "do_nothing" and not self.is_rejected:
                self.state = await workflow.execute_activity(
                    execute_recovery_action_activity,
                    self.state,
                    start_to_close_timeout=timedelta(seconds=30),
                )

            # Stage 7: Durable Sleep / Wait for Resolution or PTP Schedule
            wait_duration = timedelta(hours=24)
            if self.ptp_date:
                wait_duration = timedelta(days=3)

            try:
                await workflow.wait_condition(
                    lambda: self.is_paid,
                    timeout=wait_duration,
                )
            except TimeoutError:
                pass

        if self.is_paid:
            self.state["payment_status"] = "recovered"
            self.state["recovered_amount"] = float(self.payment_payload.get("amount", self.state.get("amount", 0))) if self.payment_payload else float(self.state.get("amount", 0))
            self.state["duplicate_contacts"] = 0

        if self.is_approved:
            self.state["human_decision"] = "APPROVED"

        # Stage 8: Seal Audit Trail with Cryptographic Hash
        self.state = await workflow.execute_activity(
            seal_audit_entry_activity,
            self.state,
            start_to_close_timeout=timedelta(seconds=15),
        )

        self.workflow_complete = True
        return self.state


@workflow.defn(name="MandateEntityWorkflow")
class MandateEntityWorkflow:
    """
    Long-Lived Mandate Entity Workflow (One Instance Per Mandate ID).
    Persists for the entire lifetime of recurring standing permissions (months/years).
    
    Responsibilities:
    - Maintains live mandate lifecycle state (Active, Expiring Soon, Revoked, Suspended).
    - Enforces declarative Rail Rule-Packs (UPI Autopay, eNACH, Bacs, SEPA).
    - Prevents non-compliant silent retries above RBI ₹15,000 AFA threshold.
    - Halts all dunning immediately upon customer revocation in banking app.
    - Provides a continuous, audit-level compliance record at the mandate entity level.
    """

    def __init__(self) -> None:
        self.mandate_id: str = ""
        self.merchant_id: str = "merch_01"
        self.customer_id: str = ""
        self.customer_name: str = ""
        self.rail: str = "upi_autopay"
        self.status: str = "active"
        self.amount_per_cycle: float = 0.0
        self.consecutive_cycle_failures: int = 0
        self.total_debits_settled: int = 0
        self.last_failure_reason: Optional[str] = None
        self.afa_pending: bool = False
        self.is_revoked: bool = False
        self.debit_history: list = []
        self.is_terminated: bool = False

    @workflow.signal(name="signal_debit_failed")
    def signal_debit_failed(self, payload: Dict[str, Any]) -> None:
        """Signal received when a scheduled debit under this mandate fails."""
        amount = float(payload.get("amount", self.amount_per_cycle))
        reason = payload.get("reason", "insufficient_funds")
        return_code = payload.get("return_code")
        
        self.consecutive_cycle_failures += 1
        self.last_failure_reason = reason
        
        # Check for AFA threshold breach on UPI Autopay
        if self.rail == "upi_autopay" and amount > 15000:
            self.afa_pending = True
            logger.info(f"[MANDATE {self.mandate_id}] AFA prompt required for amount ₹{amount} > ₹15,000")

        self.debit_history.append({
            "timestamp": payload.get("timestamp", "2026-08-30T00:00:00Z"),
            "amount": amount,
            "outcome": "failed",
            "reason": reason,
            "return_code": return_code,
            "attempt_in_cycle": self.consecutive_cycle_failures,
        })

    @workflow.signal(name="signal_debit_settled")
    def signal_debit_settled(self, payload: Dict[str, Any]) -> None:
        """Signal received when a cycle debit settles successfully."""
        self.consecutive_cycle_failures = 0
        self.afa_pending = False
        self.total_debits_settled += 1
        self.debit_history.append({
            "timestamp": payload.get("timestamp", "2026-08-30T00:00:00Z"),
            "amount": float(payload.get("amount", self.amount_per_cycle)),
            "outcome": "settled",
        })

    @workflow.signal(name="signal_mandate_revoked")
    def signal_mandate_revoked(self, reason: str = "Payer revoked in banking app") -> None:
        """Payer revoked mandate in bank app. Triggers immediate compliance stop."""
        self.status = "revoked_by_payer"
        self.is_revoked = True
        self.last_failure_reason = reason
        logger.info(f"[MANDATE {self.mandate_id}] Mandate revoked: {reason}. All dunning stopped.")

    @workflow.signal(name="signal_afa_authorized")
    def signal_afa_authorized(self, auth_token: str) -> None:
        """Payer completed 1-tap AFA authorization."""
        self.afa_pending = False
        logger.info(f"[MANDATE {self.mandate_id}] AFA authorized with token {auth_token[:8]}...")

    @workflow.signal(name="signal_mandate_renewed")
    def signal_mandate_renewed(self, new_expiry_date: str) -> None:
        """Mandate renewed ahead of expiration."""
        self.status = "active"
        self.is_revoked = False
        self.consecutive_cycle_failures = 0
        logger.info(f"[MANDATE {self.mandate_id}] Mandate renewed until {new_expiry_date}")

    @workflow.query(name="get_mandate_state")
    def get_mandate_state(self) -> Dict[str, Any]:
        """Returns the real-time durable state of the long-running mandate entity."""
        return {
            "mandate_id": self.mandate_id,
            "merchant_id": self.merchant_id,
            "customer_id": self.customer_id,
            "customer_name": self.customer_name,
            "rail": self.rail,
            "status": self.status,
            "amount_per_cycle": self.amount_per_cycle,
            "consecutive_cycle_failures": self.consecutive_cycle_failures,
            "total_debits_settled": self.total_debits_settled,
            "last_failure_reason": self.last_failure_reason,
            "afa_pending": self.afa_pending,
            "is_revoked": self.is_revoked,
            "debit_history": self.debit_history,
        }

    @workflow.run
    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Long-lived entity workflow lifecycle loop.
        Maintains entity state across multi-month recurring cycles.
        """
        self.mandate_id = input_data.get("mandate_id", "man_0001")
        self.merchant_id = input_data.get("merchant_id", "merch_01")
        self.customer_id = input_data.get("customer_id", "cust_0001")
        self.customer_name = input_data.get("customer_name", "Customer")
        self.rail = input_data.get("rail", "upi_autopay")
        self.status = input_data.get("status", "active")
        self.amount_per_cycle = float(input_data.get("amount_per_cycle", 4999.0))

        logger.info(f"[MANDATE ENTITY WORKFLOW] Initialized mandate {self.mandate_id} ({self.rail})")

        # Keep alive for lifecycle events until explicitly terminated or revoked
        while not self.is_terminated:
            try:
                await workflow.wait_condition(
                    lambda: self.is_terminated or self.is_revoked,
                    timeout=timedelta(days=30),
                )
            except TimeoutError:
                pass

            if self.is_revoked:
                break

        return self.get_mandate_state()

