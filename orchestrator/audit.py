"""
Audit Trail Logging & Observability Module
Logs all decisions, rule firings, LLM outputs, and state transitions to Supabase and Langfuse Cloud.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger("orchestrator.audit")

_supabase_client = None
_langfuse_client = None


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
            logger.debug(f"Could not initialize Langfuse client: {e}")
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
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_id": event_id,
        "node_name": node_name,
        "action_taken": action_taken,
        "details": details,
        "reasoning": reasoning or "",
    }
    
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

    # 2. Trace to Langfuse Cloud
    lf = _get_langfuse_client()
    if lf:
        try:
            lf.trace(
                name=f"node_{node_name}",
                session_id=event_id,
                input={"event_id": event_id, "node": node_name},
                output={"action_taken": action_taken, "details": details, "reasoning": reasoning},
                metadata={"timestamp": entry["timestamp"], "node": node_name},
            )
        except Exception as e:
            logger.debug(f"Could not send trace to Langfuse: {e}")

    return entry
