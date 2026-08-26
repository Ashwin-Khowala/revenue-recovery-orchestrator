"""
Database Seeder — uses direct psycopg2 connection (bypasses Supabase RLS)
for bulk data insertion. Falls back to COPY for maximum speed.

Usage:
    python scripts/seed_db.py                      # full world seed
    python scripts/seed_db.py --events-only         # reseed events only
    python scripts/seed_db.py --skip-episodes       # skip the 54k episodes (faster dev loop)
"""

import os
import sys
import json
import time
import argparse
import logging
from typing import List, Dict, Any
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_db")


def get_conn():
    """Direct psycopg2 connection — bypasses RLS entirely."""
    try:
        import psycopg2
        db_url = os.getenv("SUPABASE_DB_URI") or os.getenv("SUPABASE_DIRECT_DB_URI")
        if not db_url:
            raise ValueError("SUPABASE_DB_URI not set in .env")
        conn = psycopg2.connect(db_url)
        conn.autocommit = False
        return conn
    except ImportError:
        logger.error("psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)


def upsert_batch(cur, table: str, rows: List[Dict], conflict_col: str, label: str = ""):
    """Generic UPSERT with ON CONFLICT DO NOTHING for safe re-runs."""
    if not rows:
        return 0

    now = datetime.utcnow().isoformat()
    # Inject timestamps for Prisma @updatedAt/@default(now()) fields
    for row in rows:
        row.setdefault("created_at", now)
        if "updated_at" in row or table in ("merchants", "customer_profiles", "events"):
            row["updated_at"] = now  # always overwrite

    keys = list(rows[0].keys())
    cols = ", ".join(f'"{k}"' for k in keys)
    placeholders = ", ".join(["%s"] * len(keys))
    sql = f'INSERT INTO "{table}" ({cols}) VALUES ({placeholders}) ON CONFLICT ("{conflict_col}") DO NOTHING'
    
    success = 0
    for row in rows:
        try:
            values = [
                json.dumps(v) if isinstance(v, (dict, list)) else v
                for v in [row[k] for k in keys]
            ]
            cur.execute(sql, values)
            success += 1
        except Exception as e:
            logger.debug(f"  Row skip ({label}): {e}")
    return success


def seed_merchants(cur, merchants: List[Dict]) -> int:
    clean = []
    for m in merchants:
        row = {k: v for k, v in m.items() if not k.startswith("_") 
               and k not in ("typical_failure_types", "typical_amounts")}
        clean.append(row)
    
    n = upsert_batch(cur, "merchants", clean, "merchant_id", "Merchants")
    
    # Seed one owner merchant_user per merchant
    users = []
    for m in clean:
        users.append({
            "merchant_id": m["merchant_id"],
            "email": m.get("email", f"owner@{m['merchant_id']}.in"),
            "name": m.get("name", m["merchant_id"]),
            "role": "owner",
        })
    nu = upsert_batch(cur, "merchant_users", users, "id", "MerchantUsers")
    logger.info(f"  Merchants: {n}, MerchantUsers: {nu}")
    return n


def seed_customers(cur, customers: List[Dict]) -> int:
    clean = [{k: v for k, v in c.items() if not k.startswith("_")} for c in customers]
    n = upsert_batch(cur, "customer_profiles", clean, "customer_id", "Customers")
    logger.info(f"  Customers: {n}")
    return n


def seed_episodes(cur, episodes: List[Dict]) -> int:
    # Episodes have no stable PK from generator — use INSERT IGNORE
    keys = ["customer_id", "merchant_id", "episode_type", "amount", "channel",
            "outcome", "response_hours", "notes", "event_id", "metadata", "created_at"]
    
    sql = (
        'INSERT INTO "customer_episodes" '
        f'({", ".join(chr(34)+k+chr(34) for k in keys)}) '
        f'VALUES ({", ".join(["%s"]*len(keys))}) '
        'ON CONFLICT DO NOTHING'
    )
    
    success = 0
    for ep in episodes:
        try:
            values = []
            for k in keys:
                v = ep.get(k)
                if isinstance(v, (dict, list)):
                    v = json.dumps(v)
                values.append(v)
            cur.execute(sql, values)
            success += 1
        except Exception as e:
            logger.debug(f"  Episode skip: {e}")
    
    logger.info(f"  Episodes: {success}/{len(episodes)}")
    return success


def seed_events(cur, events: List[Dict], label: str = "Events") -> int:
    clean = []
    for e in events:
        row = {k: v for k, v in e.items() if not k.startswith("_")}
        clean.append(row)
    n = upsert_batch(cur, "events", clean, "event_id", label)
    logger.info(f"  {label}: {n}")
    return n


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--events-only", action="store_true")
    parser.add_argument("--skip-episodes", action="store_true")
    parser.add_argument("--customers", type=int, default=2000)
    parser.add_argument("--events", type=int, default=500)
    parser.add_argument("--from-file", default="data/world.json")
    args = parser.parse_args()

    logger.info("Revenue Recovery Intelligence Platform — DB Seeder (direct psycopg2)")
    logger.info("=" * 60)

    # Connect
    conn = get_conn()
    cur = conn.cursor()

    # Load world
    if os.path.exists(args.from_file) and not args.events_only:
        logger.info(f"Loading {args.from_file}...")
        with open(args.from_file, "r", encoding="utf-8") as f:
            world = json.load(f)
    else:
        logger.info("Generating fresh world...")
        sys.path.insert(0, os.path.join(ROOT, "data"))
        from world_generator import generate_world  # type: ignore[import-not-found]
        world = generate_world(
            num_merchants=20,
            num_customers=args.customers,
            num_events=args.events,
        )

    merchants  = world["merchants"]
    customers  = world["customers"]
    episodes   = world.get("episodes", [])
    events     = world.get("events", [])
    adversarial = world.get("adversarial", [])

    logger.info(f"World: {len(merchants)}M  {len(customers)}C  {len(episodes)}ep  {len(events)}ev  {len(adversarial)}adv")

    start = time.time()

    try:
        if not args.events_only:
            logger.info("\n Seeding Merchants...")
            seed_merchants(cur, merchants)
            conn.commit()

            logger.info("\n Seeding Customers...")
            seed_customers(cur, customers)
            conn.commit()

            if not args.skip_episodes:
                logger.info(f"\n Seeding {len(episodes)} Episodes (this takes ~30s)...")
                # Commit every 5000 episodes to avoid huge transactions
                chunk = 5000
                for i in range(0, len(episodes), chunk):
                    seed_episodes(cur, episodes[i:i+chunk])
                    conn.commit()
                    logger.info(f"   Committed episodes {i}–{min(i+chunk, len(episodes))}")
            else:
                logger.info("\n  Skipping episodes")

        logger.info("\n Seeding Events...")
        seed_events(cur, events, "Events")
        conn.commit()

        if adversarial:
            logger.info(f"\n Seeding {len(adversarial)} Adversarial Events...")
            seed_events(cur, adversarial, "Adversarial")
            conn.commit()

    except Exception as e:
        conn.rollback()
        logger.error(f"Seed failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

    elapsed = time.time() - start
    logger.info(f"\nDone in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
