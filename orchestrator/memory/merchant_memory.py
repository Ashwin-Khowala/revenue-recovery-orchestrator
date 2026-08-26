"""
Merchant Memory Layer
Reads merchant profiles and policies from Supabase,
provides channel capacity tracking for the portfolio optimizer.
"""

import os
import logging
from typing import Dict, Any, Optional
from datetime import datetime, date, timezone

logger = logging.getLogger("orchestrator.memory.merchant")

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


def get_merchant_profile(merchant_id: str) -> Optional[Dict[str, Any]]:
    """Full merchant profile including policy and limits."""
    client = _get_client()
    if not client:
        return None
    try:
        res = client.table("merchants").select("*").eq("merchant_id", merchant_id).single().execute()
        return res.data
    except Exception as e:
        logger.debug(f"get_merchant_profile({merchant_id}): {e}")
        return None


def get_merchant_policy(merchant_id: str) -> Dict[str, Any]:
    """
    Returns the merchant's configured contact policy.
    Falls back to safe defaults if no profile found.
    """
    profile = get_merchant_profile(merchant_id)
    if profile and profile.get("contact_policy"):
        policy = profile["contact_policy"]
        if isinstance(policy, str):
            import json
            policy = json.loads(policy)
        return policy
    
    # Safe defaults
    return {
        "max_whatsapp_per_case": 2,
        "max_email_per_case": 3,
        "voice_threshold_inr": 50000,
        "hitl_threshold_inr": 100000,
    }


def get_channel_capacity_remaining(merchant_id: str) -> Dict[str, int]:
    """
    Returns remaining daily channel slots for a merchant.
    Computes: limit - already_used_today
    Used by the portfolio optimizer.
    """
    client = _get_client()
    profile = get_merchant_profile(merchant_id)
    
    if not profile:
        return {"whatsapp": 100, "email": 500, "voice": 20, "human_review": 20}
    
    limits = {
        "whatsapp": profile.get("whatsapp_daily_limit", 100),
        "email": profile.get("email_daily_limit", 500),
        "voice": profile.get("voice_daily_limit", 20),
        "human_review": profile.get("human_review_limit", 20),
    }
    
    if not client:
        return limits
    
    try:
        # Count actions dispatched today
        today_start = datetime.combine(date.today(), datetime.min.time()).isoformat()
        res = (
            client.table("recovery_actions")
            .select("target_channel")
            .eq("status", "executed")
            .gte("created_at", today_start)
            .execute()
        )
        
        used: Dict[str, int] = {}
        for row in (res.data or []):
            ch = row.get("target_channel", "none")
            used[ch] = used.get(ch, 0) + 1
        
        # Also count escalations (human review)
        esc_res = (
            client.table("events")
            .select("event_id")
            .eq("merchant_id", merchant_id)
            .eq("payment_status", "escalated")
            .gte("created_at", today_start)
            .execute()
        )
        used["human_review"] = len(esc_res.data or [])
        
        remaining = {ch: max(0, limit - used.get(ch, 0)) for ch, limit in limits.items()}
        return remaining
        
    except Exception as e:
        logger.debug(f"get_channel_capacity_remaining({merchant_id}): {e}")
        return limits


def get_merchant_telegram_chat_ids(merchant_id: str) -> list:
    """
    Returns all Telegram chat_ids linked to merchant staff (for HITL approvals).
    """
    client = _get_client()
    if not client:
        return []
    try:
        res = (
            client.table("merchant_users")
            .select("telegram_chat_id")
            .eq("merchant_id", merchant_id)
            .not_.is_("telegram_chat_id", "null")
            .execute()
        )
        return [row["telegram_chat_id"] for row in (res.data or []) if row.get("telegram_chat_id")]
    except Exception as e:
        logger.debug(f"get_merchant_telegram_chat_ids({merchant_id}): {e}")
        return []


def link_merchant_user_telegram(merchant_id: str, email: str, chat_id: str):
    """Links a merchant user's Telegram account for HITL notifications."""
    client = _get_client()
    if not client:
        return
    try:
        client.table("merchant_users").update(
            {"telegram_chat_id": str(chat_id)}
        ).eq("merchant_id", merchant_id).eq("email", email).execute()
        
        client.table("telegram_chats").upsert({
            "chat_id": str(chat_id),
            "merchant_user_email": email,
            "role": "merchant",
            "last_active": datetime.now(timezone.utc).isoformat(),
        }).execute()
        
        logger.info(f"[MEMORY] Linked merchant user {email} Telegram → {chat_id}")
    except Exception as e:
        logger.warning(f"link_merchant_user_telegram: {e}")


def get_telegram_registry(chat_id: str) -> Optional[Dict[str, Any]]:
    """
    Resolves a Telegram chat_id to its associated customer_id or merchant_user_email.
    Used by the bot to route incoming messages to the right profile.
    """
    client = _get_client()
    if not client:
        return None
    try:
        res = client.table("telegram_chats").select("*").eq("chat_id", str(chat_id)).single().execute()
        return res.data
    except Exception:
        return None


def upsert_telegram_chat(
    chat_id: str,
    role: str = "payer",
    customer_id: Optional[str] = None,
    merchant_user_email: Optional[str] = None,
    username: str = "",
    first_name: str = "",
):
    """Upsert a Telegram chat record when a user interacts with the bot."""
    client = _get_client()
    if not client:
        return
    try:
        data = {
            "chat_id": str(chat_id),
            "role": role,
            "username": username,
            "first_name": first_name,
            "last_active": datetime.now(timezone.utc).isoformat(),
        }
        if customer_id:
            data["customer_id"] = customer_id
        if merchant_user_email:
            data["merchant_user_email"] = merchant_user_email
        
        client.table("telegram_chats").upsert(data).execute()
    except Exception as e:
        logger.debug(f"upsert_telegram_chat({chat_id}): {e}")
