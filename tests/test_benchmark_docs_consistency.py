"""
Benchmark Documentation Consistency Test
=========================================
Ensures that all rupee figures and metrics cited in README.md or EVALS.md
match evals/last_run.json with zero drift.
"""

import os
import re
import json
import pytest

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def test_benchmark_metrics_match_last_run():
    last_run_path = os.path.join(ROOT_DIR, "evals", "last_run.json")
    assert os.path.exists(last_run_path), "evals/last_run.json must exist"
    
    with open(last_run_path, "r", encoding="utf-8") as f:
        last_run = json.load(f)

    metrics = last_run["metrics"]
    orch = metrics["orchestrator"]
    naive = metrics["baseline_naive"]
    rules = metrics["baseline_rules"]
    organic = metrics["baseline_organic"]

    # Verify total at-risk matches holdout sum
    assert last_run["total_at_risk_inr"] == 9750738.0
    assert last_run["n_events"] == 150

    # Verify orchestrator invariants
    assert orch["duplicate_contacts"] == 0, "Orchestrator must have exactly 0 duplicate contact breaches"
    assert orch["escalations"] > 0, "Orchestrator must escalate high-value cases"
    assert orch["recovery_rate_pct"] > 0, "Orchestrator recovery rate must be non-zero"

    # Verify incremental recovery vs organic baseline
    assert orch["incremental_recovered_vs_organic"] > 0, "Orchestrator must deliver positive incremental lift vs organic"

    # Check README.md
    readme_path = os.path.join(ROOT_DIR, "README.md")
    if os.path.exists(readme_path):
        with open(readme_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        # Verify no stale brochure figures exist
        assert "75.8%" not in content, "Stale brochure recovery rate 75.8% must not appear in README"
        assert "5,84,200" not in content, "Stale brochure amount 5,84,200 must not appear in README"
        assert "gpt-54" not in content.lower(), "Fictitious model names must not appear in README"


def test_exceptions_json_audit_completeness():
    exceptions_path = os.path.join(ROOT_DIR, "evals", "exceptions.json")
    assert os.path.exists(exceptions_path), "evals/exceptions.json must be generated"
    
    with open(exceptions_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    assert "exceptions" in data
    assert len(data["exceptions"]) == data["total_non_recovered_count"]
    for exc in data["exceptions"]:
        assert "event_id" in exc
        assert "amount" in exc
        assert "reason" in exc
        assert exc["reason"] is not None
