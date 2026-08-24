"""
WhatsApp Recovery Channel
Integrates with Meta WhatsApp Business Cloud API sandbox with automatic fallback.
"""

import os
import logging
import httpx
from typing import Dict, Any, Optional

logger = logging.getLogger("orchestrator.channels.whatsapp")


def send_whatsapp_recovery(
    recipient_phone: str,
    customer_name: str,
    amount: float,
    recovery_link: str,
    root_cause: str,
    force_mock: bool = False,
) -> Dict[str, Any]:
    """
    Dispatches a recovery message via Meta WhatsApp Business Cloud API.
    Uses pre-registered test recipient in sandbox mode.
    """
    phone_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    access_token = os.getenv("WHATSAPP_ACCESS_TOKEN")
    sandbox_number = os.getenv("WHATSAPP_RECIPIENT_TEST_NUMBER", recipient_phone)

    # If credentials are not configured or force_mock is set, use deterministic simulation
    if force_mock or not phone_id or not access_token:
        logger.info(f"[WHATSAPP SIMULATION] To: {recipient_phone} | Amount: ₹{amount:,.2f} | Link: {recovery_link}")
        return {
            "success": True,
            "channel": "whatsapp",
            "message_id": f"sim_wamid_{recipient_phone[-4:]}_{int(amount)}",
            "recipient": recipient_phone,
            "status": "delivered_simulated",
            "error": None,
        }

    # Meta Cloud API endpoint
    url = f"https://graph.facebook.com/v20.0/{phone_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    message_body = (
        f"Hi {customer_name}, we noticed an issue completing your payment of ₹{amount:,.2f}. "
        f"You can quickly resolve this here: {recovery_link}"
    )

    payload = {
        "messaging_product": "whatsapp",
        "to": sandbox_number,
        "type": "text",
        "text": {"preview_url": True, "body": message_body},
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(url, headers=headers, json=payload)
            if response.status_code in (200, 201):
                data = response.json()
                msg_id = data.get("messages", [{}])[0].get("id", "wamid_unknown")
                return {
                    "success": True,
                    "channel": "whatsapp",
                    "message_id": msg_id,
                    "recipient": sandbox_number,
                    "status": "delivered",
                    "error": None,
                }
            else:
                err_text = response.text
                logger.error(f"WhatsApp Cloud API Error ({response.status_code}): {err_text}")
                return {
                    "success": False,
                    "channel": "whatsapp",
                    "message_id": None,
                    "recipient": sandbox_number,
                    "status": "failed",
                    "error": f"HTTP {response.status_code}: {err_text}",
                }
    except Exception as e:
        logger.error(f"WhatsApp dispatch exception: {e}")
        return {
            "success": False,
            "channel": "whatsapp",
            "message_id": None,
            "recipient": sandbox_number,
            "status": "failed",
            "error": str(e),
        }
