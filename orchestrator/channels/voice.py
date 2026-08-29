"""
Voice Recovery Channel — Hinglish AI Voice Script Generator
============================================================
Generates conversational, cause-matched Hinglish recovery scripts for voice agents.
The dashboard and telephony pipelines (Plivo/Twilio/ElevenLabs) use these scripts.
"""

from __future__ import annotations

import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("orchestrator.channels.voice")


def generate_voice_recovery(
    customer_name: str,
    amount: float,
    root_cause: str,
    behavioral_cause: Optional[str] = None,
    subscription_archetype: Optional[str] = None,
    recipient_phone: Optional[str] = None,
    force_mock: bool = False,
) -> Dict[str, Any]:
    """
    Generates an empathetic, cause-matched Hinglish voice recovery script.
    Tailors the conversation specifically to whether the issue is technical friction,
    a 14-day subscription grace period, enterprise white-glove, or price shock.
    """
    # 1. Checkout Drop-off Specific Scripts
    if root_cause == "checkout_abandoned":
        if behavioral_cause == "technical_form_friction":
            script = (
                f"Namaste {customer_name}! Hum Razorpay partner team se bol rahe hain. "
                f"Humne dekha aapka ₹{int(amount):,} ka order ek mobile form glitch ki wajah se pause ho gaya tha. "
                f"Humne aapke WhatsApp par ek direct 1-click Razorpay resume link bheja hai jo bina kisi error ke "
                f"aapka order turant complete kar dega. Kripya link check karein. Dhanyawad!"
            )
        elif behavioral_cause == "price_shipping_shock":
            script = (
                f"Namaste {customer_name}! Humne dekha aapka ₹{int(amount):,} ka cart pending hai. "
                f"Humne aapke liye ek exclusive Free Shipping threshold bundle link activate kiya hai. "
                f"Aap UPI ya card se bina extra charges ke order complete kar sakte hain. Thank you!"
            )
        elif behavioral_cause == "genuine_hesitation_trust":
            script = (
                f"Namaste {customer_name}! Humne dekha aapka cart ready hai. "
                f"Hum aapko assure karna chahte hain ki aapka ₹{int(amount):,} ka order 100% Razorpay Buyer Protection "
                f"aur 30-day easy money-back guarantee ke sath fully safe hai. Payment link aapke SMS par ready hai!"
            )
        else:
            script = (
                f"Namaste {customer_name}! Humne dekha aapka ₹{int(amount):,} ka order saved hai. "
                f"Aapke WhatsApp par secure payment link available hai. Aap UPI ya card se asani se complete kar sakte hain. Thank you!"
            )

    # 2. Subscription Billing Specific Scripts
    elif root_cause == "subscription_failed":
        if subscription_archetype == "enterprise_white_glove":
            script = (
                f"Hello {customer_name}, this is your dedicated Enterprise Account Executive from Razorpay. "
                f"We noticed a bank settlement delay on your ₹{int(amount):,} renewal invoice. "
                f"Your enterprise service remains 100% active without interruption. Please let us know if your finance team needs a revised PO or direct wire invoice."
            )
        elif subscription_archetype == "plan_downgrade_opportunity":
            script = (
                f"Namaste {customer_name}! Aapka monthly subscription ₹{int(amount):,} renewal par hai aur abhi 14-day grace period me hai. "
                f"Agar aap chahein to bina kisi interruption ke hamara 50% cheaper Starter plan switch kar sakte hain ya 30-day pause le sakte hain. Link aapke WhatsApp par hai."
            )
        elif subscription_archetype == "voluntary_churn_disengaged":
            script = (
                f"Namaste {customer_name}! Humne dekha aap kafi samay se active nahi the aur renewal hold par hai. "
                f"Agar aap service pause karna chahte hain ya free tier par switch karna chahte hain, humne aapke email par ek 1-click off-ramp link send kiya hai. Dhanyawad!"
            )
        else:
            script = (
                f"Namaste {customer_name}! Aapka ₹{int(amount):,} ka monthly subscription renewal temporary bank issue ki wajah se hold par hai. "
                f"Aapka access 14-day grace period me bilkul active hai. Kripya WhatsApp par diye gaye link se 1 tap me apna card update kar lein. Dhanyawad!"
            )

    # 3. RBI Mandate (> ₹15,000)
    elif root_cause == "mandate_auth_failed":
        script = (
            f"Namaste {customer_name}! Hum Razorpay payment recovery team se bol rahe hain. "
            f"Aapka ₹{int(amount):,} ka monthly mandate RBI verification ke bina hold par hai. "
            f"Humne aapke WhatsApp par ek secure authentication link send kiya hai. "
            f"Kripya use approve karein taaki aapki service uninterrupted rahe. Dhanyawad!"
        )

    # 4. B2B Overdue Invoices
    elif root_cause == "receivable_overdue":
        script = (
            f"Namaste {customer_name}! Ye ek friendly reminder hai aapke outstanding invoice "
            f"₹{int(amount):,} ke liye. "
            f"Payment link aapke WhatsApp aur email par available hai. "
            f"Agar koi clarification chahiye to humse connect kar sakte hain."
        )

    # 5. Generic / Degraded Routes
    else:
        script = (
            f"Namaste {customer_name}! Hum Razorpay partner ki taraf se baat kar rahe hain. "
            f"Aapka ₹{int(amount):,} ka payment issue resolve karne ke liye "
            f"humne ek secure link send kiya hai. Dhanyawad!"
        )

    # Safe phone override in non-production
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
