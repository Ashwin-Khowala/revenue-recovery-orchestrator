"""
Unified DeepEval CI & Regression Test Suite Runner
Executes all DeepEval LLM evaluation suites across single-turn nodes, multi-turn dialogues,
agent tool correctness, and financial PII compliance using Azure OpenAI judge models.

Usage:
    python evals/run_deepeval_ci.py
    python evals/run_deepeval_ci.py --suite conversational
    python evals/run_deepeval_ci.py --suite tools
    python evals/run_deepeval_ci.py --suite pii
    python evals/run_deepeval_ci.py --export-json evals/deepeval_ci_report.json
"""

import os
import sys
import time
import json
import argparse
import subprocess
from datetime import datetime, timezone
from typing import Dict, Any, List

SUITES = {
    "core": {
        "name": "Core Node & Policy Engine Evals",
        "file": "evals/test_deepeval.py",
        "description": "G-Eval classification, intervention EV appropriateness, do-nothing brand equity, hallucination.",
    },
    "conversational": {
        "name": "Multi-Turn Conversational Evals",
        "file": "evals/test_conversational_multiturn_deepeval.py",
        "description": "RoleAdherenceMetric, ConversationCompletenessMetric, TurnRelevancyMetric, ToxicityMetric.",
    },
    "tools": {
        "name": "Agent Tool Correctness Evals",
        "file": "evals/test_agent_tools_deepeval.py",
        "description": "Discount ceiling enforcement, PTP outreach pausing, HITL supervisor authorization.",
    },
    "pii": {
        "name": "Financial PII & Privacy Evals",
        "file": "evals/test_pii_compliance_deepeval.py",
        "description": "Zero leakage of PAN, 16-digit cards, CVV, raw bank accounts across WhatsApp, Email, Voice.",
    },
}


def run_suite(suite_key: str, suite_info: Dict[str, str]) -> Dict[str, Any]:
    """Runs a specific pytest test file and records results."""
    print(f"\n[RUNNING] {suite_info['name']} ({suite_info['file']})...")
    start_time = time.perf_counter()

    cmd = [
        sys.executable,
        "-m",
        "pytest",
        suite_info["file"],
        "-v",
        "--tb=short",
    ]

    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    )
    elapsed_sec = time.perf_counter() - start_time

    # Parse pytest output
    output = proc.stdout + proc.stderr
    import re
    m_pass = re.search(r"(\d+)\s+passed", output)
    passed_count = int(m_pass.group(1)) if m_pass else output.count(" PASSED")

    m_fail = re.search(r"(\d+)\s+failed", output)
    failed_count = int(m_fail.group(1)) if m_fail else output.count(" FAILED")

    skipped_count = output.count(" SKIPPED")

    status = "PASSED" if proc.returncode == 0 else "FAILED"

    return {
        "suite_key": suite_key,
        "name": suite_info["name"],
        "file": suite_info["file"],
        "status": status,
        "passed": passed_count,
        "failed": failed_count,
        "skipped": skipped_count,
        "duration_sec": round(elapsed_sec, 2),
        "return_code": proc.returncode,
    }


def print_summary_table(results: List[Dict[str, Any]], total_duration: float, judge_model: str):
    """Prints a structured ASCII summary table of the evaluation run."""
    print("\n" + "=" * 90)
    print("  RAZORPAY REVENUE RECOVERY ORCHESTRATOR — DEEPEVAL TEST EXECUTION REPORT")
    print(f"  Judge Model: {judge_model}  |  Timestamp: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 90)
    print(f"{'Evaluation Suite':<35} | {'Status':<8} | {'Passed':<6} | {'Failed':<6} | {'Duration':<8}")
    print("-" * 90)

    total_passed = 0
    total_failed = 0

    for r in results:
        total_passed += r["passed"]
        total_failed += r["failed"]
        status_tag = "[PASS]" if r["status"] == "PASSED" else "[FAIL]"
        print(
            f"{r['name']:<35} | {status_tag:<8} | {r['passed']:<6} | {r['failed']:<6} | {r['duration_sec']:>5.1f}s"
        )

    print("-" * 90)
    total_status = "ALL SUITES PASSED" if total_failed == 0 else "SOME SUITES FAILED"
    print(
        f"{'TOTAL SUMMARY':<35} | {total_status:<8} | {total_passed:<6} | {total_failed:<6} | {total_duration:>5.1f}s"
    )
    print("=" * 90 + "\n")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Unified DeepEval CI Test Runner")
    parser.add_argument(
        "--suite",
        choices=list(SUITES.keys()) + ["all"],
        default="all",
        help="Specific suite to run (default: all)",
    )
    parser.add_argument(
        "--export-json",
        default="evals/deepeval_ci_report.json",
        help="Path to export structured JSON results",
    )
    args = parser.parse_args()

    judge_deployment = os.getenv("DEEPEVAL_JUDGE_MODEL") or os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-54-mini")

    selected_keys = list(SUITES.keys()) if args.suite == "all" else [args.suite]

    print(f"Starting DeepEval CI Test Run across {len(selected_keys)} suites...")
    print(f"Target LLM-as-a-Judge: Azure OpenAI ({judge_deployment})")

    suite_results = []
    overall_start = time.perf_counter()

    for key in selected_keys:
        res = run_suite(key, SUITES[key])
        suite_results.append(res)
        tag = "[PASS]" if res["status"] == "PASSED" else "[FAIL]"
        print(f"  -> {tag} {res['name']}: {res['passed']} passed, {res['failed']} failed in {res['duration_sec']}s")

    total_duration = time.perf_counter() - overall_start

    print_summary_table(suite_results, total_duration, judge_deployment)

    # Export report
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "judge_model": judge_deployment,
        "total_duration_sec": round(total_duration, 2),
        "suites": suite_results,
        "all_passed": all(r["status"] == "PASSED" for r in suite_results),
    }

    try:
        with open(args.export_json, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"Report successfully exported to: {args.export_json}\n")
    except Exception as e:
        print(f"Failed to export report to {args.export_json}: {e}")

    # Exit with code 1 if any failure
    if any(r["status"] == "FAILED" for r in suite_results):
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
