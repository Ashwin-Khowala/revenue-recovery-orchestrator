"""Seed the 54k customer episodes — runs as background job."""
import os, sys, json, datetime, uuid
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv; load_dotenv()

import psycopg2
from psycopg2.extras import execute_values

DB_URL = os.getenv("SUPABASE_DB_URI") or os.getenv("SUPABASE_DIRECT_DB_URI")
NOW = datetime.datetime.now(datetime.UTC).isoformat()

def to_pg(v):
    return json.dumps(v) if isinstance(v, (dict, list)) else v

KEYS = ["id", "customer_id", "merchant_id", "episode_type", "amount", "channel",
        "outcome", "response_hours", "notes", "event_id", "metadata", "created_at"]

def main():
    with open("data/world.json", "r", encoding="utf-8") as f:
        world = json.load(f)
    episodes = world.get("episodes", [])
    print(f"Seeding {len(episodes)} episodes...")

    c = psycopg2.connect(DB_URL); c.autocommit = False; cur = c.cursor()
    cols = ", ".join(f'"{k}"' for k in KEYS)
    # No conflict target — episodes are append-only history; just skip dupes
    sql = f'INSERT INTO "customer_episodes" ({cols}) VALUES %s ON CONFLICT DO NOTHING'
    inserted = 0
    BATCH = 1000
    for i in range(0, len(episodes), BATCH):
        batch = episodes[i:i+BATCH]
        vals = []
        for ep in batch:
            ep.setdefault("created_at", NOW)
            ep["id"] = str(uuid.uuid4())  # inject UUID
            vals.append(tuple(to_pg(ep.get(k)) for k in KEYS))
        try:
            execute_values(cur, sql, vals)
            c.commit()
            inserted += len(batch)
            if inserted % 5000 == 0 or inserted >= len(episodes):
                print(f"  episodes: {inserted}/{len(episodes)}")
        except Exception as e:
            c.rollback()
            print(f"  Batch error at {i}: {e}")
    cur.execute('SELECT COUNT(*) FROM "customer_episodes"')
    print(f"VERIFY episodes: {cur.fetchone()[0]} rows")
    cur.close(); c.close()
    print("=== Episodes Done ===")

if __name__ == "__main__": main()
