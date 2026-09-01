"""
Arm 0: Organic / Do Nothing Baseline
Measures natural settlement without any automated or manual outreach intervention.
Used as the denominator to compute TRUE incremental recovered revenue.
"""

from typing import Dict, Any


def run_baseline_organic_on_event(event: Dict[str, Any]) -> Dict[str, Any]:
    amount = float(event.get("amount", 0.0))
    history = event.get("history", {})
    prior_success_rate = history.get("prior_payment_success_rate", 0.70)
    avg_days_late = history.get("customer_avg_days_late", 3.0)
    natural_prob = event.get("natural_recovery_probability")

    # High reliability natural payers settle organically without any outreach
    if natural_prob is not None:
        recovered = natural_prob >= 0.50
    elif prior_success_rate >= 0.90 and avg_days_late <= 3.0:
        recovered = True
    elif prior_success_rate >= 0.85 and avg_days_late <= 2.0:
        recovered = True
    else:
        recovered = False

    recovered_amount = amount if recovered else 0.0

    return {
        "event_id": event["event_id"],
        "strategy": "organic_do_nothing",
        "action_taken": "do_nothing",
        "channel": "none",
        "cost": 0.0,
        "recovered": recovered,
        "recovered_amount": recovered_amount,
        "false_intervention": False,
        "duplicate_contact": False,
        "escalated": False,
    }
