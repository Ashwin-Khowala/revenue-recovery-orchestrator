"""
Voice Recovery Channel — Hinglish AI Voice Script Generator
Generates conversational Hinglish recovery scripts for voice calls.
The dashboard uses browser SpeechSynthesis API to actually speak these.
"""

import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("orchestrator.channels.voice")


def generate_voice_recovery(
    customer_name: str,
    amount: float,
    root_cause: str,
    recipient_phone: Optional[str] = None,
    force_mock: bool = False,
) -> Dict[str, Any]:
    """
    Generates a Hinglish voice recovery script.
    The actual TTS is done client-side via browser SpeechSynthesis API.
    """
    if root_cause == "mandate_auth_failed":
        script = (
            f"Namaste {customer_name}! Hum Razorpay payment recovery team se bol rahe hain. "
            f"Aapka {int(amount):,} rupaye ka monthly mandate RBI verification ke bina hold par hai. "
            f"Humne aapke WhatsApp par ek secure authentication link send kiya hai. "
            f"Kripya use approve karein taaki aapki service uninterrupted rahe. Dhanyawad!"
        )
    elif root_cause == "checkout_abandoned":
        script = (
            f"Namaste {customer_name}! Humne dekha aapka {int(amount):,} rupaye ka order complete nahi ho paya. "
            f"Humne aapke cart par ek exclusive recovery discount link bheja hai. "
            f"Aap UPI ya card se turant complete kar sakte hain. Thank you!"
        )
    elif root_cause == "receivable_overdue":
        script = (
            f"Namaste {customer_name}! Ye ek friendly reminder hai aapke outstanding invoice "
            f"{int(amount):,} rupaye ke liye. "
            f"Payment link aapke WhatsApp aur email par available hai. "
            f"Agar koi clarification chahiye to humse connect kar sakte hain."
        )
    else:
        script = (
            f"Namaste {customer_name}! Hum Razorpay partner ki taraf se baat kar rahe hain. "
            f"Aapka {int(amount):,} rupaye ka payment issue resolve karne ke liye "
            f"humne ek payment link send kiya hai. Dhanyawad!"
        )

    # Safe phone override
    safe_override = os.getenv("SAFE_MODE_PHONE_OVERRIDE")
    target_phone = safe_override if (os.getenv("ENVIRONMENT") != "production" and safe_override) else recipient_phone

    logger.info("[VOICE SCRIPT] %s | Target: %s", script[:60], target_phone)

    return {
        "success": True,
        "channel": "voice",
        "script": script,
        "language": "Hinglish (hi-IN)",
        "target_phone": target_phone,
        "tts_method": "browser_speech_synthesis",
        "voice_agent": "Razorpay AI Recovery Voice Agent",
    }
