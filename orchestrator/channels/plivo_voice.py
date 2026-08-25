"""
Plivo Telephony Integration for Razorpay Revenue Recovery Orchestrator
Handles outbound voice recovery calls and inbound/outbound XML response flows.
"""

import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Load Plivo credentials from environment
PLIVO_AUTH_ID = os.getenv("PLIVO_AUTH_ID")
PLIVO_AUTH_TOKEN = os.getenv("PLIVO_AUTH_TOKEN")
PLIVO_SOURCE_NUMBER = os.getenv("PLIVO_SOURCE_NUMBER", "+17372508034")


def make_plivo_recovery_call(
    recipient_phone: str,
    customer_name: str,
    amount: float,
    root_cause: str,
    callback_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Triggers an outbound conversational voice call via Plivo API.
    If PLIVO credentials are missing or in sandbox, generates the compliant Plivo XML payload.
    """
    # Safe override check
    safe_override = os.getenv("SAFE_MODE_PHONE_OVERRIDE")
    target_phone = safe_override if (os.getenv("ENVIRONMENT") != "production" and safe_override) else recipient_phone

    logger.info(f"[PLIVO CALL] Initiating outbound recovery call to {target_phone} for {customer_name} (₹{amount})")

    # Generate custom Hinglish voice dialogue script based on failure category
    if root_cause == "mandate_auth_failed":
        speak_text = (
            f"Namaste {customer_name}! Hum Razorpay recovery team se bol rahe hain. "
            f"Aapka {amount} rupaye ka recurring mandate RBI verification ke liye hold par hai. "
            f"Humne aapke number par 1-click re-authorization link bhej diya hai. Dhanyawad!"
        )
    elif root_cause == "receivable_overdue":
        speak_text = (
            f"Namaste {customer_name}! Hum Razorpay finance desk se baat kar rahe hain. "
            f"Aapka {amount} rupaye ka B2B invoice due hai. "
            f"Kya aap abhi settle karna chahenge ya koi extension schedule karein?"
        )
    else:
        speak_text = (
            f"Namaste {customer_name}! Hum Razorpay partner support se bol rahe hain. "
            f"Aapka {amount} rupaye ka payment complete nahi ho paya tha. "
            f"Humne instant retry link create kar diya hai 5 percent discount ke saath."
        )

    # Try calling via official Plivo SDK if credentials exist
    if PLIVO_AUTH_ID and PLIVO_AUTH_TOKEN:
        try:
            import plivo
            client = plivo.RestClient(PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN)
            
            # Answer URL with dynamic speak XML
            answer_url = callback_url or f"https://api.razorpay-recovery.demo/api/orchestrator/plivo/answer-xml?customer_name={customer_name}&amount={amount}"
            
            response = client.calls.create(
                from_=PLIVO_SOURCE_NUMBER,
                to_=target_phone,
                answer_url=answer_url,
                answer_method="GET",
            )
            return {
                "success": True,
                "provider": "plivo",
                "call_uuid": response.get("request_uuid", f"plivo_{target_phone[-4:]}"),
                "target_phone": target_phone,
                "speak_text": speak_text,
                "message": "Plivo voice call dispatched successfully.",
            }
        except Exception as e:
            logger.warning(f"Plivo API call failed ({e}). Returning generated Plivo XML response.")

    # Return structured Plivo Telephony XML payload
    plivo_xml = (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<Response>\n'
        f'    <Speak language="hi-IN" voice="WOMAN">{speak_text}</Speak>\n'
        f'</Response>'
    )

    return {
        "success": True,
        "provider": "plivo",
        "mode": "synthesized_plivo_xml",
        "target_phone": target_phone,
        "speak_text": speak_text,
        "plivo_xml": plivo_xml,
        "voice_agent": "Razorpay Gemini Live Telephony Agent",
    }
