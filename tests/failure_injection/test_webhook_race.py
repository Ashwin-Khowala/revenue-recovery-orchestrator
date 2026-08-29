"""
Failure Injection Test 1: Razorpay Webhook Race Condition
Simulates payment.failed followed by payment.captured before recovery dispatch.
Verifies that the outcome tracker safely cancels the queued recovery action, preventing double contact.
"""

from orchestrator.state import RecoveryState
from orchestrator.nodes.outcome_tracker import outcome_tracker_node


def test_webhook_race_condition_cancellation():
    state: RecoveryState = {
        "event_id": "evt_race_test_01",
        "amount": 25000.0,
        "currency": "INR",
        "guardrail_result": "ALLOW",
        "channel_used": "whatsapp",
        "metadata": {"webhook_captured_early": True}, # Simulates late webhook signal
        "audit_trail": [],
    }

    result = outcome_tracker_node(state)

    assert result["payment_status"] == "cancelled_by_webhook"
    assert result["recovered_amount"] == 25000.0
    assert any("Action Cancelled" in a["action_taken"] for a in result["audit_trail"])
    print("[PASS] Passed: Webhook race condition successfully averted duplicate customer outreach.")


if __name__ == "__main__":
    test_webhook_race_condition_cancellation()
