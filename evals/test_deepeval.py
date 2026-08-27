"""
DeepEval Test Suite — Revenue Recovery Orchestrator
====================================================
Evaluates the LLM-powered classifier + policy engine using DeepEval
LLM-as-judge metrics. Results are pushed to Confident AI after each run.

HOW TO RUN
----------
  deepeval test run evals/test_deepeval.py              # Runs + uploads to Confident AI
  deepeval test run evals/test_deepeval.py -v           # Verbose output
  pytest evals/test_deepeval.py -v                      # Local-only (no cloud upload)

METRICS
-------
  1. G-Eval (Classification Correctness)  — right root-cause category?
  2. G-Eval (Intervention Appropriateness)— sensible recovery action?
  3. G-Eval (Do-Nothing Awareness)        — protects natural payers?
  4. Hallucination Metric                 — no fabricated facts?
  5. Channel Correctness (deterministic)  — right outreach channel?
  6. Guardrail Enforcement (deterministic)— ESCALATE on high-value events?
"""

from __future__ import annotations

import json
import os
import sys
import pytest

# ── Project root setup (handled by conftest.py, repeated here for safety) ───
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=False)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"), override=True)

from deepeval import assert_test
from deepeval.test_case import LLMTestCase, SingleTurnParams
from deepeval.metrics import GEval, HallucinationMetric

from evals.deepeval_model import AzureDeepEvalModel
from orchestrator.graph import build_recovery_graph
from orchestrator.deepeval_tracer import traced_run_event  # DeepEval tracing
from langgraph.checkpoint.memory import MemorySaver

# ── Shared judge + graph (built once per session) ────────────────────────────

_judge = AzureDeepEvalModel(temperature=0.0)
_graph = build_recovery_graph(checkpointer=MemorySaver())


def _run_event(event: dict, thread_id: str) -> dict:
    """Run event through the orchestrator with full DeepEval tracing."""
    return traced_run_event(_graph, event, thread_id)


# ═══════════════════════════════════════════════════════════════════════════════
# TEST EVENTS — one per root-cause category + edge cases
# ═══════════════════════════════════════════════════════════════════════════════

EVENTS: dict[str, dict] = {
    "payment_degraded": {
        "event_id": "de_evt_001",
        "event_type": "payment_degraded",
        "amount": 8500.0,
        "merchant_id": "merch_03",
        "customer_id": "cust_de_001",
        "customer_name": "Priya Verma",
        "customer_email": "priya@example.com",
        "customer_phone": "+919876543210",
        "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.95, "customer_avg_days_late": 1},
        "metadata": {
            "failure_bank": "HDFC",
            "failure_route": "gateway_hdfc_upi_v2",
            "pct_merchant_failures_same_route": 0.72,
            "error_code": "GATEWAY_TIMEOUT",
        },
        "ground_truth_root_cause": "payment_degraded",
        "expected_channel": "reroute",
    },
    "checkout_abandoned": {
        "event_id": "de_evt_002",
        "event_type": "checkout_abandoned",
        "amount": 3499.0,
        "merchant_id": "merch_01",
        "customer_id": "cust_de_002",
        "customer_name": "Aditya Joshi",
        "customer_email": "aditya@example.com",
        "customer_phone": "+919123456789",
        "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.78, "customer_avg_days_late": 3},
        "metadata": {
            "cart_items": ["Enterprise Plan Monthly"],
            "time_since_abandon_minutes": 30,
            "payment_method_attempted": "card",
        },
        "ground_truth_root_cause": "checkout_abandoned",
        "expected_channel": "whatsapp",
    },
    "subscription_failed": {
        "event_id": "de_evt_003",
        "event_type": "subscription_failed",
        "amount": 1999.0,
        "merchant_id": "merch_02",
        "customer_id": "cust_de_003",
        "customer_name": "Meera Patel",
        "customer_email": "meera@example.com",
        "customer_phone": "+919988776655",
        "history": {"prior_contacts": 1, "prior_payment_success_rate": 0.88, "customer_avg_days_late": 4},
        "metadata": {
            "failure_reason": "card_expired",
            "card_last4": "4242",
            "retry_count": 2,
            "subscription_plan": "Pro Monthly",
        },
        "ground_truth_root_cause": "subscription_failed",
        "expected_channel": "whatsapp",
    },
    "receivable_overdue": {
        "event_id": "de_evt_004",
        "event_type": "receivable_overdue",
        "amount": 75000.0,
        "merchant_id": "merch_04",
        "customer_id": "cust_de_004",
        "customer_name": "Rajesh Industries",
        "customer_email": "ap@rajeshindustries.com",
        "customer_phone": "+919876500000",
        "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.65, "customer_avg_days_late": 12},
        "metadata": {"invoice_number": "INV-2026-0587", "net_terms_days": 30, "days_overdue": 15},
        "ground_truth_root_cause": "receivable_overdue",
        "expected_channel": "whatsapp",
    },
    "natural_payer_do_nothing": {
        "event_id": "de_evt_005",
        "event_type": "receivable_overdue",
        "amount": 5000.0,
        "merchant_id": "merch_01",
        "customer_id": "cust_de_005",
        "customer_name": "Reliable Corp",
        "customer_email": "finance@reliablecorp.com",
        "customer_phone": "+919876501234",
        "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.97, "customer_avg_days_late": 1},
        "metadata": {"invoice_number": "INV-2026-0601", "net_terms_days": 30, "days_overdue": 2},
        "ground_truth_root_cause": "receivable_overdue",
        "expected_action": "do_nothing",
    },
    "mandate_auth_failed": {
        "event_id": "de_evt_006",
        "event_type": "mandate_auth_failed",
        "amount": 25000.0,
        "merchant_id": "merch_05",
        "customer_id": "cust_de_006",
        "customer_name": "Kavita Singh",
        "customer_email": "kavita@example.com",
        "customer_phone": "+919876543299",
        "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.91, "customer_avg_days_late": 0},
        "metadata": {"afa_step_reached": False, "mandate_type": "e-mandate", "bank": "SBI"},
        "ground_truth_root_cause": "mandate_auth_failed",
        "expected_channel": "whatsapp",
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# METRIC DEFINITIONS — defined once, reused across parametrized tests
# ═══════════════════════════════════════════════════════════════════════════════

classification_correctness = GEval(
    name="Classification Correctness",
    criteria=(
        "Determine whether the actual_output correctly identifies the root cause "
        "category for the given payment/revenue recovery event. The root cause "
        "must match the expected_output exactly. Classification must align with "
        "the event metadata signals."
    ),
    evaluation_params=[
        SingleTurnParams.INPUT,
        SingleTurnParams.ACTUAL_OUTPUT,
        SingleTurnParams.EXPECTED_OUTPUT,
    ],
    model=_judge,
    threshold=0.7,
)

intervention_appropriateness = GEval(
    name="Intervention Appropriateness",
    criteria=(
        "Evaluate whether the chosen recovery intervention is appropriate:\n"
        "1. payment_degraded: MUST use silent reroute; NEVER contact customer.\n"
        "2. mandate_auth_failed: MUST send RBI AFA consent link.\n"
        "3. checkout_abandoned: Send quick payment link within recovery window.\n"
        "4. subscription_failed: Send card update or retry payment link.\n"
        "5. receivable_overdue: Send B2B invoice reminder if poor history, "
        "or prefer do_nothing if customer is a reliable natural payer (95%+ on-time).\n"
        "6. Any action must have net positive expected value (EV > 0)."
    ),
    evaluation_params=[
        SingleTurnParams.INPUT,
        SingleTurnParams.ACTUAL_OUTPUT,
    ],
    model=_judge,
    threshold=0.7,
)

do_nothing_awareness = GEval(
    name="Do-Nothing Awareness",
    criteria=(
        "The orchestrator MUST correctly identify that a customer with 95%+ on-time "
        "payment history who is only 1-2 days late should receive 'do_nothing' as the "
        "highest-EV intervention. Contacting this customer causes brand damage. "
        "The actual_output must show 'do_nothing' was selected."
    ),
    evaluation_params=[
        SingleTurnParams.INPUT,
        SingleTurnParams.ACTUAL_OUTPUT,
        SingleTurnParams.EXPECTED_OUTPUT,
    ],
    model=_judge,
    threshold=0.7,
)

hallucination_metric = HallucinationMetric(
    threshold=0.5,
    model=_judge,
)


# ═══════════════════════════════════════════════════════════════════════════════
# TEST CLASSES — named to match deepeval test run conventions
# ═══════════════════════════════════════════════════════════════════════════════


class TestClassificationCorrectness:
    """G-Eval: Does the classifier identify the right root cause?"""

    @pytest.mark.parametrize("category", [
        "payment_degraded",
        "checkout_abandoned",
        "subscription_failed",
        "receivable_overdue",
        "mandate_auth_failed",
    ])
    def test_root_cause_classification(self, category: str) -> None:
        event = EVENTS[category]
        result = _run_event(event, f"deepeval_classify_{category}")

        test_case = LLMTestCase(
            name=f"root_cause_classification_{category}",
            input=json.dumps({
                "event_type": event["event_type"],
                "amount": event["amount"],
                "metadata": event.get("metadata", {}),
                "history": event.get("history", {}),
            }),
            actual_output=json.dumps({
                "root_cause": result.get("root_cause"),
                "confidence": result.get("confidence"),
                "reasoning": result.get("classification_reasoning", ""),
            }),
            expected_output=event["ground_truth_root_cause"],
        )
        assert_test(test_case, [classification_correctness])


class TestInterventionAppropriateness:
    """G-Eval: Are the generated recovery actions sensible?"""

    @pytest.mark.parametrize("category", [
        "payment_degraded",
        "checkout_abandoned",
        "subscription_failed",
        "receivable_overdue",
        "mandate_auth_failed",
    ])
    def test_intervention_quality(self, category: str) -> None:
        event = EVENTS[category]
        result = _run_event(event, f"deepeval_intervention_{category}")

        chosen = result.get("chosen_action", {})
        test_case = LLMTestCase(
            name=f"intervention_quality_{category}",
            input=json.dumps({
                "root_cause": result.get("root_cause"),
                "event_type": event["event_type"],
                "amount": event["amount"],
                "customer_history": event.get("history", {}),
            }),
            actual_output=json.dumps({
                "action_type":      chosen.get("action_type"),
                "channel":          result.get("channel_used"),
                "expected_value":   result.get("expected_value"),
                "guardrail_result": result.get("guardrail_result"),
                "description":      chosen.get("description", ""),
            }),
        )
        assert_test(test_case, [intervention_appropriateness])


class TestDoNothingAwareness:
    """G-Eval: Does the orchestrator protect natural payers?"""

    def test_natural_payer_gets_do_nothing(self) -> None:
        event = EVENTS["natural_payer_do_nothing"]
        result = _run_event(event, "deepeval_do_nothing")

        chosen = result.get("chosen_action", {})
        test_case = LLMTestCase(
            name="natural_payer_do_nothing",
            input=json.dumps({
                "event_type":       event["event_type"],
                "amount":           event["amount"],
                "customer_history": event["history"],
                "days_overdue":     event["metadata"]["days_overdue"],
            }),
            actual_output=json.dumps({
                "action_type":    chosen.get("action_type"),
                "channel":        result.get("channel_used"),
                "expected_value": result.get("expected_value"),
            }),
            expected_output="do_nothing",
        )
        assert_test(test_case, [do_nothing_awareness])


class TestHallucination:
    """Does the classifier fabricate facts not in the event context?"""

    @pytest.mark.parametrize("category", [
        "checkout_abandoned",
        "subscription_failed",
    ])
    def test_no_hallucination(self, category: str) -> None:
        event = EVENTS[category]
        result = _run_event(event, f"deepeval_hallucination_{category}")

        event_context = json.dumps({
            "event_type": event["event_type"],
            "amount":     event["amount"],
            "metadata":   event.get("metadata", {}),
            "history":    event.get("history", {}),
        })

        reasoning = result.get("classification_reasoning", "")
        chosen = result.get("chosen_action", {})
        actual = (
            f"Root cause: {result.get('root_cause')}. "
            f"Reasoning: {reasoning}. "
            f"Action: {chosen.get('action_type')}. "
            f"Description: {chosen.get('description', '')}."
        )

        test_case = LLMTestCase(
            name=f"hallucination_{category}",
            input=event_context,
            actual_output=actual,
            context=[event_context],
        )
        assert_test(test_case, [hallucination_metric])


class TestChannelSelection:
    """Deterministic: correct outreach channel for each root cause."""

    @pytest.mark.parametrize("category,expected_channel", [
        ("payment_degraded",   "reroute"),
        ("checkout_abandoned", "whatsapp"),
        ("mandate_auth_failed","whatsapp"),
    ])
    def test_channel_correctness(self, category: str, expected_channel: str) -> None:
        event = EVENTS[category]
        result = _run_event(event, f"deepeval_channel_{category}")
        actual_channel = result.get("channel_used", "none")
        assert actual_channel == expected_channel, (
            f"Expected channel '{expected_channel}' for {category}, "
            f"got '{actual_channel}'"
        )


class TestGuardrailEnforcement:
    """Verify financial guardrail invariants."""

    def test_high_amount_escalation(self) -> None:
        """Amount >= Rs 1,00,000 MUST trigger ESCALATE guardrail."""
        event = {
            "event_id": "de_evt_escalate",
            "event_type": "receivable_overdue",
            "amount": 150000.0,
            "merchant_id": "merch_04",
            "customer_id": "cust_de_escalate",
            "customer_name": "BigCorp Ltd",
            "customer_email": "ar@bigcorp.com",
            "customer_phone": "+919876500001",
            "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.55, "customer_avg_days_late": 20},
            "metadata": {"invoice_number": "INV-2026-9999", "net_terms_days": 30, "days_overdue": 25},
        }
        result = _run_event(event, "deepeval_escalation")
        assert result.get("guardrail_result") == "ESCALATE", (
            f"Expected ESCALATE for Rs {event['amount']:,.0f}, got {result.get('guardrail_result')}"
        )

    def test_max_contact_enforcement(self) -> None:
        """prior_contacts = 2 MUST block further outreach."""
        event = {
            "event_id": "de_evt_maxcontact",
            "event_type": "subscription_failed",
            "amount": 999.0,
            "merchant_id": "merch_01",
            "customer_id": "cust_de_maxcontact",
            "customer_name": "Overcontacted User",
            "customer_email": "over@example.com",
            "customer_phone": "+919876500002",
            "history": {"prior_contacts": 2, "prior_payment_success_rate": 0.75, "customer_avg_days_late": 5},
            "metadata": {"failure_reason": "insufficient_funds", "retry_count": 3},
        }
        result = _run_event(event, "deepeval_maxcontact")
        assert result.get("guardrail_result") == "ESCALATE", (
            f"Expected ESCALATE for max contact limit, got {result.get('guardrail_result')}"
        )
        assert result.get("channel_used") in (None, "none", "reroute"), (
            f"Channel was executed despite max contact guardrail: {result.get('channel_used')}"
        )
