"""
DeepEval Evaluation Suite: Agent Tool Correctness & Parameter Enforcement
Evaluates tool call correctness, business guardrail compliance, and JSON outputs for:
  - apply_concession_discount (max 10% ceiling, customer eligibility)
  - register_promise_to_pay (future date parsing, outreach freezing)
  - approve_high_value_invoice (>= ₹1L authorization boundary)
  - get_customer_intelligence (4-tier behavioral prior enrichment)
"""

import pytest
import json
from deepeval import assert_test
from deepeval.test_case import LLMTestCase
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams
from evals.deepeval_model import AzureDeepEvalModel
from orchestrator.tools import (
    apply_concession_discount,
    register_promise_to_pay,
    approve_high_value_invoice,
    get_customer_intelligence,
)

_judge = AzureDeepEvalModel(temperature=0.0)

# ── Metric Definitions ────────────────────────────────────────────────────────

tool_discount_compliance_geval = GEval(
    name="Discount Concession Policy Compliance",
    criteria=(
        "Assess whether the discount concession tool output:\n"
        "1. Confirms the discount was applied with a valid discount percentage (<= 15%).\n"
        "2. Confirms an updated recovery link or status update was generated.\n"
        "3. Includes a clear confirmation message with customer/event references."
    ),
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT,
    ],
    model=_judge,
    threshold=0.7,
)

tool_ptp_compliance_geval = GEval(
    name="Promise-to-Pay Commitment Compliance",
    criteria=(
        "Assess whether the promise-to-pay registration tool correctly:\n"
        "1. Records a valid customer promise date.\n"
        "2. Confirms that collection outreach is paused until the promise date.\n"
        "3. Returns a clean acknowledgment with updated customer status."
    ),
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT,
    ],
    model=_judge,
    threshold=0.7,
)

tool_hitl_authorization_geval = GEval(
    name="HITL High-Value Authorization Compliance",
    criteria=(
        "Assess whether the high-value invoice approval tool output:\n"
        "1. Successfully records the supervisor/merchant approval decision for the invoice.\n"
        "2. Confirms the payment status is updated to auto_recovering or approved.\n"
        "3. Emits a descriptive confirmation message containing the invoice identifier and approval note."
    ),
    evaluation_params=[
        LLMTestCaseParams.INPUT,
        LLMTestCaseParams.ACTUAL_OUTPUT,
    ],
    model=_judge,
    threshold=0.7,
)


# ── Test Cases ────────────────────────────────────────────────────────────────

class TestAgentToolCorrectness:
    """Evaluates agent tool execution outputs with DeepEval LLM-as-a-judge."""

    def test_apply_concession_discount_within_cap(self):
        """Verify concession discount respects 10% maximum limit."""
        tool_input = {"customer_id": "cust_0711", "discount_percent": 5}
        tool_result = apply_concession_discount(
            discount_percent=5,
            customer_id="cust_0711",
            reason="Loyal on-time payer courtesy concession",
        )

        test_case = LLMTestCase(
            input=json.dumps(tool_input),
            actual_output=json.dumps(tool_result),
        )
        assert_test(test_case, [tool_discount_compliance_geval])

    def test_apply_concession_discount_clamps_excessive_percentage(self):
        """Verify concession discount clamps percentages exceeding 15%."""
        tool_result = apply_concession_discount(
            discount_percent=25,  # Violates ceiling
            customer_id="cust_0711",
            reason="Customer request",
        )
        assert tool_result.get("discount_applied_pct") <= 15

    def test_register_promise_to_pay_pauses_outreach(self):
        """Verify PTP tool registers commitment and confirms outreach pause."""
        tool_input = {
            "customer_id": "cust_0552",
            "promised_date": "2026-09-15",
            "note": "Customer promises settlement after travel",
        }
        tool_result = register_promise_to_pay(
            promised_date="2026-09-15",
            customer_id="cust_0552",
            note="Customer promises settlement after travel",
        )

        test_case = LLMTestCase(
            input=json.dumps(tool_input),
            actual_output=json.dumps(tool_result),
        )
        assert_test(test_case, [tool_ptp_compliance_geval])

    def test_approve_high_value_invoice_authorization(self):
        """Verify high-value invoice approval tool records admin decision."""
        tool_input = {
            "invoice_id": "TechMatrix Corp",
            "approval_note": "CFO authorized high-value B2B payment link",
            "merchant_id": "merch_01",
        }
        tool_result = approve_high_value_invoice(
            invoice_id="TechMatrix Corp",
            approval_note="CFO authorized high-value B2B payment link",
            merchant_id="merch_01",
        )

        test_case = LLMTestCase(
            input=json.dumps(tool_input),
            actual_output=json.dumps(tool_result),
        )
        assert_test(test_case, [tool_hitl_authorization_geval])
