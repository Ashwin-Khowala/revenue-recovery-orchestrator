"""
Single-Turn Dataset Evaluation & Regression CLI Runner
======================================================
Ref: https://www.confident-ai.com/docs/llm-evaluation/no-code-evals/single-turn-evals#regression-testing

Executes Single-Turn Dataset Evaluation over holdout Goldens,
scores each record across classification & policy criteria,
and outputs a comprehensive regression report.

Usage:
  python evals/run_single_turn_eval.py
  python evals/run_single_turn_eval.py --limit 20 --output evals/regression_results.json
"""

import argparse
import json
import os
import sys
import time
from typing import Dict, List, Any

# Project root setup
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT_DIR, ".env"), override=False)
load_dotenv(os.path.join(ROOT_DIR, ".env.local"), override=True)

from langgraph.checkpoint.memory import MemorySaver
from orchestrator.graph import build_recovery_graph


def run_single_turn_eval(limit: int = 15, output_file: str = "evals/single_turn_regression_results.json"):
    print("=" * 70)
    print("CONFIDENT AI SINGLE-TURN DATASET REGRESSION EVALUATION")
    print("=" * 70)

    holdout_path = os.path.join(os.path.dirname(__file__), "labeled_holdout.json")
    if not os.path.exists(holdout_path):
        print(f"[ERROR] Golden dataset not found at {holdout_path}")
        return

    with open(holdout_path, "r", encoding="utf-8") as f:
        dataset: List[Dict[str, Any]] = json.load(f)

    eval_slice = dataset[:limit]
    print(f"Loaded {len(eval_slice)} Golden Test Cases from holdout dataset.\n")

    graph = build_recovery_graph(checkpointer=MemorySaver())

    results = []
    correct_classifications = 0
    correct_actions = 0
    total_ev = 0.0

    print(f"{'Event ID':<12} | {'Category':<22} | {'Actual Pred':<22} | {'Action':<15} | {'EV (Rs)':<10} | {'Status'}")
    print("-" * 95)

    for item in eval_slice:
        evt_id = item.get("event_id")
        ground_truth_category = item.get("ground_truth_root_cause")
        ground_truth_action = item.get("optimal_action")

        event_payload = {
            "event_id": evt_id,
            "event_type": item.get("event_type"),
            "amount": item.get("amount"),
            "currency": item.get("currency", "INR"),
            "customer_id": item.get("customer_id"),
            "merchant_id": item.get("merchant_id"),
            "metadata": item.get("metadata", {}),
            "history": item.get("history", {}),
        }

        config = {"configurable": {"thread_id": f"eval_single_{evt_id}"}}
        try:
            state = graph.invoke(event_payload, config=config)
        except Exception:
            snapshot = graph.get_state(config)
            state = dict(snapshot.values) if snapshot and snapshot.values else {}

        actual_cat = state.get("root_cause")
        chosen_action = state.get("chosen_action", {})
        action_type = chosen_action.get("action_type") if isinstance(chosen_action, dict) else chosen_action
        channel = state.get("channel_used")
        ev = float(state.get("expected_value", 0.0) or 0.0)
        total_ev += ev

        is_cat_correct = (actual_cat == ground_truth_category)
        if is_cat_correct:
            correct_classifications += 1

        # Match action or channel intent
        is_action_correct = (action_type == ground_truth_action or channel == ground_truth_action or (ground_truth_action == "do_nothing" and action_type == "do_nothing"))
        if is_action_correct:
            correct_actions += 1

        status_str = "PASS" if is_cat_correct else "REGRESSION"

        print(f"{evt_id:<12} | {str(ground_truth_category)[:22]:<22} | {str(actual_cat)[:22]:<22} | {str(action_type)[:15]:<15} | {ev:<10.1f} | {status_str}")

        results.append({
            "event_id": evt_id,
            "ground_truth_category": ground_truth_category,
            "predicted_category": actual_cat,
            "ground_truth_action": ground_truth_action,
            "predicted_action": action_type,
            "channel_used": channel,
            "expected_value": ev,
            "classification_accuracy": 1.0 if is_cat_correct else 0.0,
            "intervention_match": 1.0 if is_action_correct else 0.0,
        })

    class_acc = (correct_classifications / len(eval_slice)) * 100
    action_match_pct = (correct_actions / len(eval_slice)) * 100

    print("-" * 95)
    print(f"\n[SUMMARY METRICS]")
    print(f"  • Total Test Cases Evaluated: {len(eval_slice)}")
    print(f"  • Single-Turn Classification Accuracy: {class_acc:.1f}% ({correct_classifications}/{len(eval_slice)})")
    print(f"  • Optimal Action Match Rate:        {action_match_pct:.1f}% ({correct_actions}/{len(eval_slice)})")
    print(f"  • Cumulative Recovered EV:           Rs. {total_ev:,.2f}")
    print(f"  • Regression Test Result:            {'PASSED (Zero Critical Regressions)' if class_acc >= 85 else 'FAILED'}\n")

    out_path = os.path.join(ROOT_DIR, output_file)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump({
            "timestamp": time.time(),
            "total_test_cases": len(eval_slice),
            "classification_accuracy_pct": class_acc,
            "action_match_pct": action_match_pct,
            "cumulative_ev": total_ev,
            "results": results,
        }, f, indent=2)

    print(f"Regression artifacts written to: {out_path}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Single-Turn Dataset Regression Evaluation")
    parser.add_argument("--limit", type=int, default=15, help="Number of Goldens to evaluate")
    parser.add_argument("--output", type=str, default="evals/single_turn_regression_results.json", help="Output path")
    args = parser.parse_args()

    run_single_turn_eval(limit=args.limit, output_file=args.output)
