"""
Failure Injection Test 4: LLM Failure & Deterministic Rules Fallback
Simulates Azure OpenAI timeout or offline status and verifies that the hybrid
architecture still classifies unambiguous cases with 100% precision.
"""

from unittest.mock import patch
from orchestrator.state import RecoveryState
from orchestrator.nodes.root_cause_classifier import classify_root_cause


def test_deterministic_fallback_on_llm_failure():
    # Case 1: Route degradation (should be caught by hard rules even if LLM is dead)
    state_degradation: RecoveryState = {
        "event_id": "evt_llm_fail_deg",
        "event_type": "payment_degraded",
        "amount": 15000.0,
        "metadata": {"pct_merchant_failures_same_route": 0.50},
        "audit_trail": [],
    }

    with patch("orchestrator.nodes.root_cause_classifier.get_azure_chat_llm", return_value=None):
        result_deg = classify_root_cause(state_degradation)
        assert result_deg["root_cause"] == "payment_degraded"
        assert result_deg["confidence"] == 0.99
        assert result_deg["candidate_actions"][0]["target_channel"] == "reroute"

    # Case 2: RBI Mandate > ₹15,000 without AFA (should be caught by hard rules)
    state_mandate: RecoveryState = {
        "event_id": "evt_llm_fail_mandate",
        "event_type": "mandate_auth_failed",
        "amount": 25000.0,
        "metadata": {"afa_step_reached": False},
        "audit_trail": [],
    }

    with patch("orchestrator.nodes.root_cause_classifier.get_azure_chat_llm", return_value=None):
        result_mandate = classify_root_cause(state_mandate)
        assert result_mandate["root_cause"] == "mandate_auth_failed"
        assert result_mandate["confidence"] == 0.98

    print("✓ Passed: Deterministic rules successfully protected unambiguous financial decisions during LLM outage.")


if __name__ == "__main__":
    test_deterministic_fallback_on_llm_failure()
