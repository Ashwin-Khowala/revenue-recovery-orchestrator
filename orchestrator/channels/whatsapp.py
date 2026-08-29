"""
WhatsApp Recovery Channel — Twilio WhatsApp API
Sends real WhatsApp messages via Twilio sandbox using Account SID + Auth Token.
"""

import os
import logging
from typing import Dict, Any

logger = logging.getLogger("orchestrator.channels.whatsapp")


def send_whatsapp_recovery(
    recipient_phone: str,
    customer_name: str,
    amount: float,
    recovery_link: str,
    root_cause: str,
    discount_applied: float = 0.0,
    force_mock: bool = False,
) -> Dict[str, Any]:
    """
    Sends a WhatsApp recovery message via Twilio.
    Uses Account SID + Auth Token (or API Key + Secret as fallback).
    """
    # Safe phone override in non-production
    safe_override = os.getenv("SAFE_MODE_PHONE_OVERRIDE")
    env = os.getenv("ENVIRONMENT", "development")
    target_phone = safe_override if (env != "production" and safe_override) else recipient_phone

    clean_phone = target_phone.replace(" ", "").replace("-", "")
    if not clean_phone.startswith("+"):
        clean_phone = f"+91{clean_phone}" if len(clean_phone) == 10 else f"+{clean_phone}"

    # Build message
    discount_msg = f" (Special offer: ₹{int(discount_applied)} discount!)" if discount_applied > 0 else ""

    if root_cause == "mandate_auth_failed":
        body = (
            f"Namaste {customer_name}, your recurring payment of ₹{amount:,.0f} requires RBI approval. "
            f"Authorize here: {recovery_link}"
        )
    elif root_cause == "checkout_abandoned":
        body = (
            f"Hi {customer_name}, your cart (₹{amount:,.0f}) is saved{discount_msg}! "
            f"Complete your order: {recovery_link}"
        )
    elif root_cause == "receivable_overdue":
        body = (
            f"Hello {customer_name}, reminder for invoice ₹{amount:,.0f}. "
            f"Pay online: {recovery_link}"
        )
    else:
        body = (
            f"Hi {customer_name}, your payment of ₹{amount:,.0f} had an issue. "
            f"Resolve it here: {recovery_link}"
        )

    # --- Try Twilio ---
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    api_key = os.getenv("TWILIO_API_KEY")
    api_secret = os.getenv("TWILIO_API_SECRET")
    from_number = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+17372508034")

    can_use_twilio = account_sid and (auth_token or (api_key and api_secret))

    if not force_mock and can_use_twilio:
        try:
            from twilio.rest import Client

            # Prefer Auth Token (simpler), fallback to API Key
            if auth_token:
                client = Client(account_sid, auth_token)
            else:
                client = Client(api_key, api_secret, account_sid)

            to_whatsapp = f"whatsapp:{clean_phone}"
            msg = client.messages.create(
                from_=from_number,
                to=to_whatsapp,
                body=body,
            )
            logger.info("[TWILIO SENT] WhatsApp sent via Twilio: SID=%s to=%s", msg.sid, clean_phone)
            return {
                "success": True,
                "channel": "whatsapp",
                "provider": "twilio",
                "message_id": msg.sid,
                "recipient": clean_phone,
                "status": "delivered",
                "body": body,
                "link": recovery_link,
            }
        except Exception as e:
            logger.warning("Twilio WhatsApp failed: %s", e)
            # Fall through to simulation

    # --- Simulation fallback ---
    logger.info("[WHATSAPP SIM] To: %s | Body: %s", clean_phone, body[:80])
    return {
        "success": True,
        "channel": "whatsapp",
        "provider": "simulation",
        "message_id": f"sim_{clean_phone[-4:]}_{int(amount)}",
        "recipient": clean_phone,
        "status": "simulated",
        "body": body,
        "link": recovery_link,
    }
