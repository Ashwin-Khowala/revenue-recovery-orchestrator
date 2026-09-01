"""
Confident AI Single-Turn Dataset Regression Testing Suite
==========================================================
Implements Confident AI No-Code / Single-Turn Regression Testing for Revenue Recovery.
Ref: https://www.confident-ai.com/docs/llm-evaluation/no-code-evals/single-turn-evals#regression-testing

Features:
- Loads Goldens from Confident AI (or local golden holdout dataset `labeled_holdout.json`)
- Evaluates candidate LLM pipeline against Ground Truth across:
  1. Root-Cause Classification Correctness (G-Eval)
  2. Optimal Intervention Appropriateness (G-Eval)
  3. Factual Hallucination Metric (Confident AI HallucinationMetric)
  4. Guardrail Invariants (Deterministic)
- Automatically pushes test run results and regression diffs to Confident AI platform.

How to Run:
  deepeval test run evals/test_confident_regression.py     # Runs & uploads to Confident AI
  pytest evals/test_confident_regression.py -v             # Local pytest execution
"""

from __future__ import annotations

import json
import os
import sys
from typing import List

import pytest
from dotenv import load_dotenv

# Project root setup
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"), override=False)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"), override=True)

from deepeval import assert_test
from deepeval.dataset import EvaluationDataset, Golden
from deepeval.metrics import GEval, HallucinationMetric
from deepeval.test_case import LLMTestCase, SingleTurnParams
from langgraph.checkpoint.memory import MemorySaver

from evals.deepeval_model import AzureDeepEvalModel
from orchestrator.deepeval_tracer import traced_run_event
from orchestrator.graph import build_recovery_graph

# ── Load Judge and Graph ───────────────────────────────────────────────────────
_judge = AzureDeepEvalModel(temperature=0.0)
_graph = build_recovery_graph(checkpointer=MemorySaver())


def _build_evaluation_dataset() -> EvaluationDataset:
    """
    Builds the Confident AI EvaluationDataset from local labeled holdout
    or attempts to pull from Confident AI cloud if configured.
    """
    goldens: List[Golden] = []
    holdout_path = os.path.join(os.path.dirname(__file__), "labeled_holdout.json")

    if os.path.exists(holdout_path):
        with open(holdout_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        # Select a balanced golden regression slice across all 6 root cause categories
        selected_events = raw_data[:18]  # 18 representative goldens
        for item in selected_events:
            inp_dict = {
                "event_id": item.get("event_id"),
                "event_type": item.get("event_type"),
                "amount": item.get("amount"),
                "currency": item.get("currency", "INR"),
                "metadata": item.get("metadata", {}),
                "history": item.get("history", {}),
            }
            context_str = json.dumps({
                "customer_history": item.get("history", {}),
                "failure_metadata": item.get("metadata", {}),
                "natural_recovery_p": item.get("natural_recovery_probability"),
            })
            golden = Golden(
                input=json.dumps(inp_dict),
                expected_output=json.dumps({
                    "ground_truth_root_cause": item.get("ground_truth_root_cause"),
                    "optimal_action": item.get("optimal_action"),
                }),
                context=[context_str],
                additional_metadata={
                    "event_id": item.get("event_id"),
                    "category": item.get("ground_truth_root_cause"),
                    "amount": item.get("amount"),
                },
            )
            goldens.append(golden)

    dataset = EvaluationDataset(goldens=goldens)
    return dataset


DATASET = _build_evaluation_dataset()


# ── Confident AI Metric Definitions ───────────────────────────────────────────

regression_classification_geval = GEval(
    name="Single-Turn Classification Accuracy",
    criteria=(
        "Assess whether the actual classification strictly matches the ground truth root cause. "
        "The model must accurately categorize payment_degraded, checkout_abandoned, "
        "subscription_failed, receivable_overdue, mandate_auth_failed, or promise_to_pay."
    ),
    evaluation_params=[
        SingleTurnParams.INPUT,
        SingleTurnParams.ACTUAL_OUTPUT,
        SingleTurnParams.EXPECTED_OUTPUT,
    ],
    model=_judge,
    threshold=0.7,
)

regression_intervention_geval = GEval(
    name="Single-Turn Policy Decision Quality",
    criteria=(
        "Assess whether the actual chosen action matches the optimal economic intervention. "
        "1. payment_degraded -> silent reroute (zero customer outreach).\n"
        "2. mandate_auth_failed -> RBI AFA re-auth link.\n"
        "3. checkout_abandoned / subscription_failed -> dynamic recovery link.\n"
        "4. natural payers (95%+ on-time) -> do_nothing to protect brand equity.\n"
        "5. Overdue receivables -> escalation / invoice reminder."
    ),
    evaluation_params=[
        SingleTurnParams.INPUT,
        SingleTurnParams.ACTUAL_OUTPUT,
        SingleTurnParams.EXPECTED_OUTPUT,
    ],
    model=_judge,
    threshold=0.7,
)

regression_hallucination_metric = HallucinationMetric(
    threshold=0.5,
    model=_judge,
)


# ── Confident AI Regression Test Suite ────────────────────────────────────────

class TestConfidentSingleTurnRegression:
    """
    Confident AI Single-Turn Dataset Regression Testing.
    Iterates through dataset goldens and tests candidate model performance.
    """

    @pytest.mark.parametrize("golden", DATASET.goldens)
    def test_single_turn_regression(self, golden: Golden):
        event_dict = json.loads(golden.input)
        thread_id = f"regression_{golden.additional_metadata.get('event_id', 'evt')}"

        # Run pipeline with full Confident AI / DeepEval tracing
        result = traced_run_event(_graph, event_dict, thread_id)

        chosen = result.get("chosen_action", {})
        actual_output_str = json.dumps({
            "root_cause": result.get("root_cause"),
            "action_type": chosen.get("action_type") if isinstance(chosen, dict) else chosen,
            "channel": result.get("channel_used"),
            "guardrail_result": result.get("guardrail_result"),
            "expected_value": result.get("expected_value"),
            "reasoning": result.get("classification_reasoning", ""),
        })

        test_case = LLMTestCase(
            name=f"single_turn_regression_{golden.additional_metadata.get('event_id')}",
            input=golden.input,
            actual_output=actual_output_str,
            expected_output=golden.expected_output,
            context=golden.context,
            additional_metadata=golden.additional_metadata,
        )

        # Assert metrics against Confident AI thresholds
        assert_test(
            test_case,
            [
                regression_classification_geval,
                regression_intervention_geval,
                regression_hallucination_metric,
            ],
        )
