"""
Fast batch seed using execute_values — 1 round trip per 500 rows.
Commits each table independently so partial success is preserved.
"""
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()

import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.getenv("SUPABASE_DB_URI") or os.getenv("SUPABASE_DIRECT_DB_URI")
NOW = datetime.datetime.now(datetime.UTC).isoformat()

def conn():
    c = psycopg2.connect(DB_URL)
    c.autocommit = False
    return c

def to_pg(v):
    if isinstance(v, (dict, list)):
        return json.dumps(v)
    return v

def fast_insert(table, rows, conflict_col, skip_keys=None, batch=500):
    """execute_values batched insert — 1 SQL call per batch, very fast."""
    if not rows:
        print(f"  {table}: no rows")
        return 0

    skip = set(skip_keys or [])
    clean = []
    for r in rows:
        row = {k: v for k, v in r.items() if k not in skip and not k.startswith("_")}
        row.setdefault("created_at", NOW)
        row["updated_at"] = NOW  # always stamp
        clean.append(row)

    keys = list(clean[0].keys())
    cols = ", ".join(f'"{k}"' for k in keys)
    sql = f'INSERT INTO "{table}" ({cols}) VALUES %s ON CONFLICT ("{conflict_col}") DO NOTHING'

    c = conn()
    cur = c.cursor()
    inserted = 0
    try:
        for i in range(0, len(clean), batch):
            batch_rows = clean[i:i+batch]
            values = [tuple(to_pg(r[k]) for k in keys) for r in batch_rows]
            execute_values(cur, sql, values)
            c.commit()
            inserted += len(batch_rows)
            print(f"  {table}: {inserted}/{len(clean)}...")
    except Exception as e:
        c.rollback()
        print(f"  ERROR in {table}: {e}")
        raise
    finally:
        cur.close()
        c.close()
    return inserted


def main():
    print("=== Fast Seed ===")
    with open("data/world.json", "r", encoding="utf-8") as f:
        world = json.load(f)

    merchants = world["merchants"]
    customers = world["customers"]
    events    = world.get("events", [])
    adv       = world.get("adversarial", [])

    print(f"World: {len(merchants)}M {len(customers)}C {len(events)}ev {len(adv)}adv")

    SKIP_M = {"typical_failure_types", "typical_amounts"}

    n = fast_insert("merchants", merchants, "merchant_id", skip_keys=SKIP_M)
    print(f"Merchants done: {n}")

    n = fast_insert("customer_profiles", customers, "customer_id")
    print(f"Customers done: {n}")

    n = fast_insert("events", events, "event_id")
    print(f"Events done: {n}")

    if adv:
        n = fast_insert("events", adv, "event_id")
        print(f"Adversarial done: {n}")

    # Verify
    c = conn()
    cur = c.cursor()
    for tbl in ("merchants", "customer_profiles", "events"):
        cur.execute(f'SELECT COUNT(*) FROM "{tbl}"')
        print(f"  VERIFY {tbl}: {cur.fetchone()[0]} rows")
    cur.close()
    c.close()
    print("=== Seed Complete ===")

if __name__ == "__main__":
    main()
