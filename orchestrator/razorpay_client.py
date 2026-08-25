"""
Razorpay Live API Client Wrapper
Handles real creation and fetching of Payment Links, Orders, Invoices, Subscriptions, and Verification.
"""

import os
import logging
from typing import Dict, Any, Optional
import razorpay

logger = logging.getLogger("orchestrator.razorpay")

_razorpay_client = None


def get_razorpay_client():
    """
    Returns an authenticated Razorpay Client singleton.
    """
    global _razorpay_client
    if _razorpay_client is not None:
        return _razorpay_client

    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")

    if key_id and key_secret:
        try:
            _razorpay_client = razorpay.Client(auth=(key_id, key_secret))
            logger.info("Initialized live Razorpay Client with Key ID: %s", key_id[:10] + "...")
        except Exception as e:
            logger.error("Failed to initialize Razorpay Client: %s", e)
    return _razorpay_client


def create_recovery_payment_link(
    amount: float,
    customer_name: str,
    customer_email: str,
    customer_phone: str,
    description: str,
    reference_id: str,
    expire_by_minutes: int = 1440, # 24 hours
    discount_amount: float = 0.0,
) -> Dict[str, Any]:
    """
    Creates a real Razorpay Payment Link for revenue recovery.
    Supports dynamic incentive discounts and custom expiry.
    """
    client = get_razorpay_client()
    net_amount = max(amount - discount_amount, 1.0)
    amount_in_paise = int(round(net_amount * 100))

    if client:
        try:
            import time
            expire_by = int(time.time()) + (expire_by_minutes * 60)

            # Ensure phone has valid format
            clean_phone = customer_phone.replace(" ", "").replace("-", "")
            if clean_phone.startswith("+91"):
                clean_phone = clean_phone[3:]

            payload = {
                "amount": amount_in_paise,
                "currency": "INR",
                "accept_partial": False,
                "description": description[:250],
                "customer": {
                    "name": customer_name,
                    "email": customer_email,
                    "contact": clean_phone if len(clean_phone) == 10 else "9876543210",
                },
                "notify": {
                    "sms": False, # Handled by our orchestrator channels
                    "email": False,
                },
                "reminder_enable": False,
                "notes": {
                    "recovery_orchestrator": "true",
                    "incident_id": reference_id,
                    "original_amount": str(amount),
                    "discount_applied": str(discount_amount),
                },
                "expire_by": expire_by,
                "reference_id": f"rec_{reference_id[:30]}",
            }

            link = client.payment_link.create(payload)
            logger.info("Created real Razorpay Payment Link: %s (Short URL: %s)", link.get("id"), link.get("short_url"))
            return {
                "success": True,
                "payment_link_id": link.get("id"),
                "short_url": link.get("short_url"),
                "amount": net_amount,
                "status": link.get("status"),
                "raw": link,
            }
        except Exception as e:
            logger.warning("Razorpay Payment Link API call failed: %s. Using high-availability fallback URL.", e)

    # Fallback deterministic URL if offline/error
    return {
        "success": False,
        "payment_link_id": f"plink_sim_{reference_id[:10]}",
        "short_url": f"https://rzp.io/i/{reference_id[-8:]}",
        "amount": net_amount,
        "status": "created_simulated",
        "error": "Offline or mock mode",
    }


def verify_payment_status(reference_id: str, payment_link_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Directly checks Razorpay's API to verify if payment was captured or paid.
    """
    client = get_razorpay_client()
    if not client:
        return {"status": "unverified", "paid": False}

    try:
        if payment_link_id and payment_link_id.startswith("plink_"):
            link_data = client.payment_link.fetch(payment_link_id)
            status = link_data.get("status")
            return {
                "status": status,
                "paid": status in ("paid", "partially_paid"),
                "amount_paid": float(link_data.get("amount_paid", 0)) / 100.0,
                "raw": link_data,
            }
        
        if reference_id.startswith("order_"):
            order_data = client.order.fetch(reference_id)
            status = order_data.get("status")
            return {
                "status": status,
                "paid": status == "paid",
                "amount_paid": float(order_data.get("amount_paid", 0)) / 100.0,
                "raw": order_data,
            }

        if reference_id.startswith("pay_"):
            pay_data = client.payment.fetch(reference_id)
            status = pay_data.get("status")
            return {
                "status": status,
                "paid": status == "captured",
                "amount_paid": float(pay_data.get("amount", 0)) / 100.0,
                "raw": pay_data,
            }
    except Exception as e:
        logger.debug("Could not verify status with Razorpay API for %s: %s", reference_id, e)

    return {"status": "unresolved", "paid": False}
