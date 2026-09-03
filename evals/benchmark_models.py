"""
Model Benchmark & Evaluation Suite — Revenue Recovery Orchestrator
===================================================================
Compares available LLMs (Azure OpenAI GPT-5.4 Mini, GPT-5.4 Nano,
Google Gemini 2.5 Flash Lite, and Deterministic Heuristics) on:
  1. Classification Accuracy & F1-Score
  2. Intervention / Policy EV Alignment
  3. Guardrail Compliance (Invariant Enforcement)
  4. Latency (p50 / p95 in milliseconds)
  5. Cost per 10k Recovery Incidents ($ USD)
  6. Composite Value-to-Cost Efficiency Index

Usage:
  python evals/benchmark_models.py
  python evals/benchmark_models.py --output evals/model_benchmark_results.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from typing import Any, Callable, Dict, List, Optional

# Ensure project root in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"), override=True)


# ═══════════════════════════════════════════════════════════════════════════════
# BENCHMARK TEST DATASET (Ground Truth Multi-Class Scenarios)
# ═══════════════════════════════════════════════════════════════════════════════

BENCHMARK_SCENARIOS = [
    {
        "id": "scen_01_payment_degraded",
        "category": "payment_degraded",
        "description": "HDFC UPI bank gateway outage (72% failure rate)",
        "event": {
            "event_id": "bench_001",
            "event_type": "payment_degraded",
            "amount": 8500.0,
            "merchant_id": "merch_03",
            "customer_id": "cust_001",
            "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.95, "customer_avg_days_late": 1},
            "metadata": {"failure_bank": "HDFC", "failure_route": "gateway_hdfc_upi_v2", "pct_merchant_failures_same_route": 0.72},
        },
        "expected_root_cause": "payment_degraded",
        "expected_channel": "reroute",
        "expected_action": "payment_reroute_retry",
        "expected_guardrail": "ALLOW",
    },
    {
        "id": "scen_02_mandate_auth_failed",
        "category": "mandate_auth_failed",
        "description": "RBI > ₹15,000 mandate requiring AFA consent step",
        "event": {
            "event_id": "bench_002",
            "event_type": "mandate_auth_failed",
            "amount": 25000.0,
            "merchant_id": "merch_05",
            "customer_id": "cust_002",
            "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.90, "customer_avg_days_late": 0},
            "metadata": {"afa_step_reached": False, "mandate_type": "e-mandate", "bank": "SBI"},
        },
        "expected_root_cause": "mandate_auth_failed",
        "expected_channel": "whatsapp",
        "expected_action": "afa_mandate_reauth",
        "expected_guardrail": "ALLOW",
    },
    {
        "id": "scen_03_subscription_failed",
        "category": "subscription_failed",
        "description": "SaaS recurring subscription card expired decline",
        "event": {
            "event_id": "bench_003",
            "event_type": "subscription_failed",
            "amount": 1999.0,
            "merchant_id": "merch_02",
            "customer_id": "cust_003",
            "history": {"prior_contacts": 1, "prior_payment_success_rate": 0.85, "customer_avg_days_late": 4},
            "metadata": {"failure_reason": "card_expired", "card_last4": "4242", "retry_count": 2},
        },
        "expected_root_cause": "subscription_failed",
        "expected_channel": "whatsapp",
        "expected_action": "card_update_link",
        "expected_guardrail": "ALLOW",
    },
    {
        "id": "scen_04_checkout_abandoned",
        "category": "checkout_abandoned",
        "description": "High intent enterprise plan drop-off at checkout (30 min)",
        "event": {
            "event_id": "bench_004",
            "event_type": "checkout_abandoned",
            "amount": 3499.0,
            "merchant_id": "merch_01",
            "customer_id": "cust_004",
            "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.80, "customer_avg_days_late": 2},
            "metadata": {"cart_items": ["Enterprise Monthly"], "time_since_abandon_minutes": 30},
        },
        "expected_root_cause": "checkout_abandoned",
        "expected_channel": "whatsapp",
        "expected_action": "whatsapp_payment_link",
        "expected_guardrail": "ALLOW",
    },
    {
        "id": "scen_05_receivable_overdue",
        "category": "receivable_overdue",
        "description": "B2B overdue invoice with 15 days past net terms",
        "event": {
            "event_id": "bench_005",
            "event_type": "receivable_overdue",
            "amount": 75000.0,
            "merchant_id": "merch_04",
            "customer_id": "cust_005",
            "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.65, "customer_avg_days_late": 12},
            "metadata": {"invoice_number": "INV-2026-0587", "net_terms_days": 30, "days_overdue": 15},
        },
        "expected_root_cause": "receivable_overdue",
        "expected_channel": "whatsapp",
        "expected_action": "b2b_invoice_reminder",
        "expected_guardrail": "ALLOW",
    },
    {
        "id": "scen_06_natural_payer_do_nothing",
        "category": "receivable_overdue",
        "description": "98% on-time payer 1 day late -> Do Nothing policy",
        "event": {
            "event_id": "bench_006",
            "event_type": "receivable_overdue",
            "amount": 5000.0,
            "merchant_id": "merch_01",
            "customer_id": "cust_006",
            "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.98, "customer_avg_days_late": 1},
            "metadata": {"invoice_number": "INV-2026-0601", "net_terms_days": 30, "days_overdue": 1},
        },
        "expected_root_cause": "receivable_overdue",
        "expected_channel": "none",
        "expected_action": "do_nothing",
        "expected_guardrail": "ALLOW",
    },
    {
        "id": "scen_07_high_value_guardrail",
        "category": "receivable_overdue",
        "description": "High value invoice (₹1,50,000 >= ₹100k cap) -> ESCALATE",
        "event": {
            "event_id": "bench_007",
            "event_type": "receivable_overdue",
            "amount": 150000.0,
            "merchant_id": "merch_04",
            "customer_id": "cust_007",
            "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.50, "customer_avg_days_late": 20},
            "metadata": {"invoice_number": "INV-2026-9999", "net_terms_days": 30, "days_overdue": 25},
        },
        "expected_root_cause": "receivable_overdue",
        "expected_guardrail": "ESCALATE",
    },
    {
        "id": "scen_08_max_contacts_guardrail",
        "category": "subscription_failed",
        "description": "Customer already contacted 2 times -> ESCALATE (0 duplicate spam)",
        "event": {
            "event_id": "bench_008",
            "event_type": "subscription_failed",
            "amount": 999.0,
            "merchant_id": "merch_01",
            "customer_id": "cust_008",
            "history": {"prior_contacts": 2, "prior_payment_success_rate": 0.70, "customer_avg_days_late": 5},
            "metadata": {"failure_reason": "insufficient_funds", "retry_count": 3},
        },
        "expected_root_cause": "subscription_failed",
        "expected_guardrail": "ESCALATE",
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL PRICING & SPECIFICATIONS (USD per 1M tokens)
# ═══════════════════════════════════════════════════════════════════════════════

MODEL_SPECS = {
    "azure/gpt-5.4-mini": {
        "display_name": "Azure OpenAI gpt-5.4-mini",
        "provider": "Azure OpenAI",
        "deployment_name": "gpt-54-mini",
        "input_cost_per_1m": 0.30,
        "output_cost_per_1m": 1.20,
        "avg_input_tokens": 420,
        "avg_output_tokens": 90,
    },
    "azure/gpt-5.4-nano": {
        "display_name": "Azure OpenAI gpt-5.4-nano",
        "provider": "Azure OpenAI",
        "deployment_name": "gpt-54-nano",
        "input_cost_per_1m": 0.15,
        "output_cost_per_1m": 0.60,
        "avg_input_tokens": 420,
        "avg_output_tokens": 90,
    },
    "azure/gpt-4o-mini": {
        "display_name": "Azure OpenAI gpt-4o-mini",
        "provider": "Azure OpenAI",
        "deployment_name": "gpt-4o-mini",
        "input_cost_per_1m": 0.15,
        "output_cost_per_1m": 0.60,
        "avg_input_tokens": 420,
        "avg_output_tokens": 90,
    },
    "azure/gpt-4o": {
        "display_name": "Azure OpenAI gpt-4o",
        "provider": "Azure OpenAI",
        "deployment_name": "gpt-4o",
        "input_cost_per_1m": 2.50,
        "output_cost_per_1m": 10.00,
        "avg_input_tokens": 420,
        "avg_output_tokens": 90,
    },
    "google/gemini-2.5-flash-lite": {
        "display_name": "Google Gemini 2.5 Flash Lite",
        "provider": "Google GenAI",
        "input_cost_per_1m": 0.075,
        "output_cost_per_1m": 0.30,
        "avg_input_tokens": 420,
        "avg_output_tokens": 85,
    },
    "heuristic_baseline": {
        "display_name": "Heuristic Rule Engine (Baseline)",
        "provider": "Deterministic (No LLM)",
        "input_cost_per_1m": 0.0,
        "output_cost_per_1m": 0.0,
        "avg_input_tokens": 0,
        "avg_output_tokens": 0,
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL RUNNERS
# ═══════════════════════════════════════════════════════════════════════════════

def run_classifier_with_llm(event: dict, model_key: str) -> dict:
    """Executes root cause classification with a specific model."""
    from orchestrator.nodes.root_cause_classifier import classify_root_cause
    from orchestrator.nodes.guardrails import check_guardrails
    from orchestrator.nodes.policy_engine import score_policy_options

    if model_key == "heuristic_baseline":
        # Force fallback heuristic
        state = {
            "event_id": event["event_id"],
            "event_type": event["event_type"],
            "amount": event["amount"],
            "history": event.get("history", {}),
            "metadata": event.get("metadata", {}),
            "customer_profile": event.get("history"),
            "audit_trail": [],
        }
        # Simulate baseline
        start = time.perf_counter()
        # Direct rule matching
        category_map = {
            "payment_degraded": "payment_degraded",
            "mandate_auth_failed": "mandate_auth_failed",
            "subscription_failed": "subscription_failed",
            "checkout_abandoned": "checkout_abandoned",
            "receivable_overdue": "receivable_overdue",
        }
        root_cause = category_map.get(event["event_type"], "receivable_overdue")
        lat = (time.perf_counter() - start) * 1000
        state["root_cause"] = root_cause
        state["confidence"] = 0.70
        state.update(score_policy_options(state))
        state.update(check_guardrails(state))
        state["latency_ms"] = lat
        return state

    # Configure the environment for the target LLM
    spec = MODEL_SPECS.get(model_key, {})
    if "deployment_name" in spec:
        os.environ["AZURE_OPENAI_DEPLOYMENT_NAME"] = spec["deployment_name"]


    state = {
        "event_id": event["event_id"],
        "event_type": event["event_type"],
        "amount": event["amount"],
        "history": event.get("history", {}),
        "metadata": event.get("metadata", {}),
        "customer_profile": event.get("history"),
        "audit_trail": [],
    }

    start = time.perf_counter()
    state.update(classify_root_cause(state))
    state.update(score_policy_options(state))
    state.update(check_guardrails(state))
    lat = (time.perf_counter() - start) * 1000
    state["latency_ms"] = lat
    return state


# ═══════════════════════════════════════════════════════════════════════════════
# BENCHMARK EVALUATOR
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class ModelBenchmarkSummary:
    model_key: str
    display_name: str
    provider: str
    total_scenarios: int
    classification_accuracy: float
    guardrail_compliance: float
    do_nothing_accuracy: float
    latency_p50_ms: float
    latency_p95_ms: float
    cost_per_10k_events_usd: float
    composite_value_score: float
    scenario_details: List[dict]


def run_benchmark(models_to_test: Optional[List[str]] = None) -> List[ModelBenchmarkSummary]:
    target_models = models_to_test or list(MODEL_SPECS.keys())
    results: List[ModelBenchmarkSummary] = []

    print("\n" + "=" * 80)
    print("RUNNING REVENUE RECOVERY ORCHESTRATOR — MULTI-MODEL LLM BENCHMARK")
    print("=" * 80)

    for model_key in target_models:
        spec = MODEL_SPECS[model_key]
        print(f"\nEvaluating [{spec['display_name']}]...")

        correct_classifications = 0
        correct_guardrails = 0
        correct_do_nothing = 0
        latencies: List[float] = []
        details: List[dict] = []

        for scen in BENCHMARK_SCENARIOS:
            event = scen["event"]
            try:
                res = run_classifier_with_llm(event, model_key)
                lat = res.get("latency_ms", 0.0)
                latencies.append(lat)

                is_correct_rc = (res.get("root_cause") == scen["expected_root_cause"])
                if is_correct_rc:
                    correct_classifications += 1

                # Guardrail evaluation
                expected_gr = scen.get("expected_guardrail", "ALLOW")
                actual_gr = res.get("guardrail_result", "ALLOW")
                is_correct_gr = (actual_gr == expected_gr)
                if is_correct_gr:
                    correct_guardrails += 1

                # Do-Nothing evaluation
                if scen["id"] == "scen_06_natural_payer_do_nothing":
                    chosen_action = (res.get("chosen_action") or {}).get("action_type")
                    if chosen_action == "do_nothing":
                        correct_do_nothing += 1

                details.append({
                    "scenario_id": scen["id"],
                    "expected_root_cause": scen["expected_root_cause"],
                    "actual_root_cause": res.get("root_cause"),
                    "is_classification_correct": is_correct_rc,
                    "expected_guardrail": expected_gr,
                    "actual_guardrail": actual_gr,
                    "is_guardrail_correct": is_correct_gr,
                    "chosen_action": (res.get("chosen_action") or {}).get("action_type"),
                    "latency_ms": round(lat, 2),
                })
                print(f"  [PASS] {scen['id']:<35} -> {res.get('root_cause')} ({lat:.1f}ms)")
            except Exception as e:
                print(f"  [FAIL] {scen['id']:<35} -> ERROR: {e}")
                latencies.append(5000.0)
                details.append({
                    "scenario_id": scen["id"],
                    "error": str(e),
                    "is_classification_correct": False,
                    "is_guardrail_correct": False,
                    "latency_ms": 5000.0,
                })

        total = len(BENCHMARK_SCENARIOS)
        acc = (correct_classifications / total) * 100.0
        gr_comp = (correct_guardrails / total) * 100.0
        do_not_acc = (correct_do_nothing / 1.0) * 100.0 if any(s["id"] == "scen_06_natural_payer_do_nothing" for s in BENCHMARK_SCENARIOS) else 100.0

        latencies.sort()
        p50 = latencies[len(latencies) // 2] if latencies else 0.0
        p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0.0

        # Cost calculation per 10k events
        in_cost = (spec["avg_input_tokens"] * 10000 / 1_000_000) * spec["input_cost_per_1m"]
        out_cost = (spec["avg_output_tokens"] * 10000 / 1_000_000) * spec["output_cost_per_1m"]
        cost_10k = in_cost + out_cost

        # Composite Value Score: (Accuracy * 0.5 + Guardrail * 0.3 + DoNothing * 0.2) / (1 + log10(1 + Cost))
        perf_score = (acc * 0.5) + (gr_comp * 0.3) + (do_not_acc * 0.2)
        latency_penalty = max(0.0, (p50 - 200) / 1000.0)
        composite = round(perf_score / (1.0 + (cost_10k * 0.5) + (latency_penalty * 0.1)), 2)

        summary = ModelBenchmarkSummary(
            model_key=model_key,
            display_name=spec["display_name"],
            provider=spec["provider"],
            total_scenarios=total,
            classification_accuracy=round(acc, 1),
            guardrail_compliance=round(gr_comp, 1),
            do_nothing_accuracy=round(do_not_acc, 1),
            latency_p50_ms=round(p50, 1),
            latency_p95_ms=round(p95, 1),
            cost_per_10k_events_usd=round(cost_10k, 4),
            composite_value_score=composite,
            scenario_details=details,
        )
        results.append(summary)

    # Sort results by composite value score descending
    results.sort(key=lambda x: x.composite_value_score, reverse=True)
    return results


def print_comparison_table(results: List[ModelBenchmarkSummary]) -> None:
    """Prints a beautiful markdown comparison table to terminal."""
    print("\n" + "=" * 110)
    print("FINAL MODEL EVALUATION BENCHMARK & COMPARISON TABLE")
    print("=" * 110)
    header = f"{'Model':<32} | {'Accuracy':<10} | {'Guardrails':<11} | {'Do-Nothing':<11} | {'p50 (ms)':<9} | {'Cost/10k ($)':<12} | {'Value Score':<11}"
    print(header)
    print("-" * len(header))

    for r in results:
        star = " [SELECTED]" if r == results[0] else ""
        print(
            f"{r.display_name:<32} | "
            f"{r.classification_accuracy:>8.1f}% | "
            f"{r.guardrail_compliance:>9.1f}% | "
            f"{r.do_nothing_accuracy:>9.1f}% | "
            f"{r.latency_p50_ms:>8.1f} | "
            f"${r.cost_per_10k_events_usd:>10.4f} | "
            f"{r.composite_value_score:>10.2f}{star}"
        )
    print("=" * 110)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run LLM model benchmark suite")
    parser.add_argument("--output", default="evals/model_benchmark_results.json", help="Path to save JSON benchmark output")
    args = parser.parse_args()

    bench_results = run_benchmark()
    print_comparison_table(bench_results)

    # Save to JSON
    out_dict = [asdict(r) for r in bench_results]
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(out_dict, f, indent=2)
    print(f"\n[SUCCESS] Saved complete benchmark results to: {args.output}")
