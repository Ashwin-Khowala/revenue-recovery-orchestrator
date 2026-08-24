"""
Baseline B: Standard Rule-Based Strategy (Heuristic If/Else)
- Standard commercial if/else rules per event type
- If payment failed -> retry 1 time
- If invoice overdue -> send email reminder
- If cart abandoned -> send WhatsApp after 30 min
- No expected value optimization, no "do nothing" scoring, basic static thresholds
"""

from typing import Dict, Any

CHANNEL_COSTS = {"whatsapp": 0.80, "email": 0.05, "reroute": 0.00, "none": 0.00}


def run_baseline_rules_on_event(event: Dict[str, Any]) -> Dict[str, Any]:
    amount = float(event.get("amount", 0.0))
    cause = event.get("event_type", "subscription_failed")
    history = event.get("history", {})

    prior_success_rate = history.get("prior_payment_success_rate", 0.70)
    is_natural_payer = prior_success_rate >= 0.90
    prior_contacts = history.get("prior_contacts", 0)

    # Heuristic rules
    if cause == "payment_degraded":
        action = "retry_same_gateway" # attempts naive retry on degraded route
        channel = "none"
        cost = 0.0
        contact_made = False
        recovered = False # failed route still degraded
    elif cause == "receivable_overdue":
        action = "email_invoice_reminder"
        channel = "email"
        cost = CHANNEL_COSTS["email"]
        contact_made = True
        recovered = prior_success_rate >= 0.65
    elif cause == "mandate_auth_failed":
        action = "whatsapp_mandate_alert"
        channel = "whatsapp"
        cost = CHANNEL_COSTS["whatsapp"]
        contact_made = True
        recovered = True # alert sent
    elif cause == "promise_to_pay":
        # Rules engine lacks PTP awareness and messages immediately anyway
        action = "whatsapp_immediate_reminder"
        channel = "whatsapp"
        cost = CHANNEL_COSTS["whatsapp"]
        contact_made = True
        recovered = False # customer annoyed because they promised next week
    else: # checkout_abandoned, subscription_failed
        action = "whatsapp_recovery_link"
        channel = "whatsapp"
        cost = CHANNEL_COSTS["whatsapp"]
        contact_made = True
        recovered = prior_success_rate >= 0.50

    duplicate_contact = contact_made and (prior_contacts >= 2)
    false_intervention = contact_made and is_natural_payer
    recovered_amount = amount if recovered else 0.0

    return {
        "event_id": event["event_id"],
        "strategy": "baseline_rules",
        "action_taken": action,
        "channel": channel,
        "cost": cost,
        "recovered": recovered,
        "recovered_amount": recovered_amount,
        "false_intervention": false_intervention,
        "duplicate_contact": duplicate_contact,
        "escalated": False,
    }
