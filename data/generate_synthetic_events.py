"""
Synthetic Event Dataset Generator (500 Records)
Generates high-fidelity labeled events across all 6 root-cause categories
for model benchmarking, baseline comparison, and hold-out evaluation.
"""

import json
import random
import os
from datetime import datetime, timedelta, timezone

ROOT_CAUSES = [
    "subscription_failed",
    "checkout_abandoned",
    "receivable_overdue",
    "payment_degraded",
    "mandate_auth_failed",
    "promise_to_pay",
]

BANKS = ["HDFC", "ICICI", "SBI", "AXIS", "KOTAK"]
NAMES = [
    "Aarav Sharma", "Diya Patel", "Rohan Mehta", "Ananya Verma", "Vikram Singh",
    "Priya Nair", "Aditya Roy", "Sneha Rao", "Kabir Gupta", "Ishaan Malhotra",
    "Pooja Joshi", "Siddharth Sen", "Meera Iyer", "Karan Kapoor", "Tanvi Desai"
]


def generate_single_event(idx: int) -> dict:
    cause = random.choices(
        ROOT_CAUSES,
        weights=[0.25, 0.20, 0.20, 0.15, 0.10, 0.10],
        k=1
    )[0]

    name = random.choice(NAMES)
    phone = f"+91{random.randint(9000000000, 9999999999)}"
    email = f"{name.lower().replace(' ', '.')}@example.com"
    customer_id = f"cust_{idx:04d}"
    merchant_id = f"merch_{random.randint(1, 5):02d}"

    # Amounts tailored to category
    if cause == "mandate_auth_failed":
        amount = random.randint(15500, 75000) # strictly > 15,000 for RBI mandate rule
    elif cause == "receivable_overdue":
        amount = random.choice([25000, 48000, 120000, 250000, 500000])
    elif cause == "checkout_abandoned":
        amount = random.randint(899, 14999)
    else:
        amount = random.choice([499, 1299, 2999, 5999, 12000, 25000])

    prior_success = round(random.uniform(0.40, 0.98), 2)
    prior_contacts = random.choices([0, 1, 2, 3], weights=[0.60, 0.25, 0.10, 0.05])[0]

    history = {
        "prior_contacts": prior_contacts,
        "prior_payment_success_rate": prior_success,
        "customer_avg_days_late": random.randint(0, 12),
    }

    metadata = {}
    if cause == "payment_degraded":
        metadata = {
            "failure_bank": random.choice(BANKS),
            "failure_route": "gateway_axis_netbanking_v1",
            "pct_merchant_failures_same_route": round(random.uniform(0.40, 0.85), 2),
            "error_code": "BAD_GATEWAY_TIMEOUT",
        }
    elif cause == "mandate_auth_failed":
        metadata = {
            "mandate_amount": amount,
            "afa_step_reached": False,
            "recurring_period": "monthly",
        }
    elif cause == "checkout_abandoned":
        metadata = {
            "cart_items": ["SaaS Pro Subscription", "API Tier Add-on"],
            "time_since_abandon_minutes": random.randint(15, 120),
            "payment_method_attempted": random.choice(["upi", "card", "netbanking"]),
        }
    elif cause == "receivable_overdue":
        metadata = {
            "invoice_id": f"INV-2026-{idx:04d}",
            "days_overdue": random.randint(3, 45),
            "terms": "Net 30",
        }
    elif cause == "promise_to_pay":
        promised_date = (datetime.now(timezone.utc) + timedelta(days=random.randint(2, 7))).strftime("%Y-%m-%d")
        metadata = {
            "promised_pay_date": promised_date,
            "notes": "Customer confirmed salary credit on 1st of month.",
        }

    return {
        "event_id": f"evt_{idx:04d}",
        "event_type": cause,
        "amount": amount,
        "currency": "INR",
        "merchant_id": merchant_id,
        "customer_id": customer_id,
        "customer_name": name,
        "customer_email": email,
        "customer_phone": phone,
        "created_at": (datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 48))).isoformat(),
        "razorpay_ref": f"order_synth_{idx:04d}",
        "history": history,
        "metadata": metadata,
        "ground_truth_root_cause": cause,
    }


def generate_batch(count: int = 500):
    events = [generate_single_event(i + 1) for i in range(count)]
    
    os.makedirs("evals", exist_ok=True)
    
    # 80% train/tuning set, 20% held-out test set
    split_idx = int(count * 0.8)
    training_set = events[:split_idx]
    holdout_set = events[split_idx:]

    with open("data/synthetic_events_500.json", "w") as f:
        json.dump(events, f, indent=2)

    with open("evals/labeled_holdout.json", "w") as f:
        json.dump(holdout_set, f, indent=2)

    print(f"Generated {count} synthetic events successfully.")
    print(f"- Full batch: data/synthetic_events_500.json ({len(events)} records)")
    print(f"- Held-out evaluation set: evals/labeled_holdout.json ({len(holdout_set)} records)")


if __name__ == "__main__":
    generate_batch(500)
