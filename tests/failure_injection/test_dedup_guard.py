"""
Failure Injection Test 3: Anti-Spam & Contact Frequency Guardrail
Verifies that a customer with >= 2 prior contacts triggers mandatory ESCALATE,
guaranteeing duplicate contacts = 0.
"""

from orchestrator.state import RecoveryState
from orchestrator.nodes.guardrails import check_guardrails


def test_contact_frequency_cap_escalation():
    state: RecoveryState = {
        "event_id": "evt_spam_guard_01",
        "amount": 4999.0,
        "root_cause": "subscription_failed",
        "chosen_action": {"action_type": "whatsapp_recovery_nudge", "target_channel": "whatsapp"},
        "contact_count": 0,
        "history": {"prior_contacts": 2}, # Already contacted twice
        "audit_trail": [],
    }

    result = check_guardrails(state)

    assert result["guardrail_result"] == "ESCALATE"
    assert result["guardrail_rule_fired"] == "RULE_MAX_CONTACT_FREQUENCY_EXCEEDED"
    print("[PASS] Passed: Contact cap guardrail enforced. Escalated to human rather than spamming customer.")


if __name__ == "__main__":
    test_contact_frequency_cap_escalation()
