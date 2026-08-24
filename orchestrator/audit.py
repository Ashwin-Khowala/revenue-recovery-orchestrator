"""
Audit Trail Logging Module
Logs all decisions, rule firings, LLM outputs, and state transitions to Supabase and Langfuse.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger("orchestrator.audit")


def log_audit_entry(
    event_id: str,
    node_name: str,
    action_taken: str,
    details: Dict[str, Any],
    reasoning: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Creates an audit entry structure and optionally persists to Supabase.
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

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if supabase_url and supabase_key:
        try:
            from supabase import create_client
            supabase = create_client(supabase_url, supabase_key)
            supabase.table("audit_log").insert({
                "event_id": event_id,
                "node_name": node_name,
                "action_taken": action_taken,
                "details": details,
                "reasoning": reasoning or "",
            }).execute()
        except Exception as e:
            logger.warning(f"Could not persist audit log to Supabase: {e}")

    return entry
