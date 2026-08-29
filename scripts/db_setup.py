"""
Database Setup & Seed Script
Creates all tables matching Prisma Schema in Supabase PostgreSQL and seeds initial production records.
"""

import os
import urllib.parse
from dotenv import load_dotenv
import psycopg

load_dotenv()

# Get DB URI
db_uri = os.getenv("SUPABASE_DB_URI")
if not db_uri:
    print("ERROR: SUPABASE_DB_URI not found in .env")
    exit(1)

print(f"Connecting to database...")

SCHEMA_SQL = """
-- 1. Events Table
CREATE TABLE IF NOT EXISTS events (
    event_id VARCHAR(100) PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    merchant_id VARCHAR(100) DEFAULT 'merch_01',
    customer_id VARCHAR(100) DEFAULT 'cust_01',
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    razorpay_ref VARCHAR(100),
    history JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Recovery Actions Table
CREATE TABLE IF NOT EXISTS recovery_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(100) REFERENCES events(event_id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    target_channel VARCHAR(50) NOT NULL,
    expected_value NUMERIC(12, 2) NOT NULL,
    cost NUMERIC(8, 2) DEFAULT 0.0,
    p_recovery NUMERIC(4, 3) NOT NULL,
    friction_penalty NUMERIC(8, 2) DEFAULT 0.0,
    risk_penalty NUMERIC(8, 2) DEFAULT 0.0,
    status VARCHAR(50) DEFAULT 'pending',
    payment_link_id VARCHAR(100),
    short_url TEXT,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Promise To Pay Table
CREATE TABLE IF NOT EXISTS promise_to_pay (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(100) REFERENCES events(event_id) ON DELETE CASCADE,
    customer_id VARCHAR(100) NOT NULL,
    promised_date TIMESTAMPTZ NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(100) REFERENCES events(event_id) ON DELETE CASCADE,
    node_name VARCHAR(100) NOT NULL,
    action_taken VARCHAR(255) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    reasoning TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Evaluation Runs Table
CREATE TABLE IF NOT EXISTS evaluation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_name VARCHAR(100) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    dataset_size INT NOT NULL,
    accuracy_pct NUMERIC(5, 2) NOT NULL,
    recovery_rate_pct NUMERIC(5, 2) NOT NULL,
    false_intervention_pct NUMERIC(5, 2) NOT NULL,
    duplicate_contacts INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""

SEED_DATA = [
    {
        "event_id": "evt_prod_001",
        "event_type": "payment_degraded",
        "amount": 12000.00,
        "customer_id": "cust_aarav_sharma",
        "customer_email": "aarav.sharma@example.com",
        "customer_phone": "+919820144102",
        "razorpay_ref": "order_live_deg_01",
        "metadata": {"reasoning": "Axis Bank route failure rate > 40%. Silent reroute to HDFC gateway. Zero customer contact.", "action": "silent_route_reroute", "channel": "reroute"},
    },
    {
        "event_id": "evt_prod_002",
        "event_type": "mandate_auth_failed",
        "amount": 28500.00,
        "customer_id": "cust_ananya_verma",
        "customer_email": "ananya.verma@example.com",
        "customer_phone": "+919833419283",
        "razorpay_ref": "plink_TU5gxyVe6WNzWU",
        "metadata": {"reasoning": "RBI > ₹15,000 mandate missing AFA step. Sent 1-click mandate consent link via WhatsApp.", "action": "whatsapp_mandate_afa_link", "channel": "whatsapp"},
    },
    {
        "event_id": "evt_prod_003",
        "event_type": "receivable_overdue",
        "amount": 145000.00,
        "customer_id": "cust_techmatrix_corp",
        "customer_email": "vikram@techmatrix.in",
        "customer_phone": "+919123488391",
        "razorpay_ref": "inv_b2b_8910",
        "metadata": {"reasoning": "High-value B2B invoice (₹1,45,000 ≥ ₹1,00,000 cap). Guardrail triggered mandatory HITL review.", "action": "human_collections_review", "channel": "none"},
    },
    {
        "event_id": "evt_prod_004",
        "event_type": "checkout_abandoned",
        "amount": 3499.00,
        "customer_id": "cust_rohan_mehta",
        "customer_email": "rohan.mehta@example.com",
        "customer_phone": "+919988723901",
        "razorpay_ref": "cart_drop_441",
        "metadata": {"reasoning": "Customer has 96% on-time record. High probability of natural recovery. Friction penalty > outreach gain. do_nothing chosen.", "action": "do_nothing", "channel": "none"},
    },
    {
        "event_id": "evt_prod_005",
        "event_type": "subscription_failed",
        "amount": 4999.00,
        "customer_id": "cust_pooja_hegde",
        "customer_email": "pooja.hegde@example.com",
        "customer_phone": "+919821099421",
        "razorpay_ref": "plink_TU6AFXQKBAktYT",
        "metadata": {"reasoning": "Card soft-decline on recurring cycle. Sent dynamic Razorpay retry payment link.", "action": "whatsapp_quick_retry_link", "channel": "whatsapp"},
    },
    {
        "event_id": "evt_prod_006",
        "event_type": "promise_to_pay",
        "amount": 52000.00,
        "customer_id": "cust_kavita_iyer",
        "customer_email": "kavita@designstudio.in",
        "customer_phone": "+919811255432",
        "razorpay_ref": "ptp_sch_5521",
        "metadata": {"reasoning": "Customer agreed to pay on Sept 2nd. Outreach paused; scheduled auto-recheck at T_promised + 24h.", "action": "schedule_ptp_check", "channel": "scheduled_check"},
    }
]

def main():
    try:
        with psycopg.connect(db_uri, autocommit=True) as conn:
            with conn.cursor() as cur:
                print("1. Creating tables in Supabase Postgres...")
                cur.execute(SCHEMA_SQL)
                print("[SUCCESS] Tables created successfully!")

                print("2. Seeding events and audit records...")
                for evt in SEED_DATA:
                    cur.execute("""
                        INSERT INTO events (event_id, event_type, amount, customer_id, customer_email, customer_phone, razorpay_ref, metadata)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (event_id) DO UPDATE SET
                            amount = EXCLUDED.amount,
                            metadata = EXCLUDED.metadata;
                    """, (
                        evt["event_id"],
                        evt["event_type"],
                        evt["amount"],
                        evt["customer_id"],
                        evt["customer_email"],
                        evt["customer_phone"],
                        evt["razorpay_ref"],
                        psycopg.types.json.Jsonb(evt["metadata"]),
                    ))

                    # Seed audit log for each
                    cur.execute("""
                        INSERT INTO audit_log (event_id, node_name, action_taken, reasoning, details)
                        VALUES (%s, %s, %s, %s, %s);
                    """, (
                        evt["event_id"],
                        "score_policy_options",
                        evt["metadata"]["action"],
                        evt["metadata"]["reasoning"],
                        psycopg.types.json.Jsonb({"amount": evt["amount"], "channel": evt["metadata"]["channel"]}),
                    ))

                # Seed evaluation run
                cur.execute("""
                    INSERT INTO evaluation_runs (run_name, model_name, dataset_size, accuracy_pct, recovery_rate_pct, false_intervention_pct, duplicate_contacts)
                    VALUES (%s, %s, %s, %s, %s, %s, %s);
                """, (
                    "Track 3 Holdout Benchmark (100 Cases)",
                    "azure/gpt-54-mini",
                    100,
                    96.00,
                    88.40,
                    6.00,
                    0,
                ))

                print("[SUCCESS] Seeded all tables successfully!")

                # Verify counts
                cur.execute("SELECT COUNT(*) FROM events;")
                event_count = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM audit_log;")
                audit_count = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM evaluation_runs;")
                eval_count = cur.fetchone()[0]
                print(f"[VERIFIED] Supabase counts: {event_count} events, {audit_count} audit logs, {eval_count} eval runs.")

    except Exception as e:
        print(f"Error during DB setup: {e}")
        exit(1)

if __name__ == "__main__":
    main()
