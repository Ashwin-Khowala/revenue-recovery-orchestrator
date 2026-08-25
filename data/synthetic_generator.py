"""
Synthetic Data Generator for AI Revenue Recovery
Generates realistic, randomized Indian customer profiles, failure scenarios,
and transaction batches for Track 3 evaluations and live simulations.
"""

import random
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any

INDIAN_FIRST_NAMES = [
  "Aarav", "Ananya", "Rohan", "Pooja", "Vikram", "Sneha", "Aditya", "Neha",
  "Kavita", "Rahul", "Priya", "Amit", "Divya", "Siddharth", "Meera", "Karan",
  "Sunita", "Rajesh", "Tanvi", "Nikhil", "Deepak", "Swati", "Harsh", "Ishita"
]

INDIAN_LAST_NAMES = [
  "Sharma", "Verma", "Mehta", "Hegde", "Iyer", "Patel", "Reddy", "Gupta",
  "Nair", "Deshmukh", "Singhania", "Mukherjee", "Kapoor", "Bose", "Choudhury", "Bhat"
]

COMPANY_PREFIXES = [
  "TechMatrix", "CloudNine", "NexusLogix", "VortexPay", "ZenithMedia",
  "ApexCraft", "OmniHealth", "DataBridge", "Finova", "DesignStudio", "RetailFlow"
]

COMPANY_SUFFIXES = ["Corp", "Pvt Ltd", "Technologies", "Enterprises", "Solutions", "LLP"]

ROOT_CAUSES = [
  "payment_degraded",
  "mandate_auth_failed",
  "receivable_overdue",
  "checkout_abandoned",
  "subscription_failed",
  "promise_to_pay",
]


def generate_synthetic_phone() -> str:
    """Generates a randomized synthetic Indian phone number (+91-9XXXX-XXXXX)."""
    prefix = random.choice(["98", "97", "99", "91", "88", "80", "70"])
    digits = "".join([str(random.randint(0, 9)) for _ in range(8)])
    return f"+91{prefix}{digits}"


def generate_synthetic_customer(is_business: bool = False) -> Dict[str, str]:
    """Generates a synthetic customer or B2B enterprise."""
    first = random.choice(INDIAN_FIRST_NAMES)
    last = random.choice(INDIAN_LAST_NAMES)
    name = f"{first} {last}"
    phone = generate_synthetic_phone()
    
    if is_business:
        comp = f"{random.choice(COMPANY_PREFIXES)} {random.choice(COMPANY_SUFFIXES)}"
        name = f"{comp} ({first})"
        email = f"finance@{comp.lower().replace(' ', '')}.com"
    else:
        email = f"{first.lower()}.{last.lower()}{random.randint(10, 99)}@gmail.com"

    return {
        "name": name,
        "email": email,
        "phone": phone,
        "customer_id": f"cust_{first.lower()}_{last.lower()}_{random.randint(100, 999)}",
    }


def generate_synthetic_incident(
    root_cause: str = None,
    amount: float = None,
    incident_id: str = None,
) -> Dict[str, Any]:
    """Generates a fully formed synthetic recovery incident."""
    rc = root_cause or random.choice(ROOT_CAUSES)
    is_b2b = rc == "receivable_overdue"
    cust = generate_synthetic_customer(is_business=is_b2b)
    
    if amount is None:
        if rc == "receivable_overdue":
            amount = float(random.choice([120000, 145000, 180000, 250000]))
        elif rc == "mandate_auth_failed":
            amount = float(random.choice([18500, 24000, 28500, 35000]))
        elif rc == "payment_degraded":
            amount = float(random.choice([8500, 12000, 15000]))
        elif rc == "checkout_abandoned":
            amount = float(random.choice([1999, 3499, 4999, 7999]))
        elif rc == "subscription_failed":
            amount = float(random.choice([2999, 4999, 6999]))
        else:
            amount = float(random.choice([35000, 52000, 75000]))

    evt_id = incident_id or f"evt_syn_{uuid.uuid4().hex[:8]}"

    return {
        "event_id": evt_id,
        "event_type": rc,
        "amount": amount,
        "customer_name": cust["name"],
        "customer_email": cust["email"],
        "customer_phone": cust["phone"],
        "customer_id": cust["customer_id"],
        "razorpay_ref": f"plink_syn_{uuid.uuid4().hex[:10]}",
        "created_at": datetime.utcnow().isoformat() + "Z",
        "history": {
            "prior_payment_rate": round(random.uniform(0.75, 0.98), 2),
            "past_disputes": 0,
            "days_overdue": random.randint(1, 14) if rc == "receivable_overdue" else 0,
        },
        "metadata": {
            "synthetic": True,
            "channel_preference": random.choice(["telegram", "whatsapp", "voice"]),
        },
    }


def generate_synthetic_batch(size: int = 100) -> List[Dict[str, Any]]:
    """Generates a balanced batch of synthetic incidents for empirical benchmarks."""
    batch = []
    for i in range(size):
        rc = ROOT_CAUSES[i % len(ROOT_CAUSES)]
        batch.append(generate_synthetic_incident(root_cause=rc, incident_id=f"evt_bench_{i+1:03d}"))
    return batch


if __name__ == "__main__":
    sample = generate_synthetic_incident()
    print("Sample Synthetic Incident:")
    print(sample)
