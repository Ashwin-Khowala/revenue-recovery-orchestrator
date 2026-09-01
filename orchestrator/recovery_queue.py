"""
Persistent Pending Recovery Queue & Webhook Race Arbitrator
============================================================
Tracks in-flight recovery actions and cancels them immediately when a
real-world or test-mode payment is captured before outreach dispatch.

Features:
1. Multi-key indexing: queryable by `event_id`, `order_id`, `payment_id`, and `customer_id`.
2. Disk persistence: sidecar file `data/pending_recovery_queue.json` ensures survival across restarts.
3. Pre-send gate: executor nodes verify cancellation status immediately prior to dispatching messages.
"""

from __future__ import annotations

import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
from threading import Lock

logger = logging.getLogger("orchestrator.recovery_queue")

QUEUE_FILE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "pending_recovery_queue.json",
)

_queue_lock = Lock()
# Primary store: event_id -> Record
_RECOVERY_RECORDS: Dict[str, Dict[str, Any]] = {}
# Alias map: alias_key (order_id, payment_id, plink_id, etc.) -> event_id
_ALIAS_INDEX: Dict[str, str] = {}


def _save_to_disk() -> None:
    """Flushes queue state to JSON sidecar file."""
    try:
        os.makedirs(os.path.dirname(QUEUE_FILE_PATH), exist_ok=True)
        with open(QUEUE_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump({
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "records": _RECOVERY_RECORDS,
                "aliases": _ALIAS_INDEX,
            }, f, indent=2)
    except Exception as e:
        logger.warning(f"Could not persist recovery queue to disk: {e}")


def load_queue_from_disk() -> None:
    """Loads queue state from JSON sidecar file on boot."""
    global _RECOVERY_RECORDS, _ALIAS_INDEX
    if not os.path.exists(QUEUE_FILE_PATH):
        return
    try:
        with open(QUEUE_FILE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            with _queue_lock:
                _RECOVERY_RECORDS = data.get("records", {})
                _ALIAS_INDEX = data.get("aliases", {})
        logger.info(f"Loaded {len(_RECOVERY_RECORDS)} recovery queue records from disk.")
    except Exception as e:
        logger.warning(f"Could not load recovery queue from disk: {e}")


def enqueue_recovery(
    event_id: str,
    event_type: str,
    amount: float,
    customer_id: str,
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    customer_email: Optional[str] = None,
    razorpay_ref: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    status: str = "pending_send",
) -> Dict[str, Any]:
    """
    Registers a recovery action in the persistent queue.
    Indexes by event_id and any available Razorpay references (order_id, payment_id, etc.).
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    record = {
        "event_id": event_id,
        "event_type": event_type,
        "amount": float(amount),
        "customer_id": customer_id,
        "customer_name": customer_name or "Customer",
        "customer_phone": customer_phone or "",
        "customer_email": customer_email or "",
        "razorpay_ref": razorpay_ref,
        "metadata": metadata or {},
        "status": status,  # "pending_send", "cancelled_by_webhook", "dispatched", "escalated_hitl", "completed"
        "enqueued_at": now_iso,
        "updated_at": now_iso,
        "cancellation_reason": None,
    }

    with _queue_lock:
        _RECOVERY_RECORDS[event_id] = record
        if razorpay_ref:
            _ALIAS_INDEX[razorpay_ref] = event_id
        if metadata:
            if metadata.get("order_id"):
                _ALIAS_INDEX[metadata["order_id"]] = event_id
            if metadata.get("payment_id"):
                _ALIAS_INDEX[metadata["payment_id"]] = event_id
            if metadata.get("payment_link_id"):
                _ALIAS_INDEX[metadata["payment_link_id"]] = event_id
        _save_to_disk()

    logger.info(f"[QUEUE] Enqueued recovery action for event_id={event_id} (status={status}, ref={razorpay_ref})")
    return record


def link_alias(event_id: str, alias_key: str) -> None:
    """Links an additional lookup key (e.g. newly minted payment link or order_id) to an event."""
    if not alias_key or not event_id:
        return
    with _queue_lock:
        _ALIAS_INDEX[alias_key] = event_id
        if event_id in _RECOVERY_RECORDS:
            _RECOVERY_RECORDS[event_id]["razorpay_ref"] = alias_key
            _RECOVERY_RECORDS[event_id]["updated_at"] = datetime.now(timezone.utc).isoformat()
        _save_to_disk()


def update_recovery_status(event_id: str, status: str, details: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Updates the status of an existing recovery action."""
    with _queue_lock:
        record = _RECOVERY_RECORDS.get(event_id)
        if not record:
            target_id = _ALIAS_INDEX.get(event_id)
            if target_id:
                record = _RECOVERY_RECORDS.get(target_id)
        if record:
            record["status"] = status
            record["updated_at"] = datetime.now(timezone.utc).isoformat()
            if details:
                record.setdefault("details", {}).update(details)
            _save_to_disk()
            return record
    return None


def cancel_recovery_by_webhook(
    order_id: Optional[str] = None,
    payment_id: Optional[str] = None,
    event_id: Optional[str] = None,
    reference_id: Optional[str] = None,
    reason: str = "Payment captured proactively via self-service retry",
) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Arbitrates incoming payment.captured webhook against the recovery queue.
    If a pending recovery matches any key, immediately marks it cancelled_by_webhook.
    Returns (was_cancelled, cancelled_record).
    """
    candidates = [k for k in (order_id, payment_id, event_id, reference_id) if k]
    with _queue_lock:
        target_event_id = None
        for key in candidates:
            if key in _RECOVERY_RECORDS:
                target_event_id = key
                break
            if key in _ALIAS_INDEX:
                target_event_id = _ALIAS_INDEX[key]
                break

        if not target_event_id or target_event_id not in _RECOVERY_RECORDS:
            return False, None

        record = _RECOVERY_RECORDS[target_event_id]
        if record["status"] in ("cancelled_by_webhook", "completed"):
            return False, record

        now_iso = datetime.now(timezone.utc).isoformat()
        record["status"] = "cancelled_by_webhook"
        record["updated_at"] = now_iso
        record["cancelled_at"] = now_iso
        record["cancellation_reason"] = reason
        _save_to_disk()

    logger.info(f"[QUEUE RACE RESOLVED] Cancelled pending recovery for event_id={target_event_id}. Reason: {reason}")
    return True, record


def is_recovery_cancelled(event_id: Optional[str] = None, razorpay_ref: Optional[str] = None) -> bool:
    """
    Pre-send safety check: verifies if an action was cancelled before message dispatch.
    """
    candidates = [k for k in (event_id, razorpay_ref) if k]
    with _queue_lock:
        for key in candidates:
            if key in _RECOVERY_RECORDS:
                if _RECOVERY_RECORDS[key]["status"] == "cancelled_by_webhook":
                    return True
            if key in _ALIAS_INDEX:
                eid = _ALIAS_INDEX[key]
                if eid in _RECOVERY_RECORDS and _RECOVERY_RECORDS[eid]["status"] == "cancelled_by_webhook":
                    return True
    return False


def get_all_records() -> List[Dict[str, Any]]:
    """Returns a snapshot list of all queue records."""
    with _queue_lock:
        return list(_RECOVERY_RECORDS.values())


# Auto-load on import
load_queue_from_disk()
