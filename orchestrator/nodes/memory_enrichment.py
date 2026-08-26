"""
Node 0: Memory Enrichment
First node in the LangGraph pipeline — runs BEFORE root-cause classification.
Pulls customer profile, episodic history, merchant policy, and builds
a rich memory_context string for use by downstream LLM nodes.
"""

import logging
from typing import Dict, Any
from orchestrator.state import RecoveryState
from orchestrator.memory import (
    get_customer_profile,
    get_episodic_history,
    get_channel_effectiveness,
    build_memory_context,
    get_merchant_policy,
    get_channel_capacity_remaining,
)

logger = logging.getLogger("orchestrator.nodes.memory_enrichment")


def memory_enrichment(state: RecoveryState) -> Dict[str, Any]:
    """
    Enriches the recovery state with persistent memory before any LLM reasoning.
    
    Memory pulled:
    - Customer behavioral profile (reliability, preferred channel, language)
    - Episodic history (last 10 events: what happened, which channel, what outcome)
    - Per-channel empirical effectiveness for this customer
    - Merchant contact policy (HITL threshold, channel limits)
    - Available channel capacity (how many WhatsApp slots remain today)
    """
    customer_id = state.get("customer_id", "")
    merchant_id = state.get("merchant_id", "merch_01")
    
    # ── 1. Customer Profile ────────────────────────────────────────────────────
    customer_profile = get_customer_profile(customer_id)
    
    if customer_profile:
        logger.info(
            f"[MEMORY] Customer {customer_id}: reliability={customer_profile.get('payment_reliability'):.0%}, "
            f"preferred={customer_profile.get('preferred_channel')}, lang={customer_profile.get('language')}"
        )
    else:
        logger.debug(f"[MEMORY] No profile found for {customer_id}, using event history")
    
    # ── 2. Episodic History ────────────────────────────────────────────────────
    episodic_history = get_episodic_history(customer_id, limit=10)
    
    # ── 3. Channel Effectiveness (empirical, per-customer) ─────────────────────
    channel_effectiveness = get_channel_effectiveness(customer_id)
    
    # ── 4. Memory Context (human-readable narrative for LLM) ──────────────────
    memory_context = build_memory_context(
        customer_id=customer_id,
        profile=customer_profile,
        episodes=episodic_history,
    )
    
    # ── 5. Merchant Policy ─────────────────────────────────────────────────────
    merchant_policy = get_merchant_policy(merchant_id)
    
    # ── 6. Channel Capacity ────────────────────────────────────────────────────
    channel_capacity = get_channel_capacity_remaining(merchant_id)
    
    # ── 7. Augment history dict with memory-derived signals ────────────────────
    # The history dict is what policy_engine reads for EV calculation.
    # Inject richer signals from the persistent profile.
    existing_history = state.get("history", {})
    enriched_history = dict(existing_history)
    
    if customer_profile:
        enriched_history.update({
            "prior_payment_success_rate": customer_profile.get("payment_reliability",
                enriched_history.get("prior_payment_success_rate", 0.75)),
            "customer_avg_days_late": customer_profile.get("typical_payment_delay_days",
                enriched_history.get("customer_avg_days_late", 3.0)),
            "historical_promise_accuracy": customer_profile.get("historical_promise_accuracy", 0.80),
            "preferred_channel": customer_profile.get("preferred_channel", "whatsapp"),
            "contact_tolerance": customer_profile.get("contact_tolerance", "medium"),
            "language": customer_profile.get("language", "english"),
            "ltv_inr": customer_profile.get("ltv_inr", 0.0),
            "risk_score": customer_profile.get("risk_score", 0.5),
            "whatsapp_response_rate": customer_profile.get("whatsapp_response_rate", 0.65),
            "voice_response_rate": customer_profile.get("voice_response_rate", 0.40),
            "channel_effectiveness": channel_effectiveness,
        })
    
    logger.info(
        f"[MEMORY] Enriched state for event {state.get('event_id')}: "
        f"episodes={len(episodic_history)}, "
        f"channel_capacity={channel_capacity}"
    )
    
    return {
        "customer_profile": customer_profile,
        "episodic_history": episodic_history,
        "merchant_policy": merchant_policy,
        "channel_capacity": channel_capacity,
        "memory_context": memory_context,
        "history": enriched_history,  # enriched with persistent data
    }
