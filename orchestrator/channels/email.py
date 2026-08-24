"""
Email Recovery Channel (Resend API)
Secondary / Fallback Channel for Revenue Recovery Outreach.
"""

import os
import logging
from typing import Dict, Any

logger = logging.getLogger("orchestrator.channels.email")


def send_email_recovery(
    recipient_email: str,
    customer_name: str,
    amount: float,
    recovery_link: str,
    root_cause: str,
    force_mock: bool = False,
) -> Dict[str, Any]:
    """
    Sends an email recovery notification using Resend API.
    """
    resend_key = os.getenv("RESEND_API_KEY")
    from_email = os.getenv("RECOVERY_FROM_EMAIL", "onboarding@resend.dev")

    if force_mock or not resend_key:
        logger.info(f"[EMAIL SIMULATION] To: {recipient_email} | Amount: ₹{amount:,.2f} | Link: {recovery_link}")
        return {
            "success": True,
            "channel": "email",
            "message_id": f"sim_email_{recipient_email.split('@')[0]}_{int(amount)}",
            "recipient": recipient_email,
            "status": "delivered_simulated",
            "error": None,
        }

    try:
        import resend
        resend.api_key = resend_key

        html_body = f"""
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
            <h2 style="color: #0c2340;">Complete Your Payment</h2>
            <p>Hi {customer_name},</p>
            <p>We noticed an incomplete transaction of <strong>₹{amount:,.2f}</strong>.</p>
            <p style="margin: 25px 0;">
                <a href="{recovery_link}" style="background-color: #528FF0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Complete Payment Now
                </a>
            </p>
            <p style="color: #666; font-size: 13px;">If you have already completed this payment, please disregard this message.</p>
        </div>
        """

        params = {
            "from": from_email,
            "to": [recipient_email],
            "subject": f"Action Required: Complete your ₹{amount:,.2f} payment",
            "html": html_body,
        }

        response = resend.Emails.send(params)
        return {
            "success": True,
            "channel": "email",
            "message_id": response.get("id", "email_unknown"),
            "recipient": recipient_email,
            "status": "delivered",
            "error": None,
        }
    except Exception as e:
        logger.error(f"Resend Email error: {e}")
        return {
            "success": False,
            "channel": "email",
            "message_id": None,
            "recipient": recipient_email,
            "status": "failed",
            "error": str(e),
        }
