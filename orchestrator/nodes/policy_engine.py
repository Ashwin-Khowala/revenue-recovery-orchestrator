"""
Node 2: Deterministic Policy Engine
Calculates Expected Value (EV) for each candidate intervention.
EV = P(recovery | action, context) * amount - cost - friction_penalty - risk_penalty

Guarantees that financial decision-making is mathematical and deterministic,
preventing hallucinated or unbounded AI money actions.
"""

import logging
from typing import Dict, Any, List
from orchestrator.state import RecoveryState
from orchestrator.audit import log_audit_entry

logger = logging.getLogger("orchestrator.policy_engine")

# Base recovery prior probabilities by root cause and channel
BASE_PRIORS = {
    "subscription_failed": {
        "whatsapp": 0.72,
        "email": 0.45,
        "reroute": 0.10,
        "scheduled_check": 0.20,
        "none": 0.25, # natural recovery rate without outreach
    },
    "checkout_abandoned": {
        "whatsapp": 0.65,
        "email": 0.38,
        "reroute": 0.05,
        "scheduled_check": 0.10,
        "none": 0.30,
    },
    "receivable_overdue": {
        "whatsapp": 0.58,
        "email": 0.52,
        "reroute": 0.02,
        "scheduled_check": 0.30,
        "none": 0.15,
    },
    "payment_degraded": {
        "whatsapp": 0.05, # high friction, low conversion
        "email": 0.05,
        "reroute": 0.88, # high conversion via gateway switch
        "scheduled_check": 0.20,
        "none": 0.10,
    },
    "mandate_auth_failed": {
        "whatsapp": 0.78,
        "email": 0.55,
        "reroute": 0.02, # regulatory failure cannot be rerouted silently
        "scheduled_check": 0.15,
        "none": 0.05,
    },
    "promise_to_pay": {
        "whatsapp": 0.35, # contacting early annoys customer
        "email": 0.25,
        "reroute": 0.05,
        "scheduled_check": 0.85, # honoring date yields highest recovery
        "none": 0.40,
    },
}

CHANNEL_COSTS = {
    "whatsapp": 0.80, # ~₹0.80 per WhatsApp utility template
    "email": 0.05,    # ~₹0.05 per transactional email
    "reroute": 0.00,  # ₹0 API call
    "scheduled_check": 0.00,
    "none": 0.00,
}


def compute_p_recovery(root_cause: str, channel: str, history: Dict[str, Any]) -> float:
    """
    Computes calibrated probability of recovery based on root cause, chosen channel,
    and historical customer payment reliability.
    """
    prior_success_rate = history.get("prior_payment_success_rate", 0.75)
    prior_contacts = history.get("prior_contacts", 0)
    customer_avg_days_late = history.get("customer_avg_days_late", 3)

    if channel == "none":
        # For 'do_nothing', natural recovery probability directly correlates with customer's historical reliability
        if prior_success_rate >= 0.90 and customer_avg_days_late <= 3:
            # High-confidence natural payer: natural settlement without any outreach friction
            natural_p = prior_success_rate * 0.95
            return round(min(0.98, natural_p), 4)
        else:
            base_p = BASE_PRIORS.get(root_cause, {}).get("none", 0.20)
            return round(base_p * (0.5 + 0.5 * prior_success_rate), 4)

    priors_for_cause = BASE_PRIORS.get(root_cause, BASE_PRIORS["subscription_failed"])
    base_p = priors_for_cause.get(channel, 0.30)

    # Customer track record multiplier (0.83 success rate -> boost, 0.20 -> drop)
    history_multiplier = 0.6 + (0.6 * prior_success_rate) # maps 0.0->0.6, 1.0->1.2

    # Prior contacts penalty (diminishing returns per contact attempt)
    contact_decay = max(0.4, 1.0 - (0.25 * prior_contacts))

    calibrated_p = min(0.98, max(0.02, base_p * history_multiplier * contact_decay))
    return round(calibrated_p, 4)


def compute_friction_penalty(channel: str, contact_count: int) -> float:
    """
    Penalizes spamming customers. Exponential penalty as contact count increases.
    """
    if channel in ("none", "reroute", "scheduled_check"):
        return 0.0
    # WhatsApp / Email friction penalty: ₹15 for 1st contact, ₹60 for 2nd contact
    return 15.0 * ((contact_count + 1) ** 2)


def compute_risk_penalty(amount: float, channel: str) -> float:
    """
    Penalizes automated intrusive contact for extremely high amounts without human oversight.
    """
    if amount >= 100000 and channel in ("whatsapp", "email"):
        return 250.0  # ₹250 risk penalty for unverified automated contact on >₹1L
    return 0.0


def score_policy_options(state: RecoveryState) -> Dict[str, Any]:
    """
    Scores all candidate actions mathematically and chooses the optimal action.
    """
    event_id = state.get("event_id", "unknown")
    root_cause = state.get("root_cause", "subscription_failed")
    amount = float(state.get("amount", 0.0))
    history = state.get("history", {})
    contact_count = state.get("contact_count", 0)
    candidates = state.get("candidate_actions", [])

    scored_actions: List[Dict[str, Any]] = []

    for cand in candidates:
        action_type = cand.get("action_type", "unknown")
        channel = cand.get("target_channel", "none")
        cost = CHANNEL_COSTS.get(channel, 0.0)
        
        p_rec = compute_p_recovery(root_cause, channel, history)
        friction = compute_friction_penalty(channel, contact_count)
        risk = compute_risk_penalty(amount, channel)

        expected_gross_recovery = p_rec * amount
        net_ev = expected_gross_recovery - cost - friction - risk

        scored_actions.append({
            "action_type": action_type,
            "target_channel": channel,
            "description": cand.get("description", ""),
            "cost": cost,
            "p_recovery": p_rec,
            "gross_expected_recovery": round(expected_gross_recovery, 2),
            "friction_penalty": round(friction, 2),
            "risk_penalty": round(risk, 2),
            "expected_value": round(net_ev, 2),
        })

    # Sort descending by Expected Value
    scored_actions.sort(key=lambda x: x["expected_value"], reverse=True)
    best_action = scored_actions[0] if scored_actions else {
        "action_type": "do_nothing",
        "target_channel": "none",
        "expected_value": 0.0,
        "cost": 0.0,
        "description": "Default do_nothing",
    }

    reasoning = (
        f"Selected '{best_action['action_type']}' via {best_action['target_channel']} "
        f"with highest Net EV = ₹{best_action['expected_value']:.2f} "
        f"(P(rec)={best_action.get('p_recovery', 0):.2f}, Gross=₹{best_action.get('gross_expected_recovery', 0):.2f}, "
        f"Friction=₹{best_action.get('friction_penalty', 0):.2f})."
    )

    audit_entry = log_audit_entry(
        event_id=event_id,
        node_name="score_policy_options",
        action_taken=f"Chose {best_action['action_type']} (EV: ₹{best_action['expected_value']})",
        details={
            "chosen_action": best_action,
            "all_scored_candidates": scored_actions,
        },
        reasoning=reasoning,
    )

    return {
        "chosen_action": best_action,
        "expected_value": best_action["expected_value"],
        "ev_breakdown": {
            "all_scored_actions": scored_actions,
            "top_action_metrics": best_action,
        },
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }
