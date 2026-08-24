"""
Baseline A: Naive Strategy (Retry & Message Everything)
- Retries all payment errors blindly
- Sends generic WhatsApp messages to 100% of cases
- Zero root-cause reasoning, no customer history context, no guardrails, no EV optimization
"""

from typing import Dict, Any, List

WHATSAPP_COST = 0.80


def run_baseline_naive_on_event(event: Dict[str, Any]) -> Dict[str, Any]:
    amount = float(event.get("amount", 0.0))
    cause = event.get("event_type", "subscription_failed")
    history = event.get("history", {})

    # Naive strategy messages everyone immediately
    contact_made = True
    duplicate_contact = history.get("prior_contacts", 0) >= 2 # Violates spam limits

    # Natural payer detection (would have paid anyway without outreach)
    prior_success_rate = history.get("prior_payment_success_rate", 0.70)
    is_natural_payer = prior_success_rate >= 0.90
    false_intervention = contact_made and is_natural_payer

    # Naive recovery conversion rates (lower due to customer fatigue and wrong channel for route degradation)
    if cause == "payment_degraded":
        # Customer cannot fix bank route failure -> 0% conversion, 100% wasted friction
        recovered = False
    elif cause == "mandate_auth_failed":
        # Generic message lacks RBI AFA link -> low conversion
        recovered = False
    else:
        recovered = prior_success_rate >= 0.60

    recovered_amount = amount if recovered else 0.0

    return {
        "event_id": event["event_id"],
        "strategy": "baseline_naive",
        "action_taken": "whatsapp_blast_generic",
        "channel": "whatsapp",
        "cost": WHATSAPP_COST,
        "recovered": recovered,
        "recovered_amount": recovered_amount,
        "false_intervention": false_intervention,
        "duplicate_contact": duplicate_contact,
        "escalated": False,
    }
