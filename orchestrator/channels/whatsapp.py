"""
WhatsApp Recovery Channel — Simulation Only
Twilio has been removed. Messages are logged and simulated.
To re-enable Twilio for production: set ENABLE_REAL_WHATSAPP=true and restore the Twilio client block.
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
    Builds and logs a WhatsApp recovery message. Always returns simulation — no real
    Twilio/HTTP call is made in this build. Channel is used by Telegram bot instead.
    """
    # Safe phone override (belt-and-suspenders for any non-batch codepaths)
    safe_override = os.getenv("SAFE_MODE_PHONE_OVERRIDE")
    env = os.getenv("ENVIRONMENT", "development")
    target_phone = safe_override if (env != "production" and safe_override) else recipient_phone

    clean_phone = target_phone.replace(" ", "").replace("-", "")
    if not clean_phone.startswith("+"):
        clean_phone = f"+91{clean_phone}" if len(clean_phone) == 10 else f"+{clean_phone}"

    # Build message body
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
