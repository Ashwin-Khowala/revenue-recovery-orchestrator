"""
Customer Memory Layer
Reads from Supabase Postgres (customer_profiles + customer_episodes tables)
to build rich behavioral context for the LangGraph pipeline.
"""

import os
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger("orchestrator.memory.customer")

_supabase = None


def _get_client():
    global _supabase
    if _supabase:
        return _supabase
    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if url and key:
        try:
            from supabase import create_client
            _supabase = create_client(url, key)
        except Exception as e:
            logger.debug(f"Supabase client init failed: {e}")
    return _supabase


def get_customer_profile(customer_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches the full behavioral profile for a customer.
    Returns None if customer not found (falls back to event history dict).
    """
    client = _get_client()
    if not client:
        return None
    try:
        res = client.table("customer_profiles").select("*").eq("customer_id", customer_id).single().execute()
        return res.data
    except Exception as e:
        logger.debug(f"get_customer_profile({customer_id}): {e}")
        return None


def get_episodic_history(customer_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Retrieves the N most recent episodes for a customer.
    Returns a rich timeline used to build memory_context for the LLM.
    """
    client = _get_client()
    if not client:
        return []
    try:
        res = (
            client.table("customer_episodes")
            .select("episode_type,amount,channel,outcome,response_hours,notes,created_at")
            .eq("customer_id", customer_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
    except Exception as e:
        logger.debug(f"get_episodic_history({customer_id}): {e}")
        return []


def get_channel_effectiveness(customer_id: str) -> Dict[str, float]:
    """
    Computes per-channel empirical recovery hit rate from episodic history.
    Example: {"whatsapp": 0.73, "email": 0.40, "voice": 0.85}
    Falls back to defaults if insufficient data.
    """
    episodes = get_episodic_history(customer_id, limit=50)
    
    channel_attempts: Dict[str, int] = {}
    channel_successes: Dict[str, int] = {}
    
    for ep in episodes:
        ch = ep.get("channel")
        if not ch or ch == "none":
            continue
        channel_attempts[ch] = channel_attempts.get(ch, 0) + 1
        if ep.get("outcome") in ("recovered", "promised"):
            channel_successes[ch] = channel_successes.get(ch, 0) + 1
    
    defaults = {"whatsapp": 0.65, "email": 0.45, "voice": 0.55}
    effectiveness = {}
    for ch, default in defaults.items():
        attempts = channel_attempts.get(ch, 0)
        successes = channel_successes.get(ch, 0)
        if attempts >= 3:
            effectiveness[ch] = round(successes / attempts, 4)
        else:
            effectiveness[ch] = default  # not enough data
    
    return effectiveness


def build_memory_context(customer_id: str, profile: Optional[Dict] = None, episodes: Optional[List] = None) -> str:
    """
    Builds a concise plain-text narrative of the customer's behavioral history
    for injection into the LLM prompt. Keeps it under ~300 tokens.
    """
    if profile is None:
        profile = get_customer_profile(customer_id) or {}
    if episodes is None:
        episodes = get_episodic_history(customer_id, limit=8)
    
    if not profile and not episodes:
        return f"No prior history found for customer {customer_id}."
    
    lines = []
    
    name = profile.get("name", customer_id)
    reliability = profile.get("payment_reliability", 0.75)
    delay = profile.get("typical_payment_delay_days", 3.0)
    preferred_ch = profile.get("preferred_channel", "whatsapp")
    lang = profile.get("language", "english")
    promise_acc = profile.get("historical_promise_accuracy", 0.80)
    ltv = profile.get("ltv_inr", 0)
    total_failures = profile.get("total_failures", 0)
    total_recoveries = profile.get("total_recoveries", 0)
    
    lines.append(f"Customer: {name} | Reliability: {reliability:.0%} | Avg delay: {delay:.1f} days")
    lines.append(f"Preferred: {preferred_ch} | Language: {lang} | Promise accuracy: {promise_acc:.0%}")
    if ltv > 0:
        lines.append(f"Lifetime value: ₹{ltv:,.0f} | Failures: {total_failures} | Recoveries: {total_recoveries}")
    
    if episodes:
        lines.append("Recent history:")
        for ep in episodes[:6]:
            ep_type = ep.get("episode_type", "")
            outcome = ep.get("outcome", "")
            ch = ep.get("channel", "")
            hours = ep.get("response_hours")
            notes = ep.get("notes", "")
            
            summary = f"  - {ep_type}"
            if ch:
                summary += f" via {ch}"
            if outcome:
                summary += f" → {outcome}"
            if hours:
                summary += f" ({hours:.1f}h)"
            if notes:
                summary += f" | '{notes[:60]}'"
            lines.append(summary)
    
    return "\n".join(lines)


def update_customer_profile_after_outcome(
    customer_id: str,
    merchant_id: str,
    outcome: str,
    channel: str,
    amount: float,
    response_hours: Optional[float] = None,
    notes: Optional[str] = None,
    event_id: Optional[str] = None,
):
    """
    Write-back after recovery outcome — updates behavioral profile aggregates
    and appends a new episode to the episodic history.
    Called by outcome_tracker after each case.
    """
    client = _get_client()
    if not client:
        return
    
    try:
        # 1. Append episode
        episode = {
            "customer_id": customer_id,
            "merchant_id": merchant_id,
            "episode_type": "payment_failed",
            "amount": amount,
            "channel": channel,
            "outcome": outcome,
            "response_hours": response_hours,
            "notes": notes,
            "event_id": event_id,
            "metadata": {},
        }
        client.table("customer_episodes").insert(episode).execute()
        
        # 2. Fetch current profile for incremental update
        profile = get_customer_profile(customer_id)
        if not profile:
            return
        
        # 3. Compute updated aggregates
        total_failures = profile.get("total_failures", 0) + 1
        total_recoveries = profile.get("total_recoveries", 0) + (1 if outcome == "recovered" else 0)
        total_ignored = profile.get("total_ignored", 0) + (1 if outcome == "ignored" else 0)
        
        # Exponential moving average for channel response rates
        wa_rate = profile.get("whatsapp_response_rate", 0.5)
        voice_rate = profile.get("voice_response_rate", 0.4)
        alpha = 0.15  # how fast profile updates
        
        if channel == "whatsapp":
            new_wa = wa_rate * (1 - alpha) + (1.0 if outcome == "recovered" else 0.0) * alpha
            update_data = {"whatsapp_response_rate": round(new_wa, 4)}
        elif channel == "voice":
            new_voice = voice_rate * (1 - alpha) + (1.0 if outcome == "recovered" else 0.0) * alpha
            update_data = {"voice_response_rate": round(new_voice, 4)}
        else:
            update_data = {}
        
        update_data.update({
            "total_failures": total_failures,
            "total_recoveries": total_recoveries,
            "total_ignored": total_ignored,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        
        # Update preferred channel if new channel performs better
        new_rates = {
            "whatsapp": update_data.get("whatsapp_response_rate", wa_rate),
            "voice": update_data.get("voice_response_rate", voice_rate),
            "email": profile.get("email_response_rate", 0.40),
        }
        best_channel = max(new_rates, key=new_rates.get)
        update_data["preferred_channel"] = best_channel
        
        client.table("customer_profiles").update(update_data).eq("customer_id", customer_id).execute()
        logger.info(f"[MEMORY] Updated profile for {customer_id}: outcome={outcome}, channel={channel}")
        
    except Exception as e:
        logger.warning(f"update_customer_profile_after_outcome({customer_id}): {e}")


def get_customer_telegram_chat_id(customer_id: str) -> Optional[str]:
    """
    Returns the Telegram chat_id for a customer, if they've linked their account.
    Used by the executor to send proactive Telegram messages.
    """
    client = _get_client()
    if not client:
        return None
    try:
        res = (
            client.table("customer_profiles")
            .select("telegram_chat_id")
            .eq("customer_id", customer_id)
            .single()
            .execute()
        )
        return res.data.get("telegram_chat_id") if res.data else None
    except Exception:
        return None


def link_telegram_to_customer(chat_id: str, customer_id: str, username: str = ""):
    """
    Called when a customer /start's the Telegram bot.
    Links their chat_id to their customer_id in the DB.
    """
    client = _get_client()
    if not client:
        return
    try:
        # Update customer profile
        client.table("customer_profiles").update(
            {"telegram_chat_id": chat_id, "telegram_username": username}
        ).eq("customer_id", customer_id).execute()
        
        # Upsert TelegramChat registry
        client.table("telegram_chats").upsert({
            "chat_id": str(chat_id),
            "customer_id": customer_id,
            "role": "payer",
            "username": username,
            "last_active": datetime.now(timezone.utc).isoformat(),
        }).execute()
        
        logger.info(f"[MEMORY] Linked Telegram {chat_id} → customer {customer_id}")
    except Exception as e:
        logger.warning(f"link_telegram_to_customer({chat_id}, {customer_id}): {e}")
