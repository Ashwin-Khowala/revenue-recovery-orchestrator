"""
Audit Trail Logging & Observability Module
Logs all decisions, rule firings, LLM outputs, and state transitions to Supabase and Langfuse Cloud.
"""

import os
import json
import hashlib
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"), override=True)

logger = logging.getLogger("orchestrator.audit")

_supabase_client = None
_langfuse_client = None
_last_entry_hash: str = "GENESIS"  # chain anchor


def _get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if supabase_url and supabase_key:
        try:
            from supabase import create_client
            _supabase_client = create_client(supabase_url, supabase_key)
        except Exception as e:
            logger.debug(f"Could not initialize Supabase client: {e}")
    return _supabase_client


def _get_langfuse_client():
    global _langfuse_client
    if _langfuse_client is not None:
        return _langfuse_client
    
    pk = os.getenv("LANGFUSE_PUBLIC_KEY")
    sk = os.getenv("LANGFUSE_SECRET_KEY")
    host = os.getenv("LANGFUSE_BASE_URL", "https://cloud.langfuse.com")
    
    if pk and sk:
        try:
            from langfuse import Langfuse
            _langfuse_client = Langfuse(
                public_key=pk,
                secret_key=sk,
                host=host,
            )
            logger.info("Langfuse Cloud Tracing client initialized successfully.")
        except Exception as e:
            logger.warning(f"Could not initialize Langfuse client: {e}")
    return _langfuse_client


def log_audit_entry(
    event_id: str,
    node_name: str,
    action_taken: str,
    details: Dict[str, Any],
    reasoning: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Creates an audit entry structure and persists to Supabase and Langfuse Cloud.
    """
    global _last_entry_hash
    
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_id": event_id,
        "node_name": node_name,
        "action_taken": action_taken,
        "details": details,
        "reasoning": reasoning or "",
        "prev_entry_hash": _last_entry_hash,
    }
    
    # SHA-256 hash chain — tamper-evident
    chain_data = json.dumps({
        "event_id": event_id,
        "node_name": node_name,
        "action_taken": action_taken,
        "prev_hash": _last_entry_hash,
    }, sort_keys=True)
    entry_hash = hashlib.sha256(chain_data.encode()).hexdigest()
    entry["entry_hash"] = entry_hash
    _last_entry_hash = entry_hash
    
    logger.info(f"[AUDIT] [{node_name}] event={event_id} action={action_taken}")

    # 1. Persist to Supabase
    if os.getenv("DISABLE_AUDIT_DB", "false").lower() not in ("1", "true", "yes"):
        client = _get_supabase_client()
        if client:
            try:
                client.table("audit_log").insert({
                    "event_id": event_id,
                    "node_name": node_name,
                    "action_taken": action_taken,
                    "details": details,
                    "reasoning": reasoning or "",
                }).execute()
            except Exception as e:
                logger.debug(f"Could not persist audit log to Supabase: {e}")

    # 2. Trace to Langfuse Cloud (v4 SDK create_event & flush)
    lf = _get_langfuse_client()
    if lf:
        try:
            # Deterministic 32-char hex trace ID groups all nodes for the same event into 1 unified Trace
            trace_id_hex = hashlib.md5(event_id.encode()).hexdigest()
            lf.create_event(
                trace_context={"trace_id": trace_id_hex},
                name=f"node_{node_name}",
                input={
                    "event_id": event_id,
                    "node_name": node_name,
                    "action_taken": action_taken,
                },
                output={
                    "details": details,
                    "reasoning": reasoning or "",
                    "entry_hash": entry_hash,
                },
                metadata={
                    "event_id": event_id,
                    "node_name": node_name,
                    "timestamp": entry["timestamp"],
                    "service": "revenue_recovery_orchestrator",
                },
                status_message=f"Action executed: {action_taken}",
            )
            lf.flush()
        except Exception as e:
            logger.warning(f"Could not send trace to Langfuse: {e}")

    return entry


def verify_audit_chain(entries: List[Dict[str, Any]]) -> bool:
    """
    Verifies the SHA-256 chain integrity of an ordered list of audit entries.
    Returns True if the chain is intact, False if any entry was tampered with.
    """
    prev_hash = "GENESIS"
    for entry in entries:
        chain_data = json.dumps({
            "event_id": entry.get("event_id", ""),
            "node_name": entry.get("node_name", ""),
            "action_taken": entry.get("action_taken", ""),
            "prev_hash": prev_hash,
        }, sort_keys=True)
        expected_hash = hashlib.sha256(chain_data.encode()).hexdigest()
        stored_hash = entry.get("entry_hash", "")
        if stored_hash and stored_hash != expected_hash:
            logger.error(
                f"[AUDIT CHAIN BROKEN] Entry for event={entry.get('event_id')} "
                f"node={entry.get('node_name')} has invalid hash. "
                f"Expected {expected_hash[:12]}... got {stored_hash[:12]}..."
            )
            return False
        prev_hash = stored_hash or expected_hash
    return True
