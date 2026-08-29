"""
Failure Injection Test 2: WhatsApp Channel Failure & Email Failover
Simulates a WhatsApp timeout or API failure and verifies that the Executor
cleanly falls over to Resend Email with zero duplicate sends.
"""

from unittest.mock import patch
from orchestrator.state import RecoveryState
from orchestrator.nodes.executor import execute_action


def test_whatsapp_failure_email_failover():
    state: RecoveryState = {
        "event_id": "evt_wa_fail_01",
        "amount": 2999.0,
        "customer_name": "Test User",
        "customer_email": "test@example.com",
        "customer_phone": "+919876543210",
        "guardrail_result": "ALLOW",
        "root_cause": "subscription_failed",
        "chosen_action": {"action_type": "whatsapp_recovery_nudge", "target_channel": "whatsapp"},
        "contact_count": 0,
        "audit_trail": [],
    }

    # Simulate WhatsApp API error
    mock_wa_fail = {"success": False, "channel": "whatsapp", "error": "WhatsApp Sandbox Connection Timeout"}
    # Simulate successful Email fallback
    mock_email_success = {"success": True, "channel": "email", "message_id": "email_msg_123", "status": "delivered"}

    with patch("orchestrator.nodes.executor.send_whatsapp_recovery", return_value=mock_wa_fail):
        with patch("orchestrator.nodes.executor.send_email_recovery", return_value=mock_email_success):
            result = execute_action(state)

            assert result["channel_used"] == "email"
            assert result["contact_count"] == 1
            assert result["execution_result"]["status"] == "delivered"
            assert any("Email Recovery Dispatched (Failover)" in a["action_taken"] for a in result["audit_trail"])
            print("[PASS] Passed: WhatsApp failure cleanly failed over to Email with zero duplicate contacts.")


if __name__ == "__main__":
    test_whatsapp_failure_email_failover()
