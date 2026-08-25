"""
Razorpay Test Mode Order Seeder & Supabase DB Population
Creates real orders via Razorpay Test Mode API and seeds representative
recovery incident events into Supabase for live dashboard demonstration.
"""

import os
import sys
import logging
from datetime import datetime, timezone
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
load_dotenv()

logger = logging.getLogger("seed_razorpay")


SAMPLE_EVENTS = [
    {
        "event_id": "evt_rzp_001",
        "event_type": "payment_degraded",
        "amount": 12500.0,
        "currency": "INR",
        "merchant_id": "merch_techcorp",
        "customer_id": "cust_rzp_001",
        "customer_name": "Rohan Mehta",
        "customer_email": "rohan.mehta@example.com",
        "customer_phone": "+919876543211",
        "status": "pending",
        "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.94, "customer_avg_days_late": 1},
        "metadata": {
            "failure_bank": "HDFC",
            "failure_route": "gateway_axis_netbanking_v1",
            "pct_merchant_failures_same_route": 0.68,
            "error_code": "BAD_GATEWAY_TIMEOUT",
        },
    },
    {
        "event_id": "evt_rzp_002",
        "event_type": "checkout_abandoned",
        "amount": 4999.0,
        "currency": "INR",
        "merchant_id": "merch_quickkart",
        "customer_id": "cust_rzp_002",
        "customer_name": "Aarav Sharma",
        "customer_email": "aarav.sharma@example.com",
        "customer_phone": "+919876543212",
        "status": "pending",
        "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.85, "customer_avg_days_late": 2},
        "metadata": {
            "cart_items": ["Noise Cancelling Headphones Pro"],
            "time_since_abandon_minutes": 25,
            "payment_method_attempted": "upi",
        },
    },
    {
        "event_id": "evt_rzp_003",
        "event_type": "subscription_failed",
        "amount": 1999.0,
        "currency": "INR",
        "merchant_id": "merch_saasflow",
        "customer_id": "cust_rzp_003",
        "customer_name": "Pooja Hegde",
        "customer_email": "pooja.h@example.com",
        "customer_phone": "+919876543213",
        "status": "pending",
        "history": {"prior_contacts": 1, "prior_payment_success_rate": 0.88, "customer_avg_days_late": 3},
        "metadata": {
            "failure_reason": "card_expired",
            "card_last4": "8821",
            "retry_count": 2,
            "subscription_plan": "Growth Tier Monthly",
        },
    },
    {
        "event_id": "evt_rzp_004",
        "event_type": "receivable_overdue",
        "amount": 145000.0,
        "currency": "INR",
        "merchant_id": "merch_b2blogistics",
        "customer_id": "cust_rzp_004",
        "customer_name": "Apex Infra Ltd",
        "customer_email": "ap@apexinfra.in",
        "customer_phone": "+919876543214",
        "status": "pending",
        "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.60, "customer_avg_days_late": 18},
        "metadata": {
            "invoice_number": "INV-2026-8801",
            "net_terms_days": 30,
            "days_overdue": 22,
        },
    },
    {
        "event_id": "evt_rzp_005",
        "event_type": "mandate_auth_failed",
        "amount": 32000.0,
        "currency": "INR",
        "merchant_id": "merch_fitpass",
        "customer_id": "cust_rzp_005",
        "customer_name": "Vikram Sethi",
        "customer_email": "vikram.sethi@example.com",
        "customer_phone": "+919876543215",
        "status": "pending",
        "history": {"prior_contacts": 0, "prior_payment_success_rate": 0.90, "customer_avg_days_late": 0},
        "metadata": {
            "afa_step_reached": False,
            "mandate_type": "e-mandate",
            "bank": "ICICI",
            "mandate_id": "man_test_9921",
        },
    },
    {
        "event_id": "evt_rzp_006",
        "event_type": "promise_to_pay",
        "amount": 8500.0,
        "currency": "INR",
        "merchant_id": "merch_saasflow",
        "customer_id": "cust_rzp_006",
        "customer_name": "Neha Kapoor",
        "customer_email": "neha.k@example.com",
        "customer_phone": "+919876543216",
        "status": "pending",
        "history": {"prior_contacts": 1, "prior_payment_success_rate": 0.95, "customer_avg_days_late": 2},
        "metadata": {
            "promised_payment_date": "2026-08-30",
            "notes": "Customer confirmed payment via WhatsApp after salary credit.",
        },
    },
]


def seed_test_mode_orders(count: int = 6):
    key_id = os.getenv("RAZORPAY_KEY_ID")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET")

    orders = []
    if key_id and key_secret and "your_key" not in key_id:
        try:
            import razorpay
            client = razorpay.Client(auth=(key_id, key_secret))
            for i, ev in enumerate(SAMPLE_EVENTS[:count]):
                amt_paise = int(ev["amount"] * 100)
                order_payload = {
                    "amount": amt_paise,
                    "currency": ev["currency"],
                    "receipt": f"rcpt_demo_{i+1:03d}",
                    "notes": {
                        "purpose": "Razorpay Buildathon Track 3 Demo",
                        "event_id": ev["event_id"],
                        "scenario": ev["event_type"],
                    },
                }
                order = client.order.create(data=order_payload)
                ev["razorpay_ref"] = order["id"]
                orders.append(order)
                print(f"[Razorpay API] Created Test Order: {order['id']} (₹{ev['amount']:,.2f}) for {ev['customer_name']}")
        except Exception as e:
            print(f"[Razorpay API] Seeding encountered error: {e}")
    else:
        print("[Razorpay API] Live keys not set, proceeding with synthetic references.")

    # Seed into Supabase if configured
    sb_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    sb_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if sb_url and sb_key:
        try:
            from supabase import create_client
            supabase = create_client(sb_url, sb_key)
            records = []
            for ev in SAMPLE_EVENTS[:count]:
                record = {
                    "event_id": ev["event_id"],
                    "event_type": ev["event_type"],
                    "amount": ev["amount"],
                    "currency": ev["currency"],
                    "merchant_id": ev["merchant_id"],
                    "customer_id": ev["customer_id"],
                    "customer_name": ev["customer_name"],
                    "customer_email": ev["customer_email"],
                    "customer_phone": ev["customer_phone"],
                    "razorpay_ref": ev.get("razorpay_ref", f"synth_{ev['event_id']}"),
                    "status": ev["status"],
                    "history": ev["history"],
                    "metadata": ev["metadata"],
                }
                records.append(record)

            res = supabase.table("events").upsert(records).execute()
            print(f"[Supabase DB] Upserted {len(records)} events into 'events' table.")
        except Exception as e:
            print(f"[Supabase DB] Error inserting events: {e}")

    print(f"\nCompleted seeding: {len(orders)} Razorpay orders, {min(count, len(SAMPLE_EVENTS))} events initialized.")
    return orders


if __name__ == "__main__":
    seed_test_mode_orders(6)
