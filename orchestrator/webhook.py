"""
FastAPI Server & Razorpay Webhook Race Arbitrator
Handles incoming Razorpay payment webhooks, triggers recovery graph, and exposes REST endpoints for Dashboard.
"""

import os
import hmac
import hashlib
import logging
from typing import Dict, Any, Optional
from fastapi import FastAPI, Header, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from orchestrator.state import RecoveryState
from orchestrator.graph import orchestrator_graph
from orchestrator.audit import log_audit_entry

logger = logging.getLogger("orchestrator.api")

app = FastAPI(
    title="Razorpay Revenue Recovery Orchestrator API",
    version="1.0.0",
    description="Supervisory AI Recovery Engine for payment failures, abandoned carts, and overdue receivables.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active pending queue to intercept race conditions
PENDING_RECOVERY_QUEUE: Dict[str, Dict[str, Any]] = {}


class ProcessEventRequest(BaseModel):
    event_id: str
    event_type: str
    amount: float
    currency: Optional[str] = "INR"
    merchant_id: Optional[str] = "merch_demo_01"
    customer_id: Optional[str] = "cust_demo_01"
    customer_name: Optional[str] = "Demo Customer"
    customer_email: Optional[str] = "customer@example.com"
    customer_phone: Optional[str] = "+919876543210"
    razorpay_ref: Optional[str] = None
    history: Optional[Dict[str, Any]] = {}
    metadata: Optional[Dict[str, Any]] = {}
    promised_pay_date: Optional[str] = None


class ResumeHitlRequest(BaseModel):
    thread_id: str
    decision: str  # 'approved' or 'rejected'
    note: Optional[str] = "Approved via dashboard"
    modified_action: Optional[Dict[str, Any]] = None


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "revenue-recovery-orchestrator",
        "version": "1.0.0",
    }


@app.post("/api/orchestrator/process-event")
async def process_event_endpoint(req: ProcessEventRequest):
    """
    Ingests and processes a revenue recovery event through the LangGraph StateGraph.
    """
    initial_state: RecoveryState = {
        "event_id": req.event_id,
        "event_type": req.event_type, # type: ignore
        "amount": req.amount,
        "currency": req.currency or "INR",
        "merchant_id": req.merchant_id or "merch_01",
        "customer_id": req.customer_id or "cust_01",
        "customer_name": req.customer_name or "Valued Customer",
        "customer_email": req.customer_email or "customer@example.com",
        "customer_phone": req.customer_phone or "+919876543210",
        "razorpay_ref": req.razorpay_ref,
        "history": req.history or {"prior_contacts": 0, "prior_payment_success_rate": 0.85},
        "metadata": req.metadata or {},
        "promised_pay_date": req.promised_pay_date,
        "contact_count": 0,
        "payment_status": "unresolved",
        "recovered_amount": 0.0,
        "audit_trail": [],
    }

    config = {"configurable": {"thread_id": req.event_id}}
    
    # Store in queue for race condition arbitration
    PENDING_RECOVERY_QUEUE[req.event_id] = {
        "state": initial_state,
        "status": "in_flight",
    }

    result = orchestrator_graph.invoke(initial_state, config=config)
    PENDING_RECOVERY_QUEUE.pop(req.event_id, None)

    return {
        "event_id": req.event_id,
        "root_cause": result.get("root_cause"),
        "confidence": result.get("confidence"),
        "chosen_action": result.get("chosen_action"),
        "expected_value": result.get("expected_value"),
        "guardrail_result": result.get("guardrail_result"),
        "channel_used": result.get("channel_used"),
        "payment_status": result.get("payment_status"),
        "recovered_amount": result.get("recovered_amount"),
        "audit_trail": result.get("audit_trail", []),
    }


@app.post("/api/orchestrator/resume-hitl")
async def resume_hitl_endpoint(req: ResumeHitlRequest):
    """
    Resumes a paused HITL escalation thread using LangGraph Command(resume=...).
    """
    try:
        from langgraph.types import Command
        resume_payload = {
            "status": req.decision,
            "note": req.note,
            "approved_action": req.modified_action,
        }
        config = {"configurable": {"thread_id": req.thread_id}}
        result = orchestrator_graph.invoke(Command(resume=resume_payload), config=config)
        return {
            "status": "resumed",
            "thread_id": req.thread_id,
            "final_state": result,
        }
    except Exception as e:
        logger.error(f"Failed to resume HITL thread {req.thread_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/webhooks/razorpay")
async def razorpay_webhook_listener(
    request: Request,
    x_razorpay_signature: Optional[str] = Header(None),
):
    """
    Razorpay Webhook Listener & Race Condition Arbitrator.
    Detects payment.failed and payment.captured events.
    """
    body_bytes = await request.body()
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET")

    # Verify signature if secret configured
    if webhook_secret and x_razorpay_signature:
        expected_sig = hmac.new(
            webhook_secret.encode(),
            body_bytes,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, x_razorpay_signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    payload = await request.json()
    event_name = payload.get("event")
    event_entity = payload.get("payload", {}).get("payment", {}).get("entity", {})

    payment_id = event_entity.get("id", "pay_unknown")
    amount = float(event_entity.get("amount", 0)) / 100.0  # Razorpay amounts in paise
    customer_email = event_entity.get("email", "")
    customer_phone = event_entity.get("contact", "")
    order_id = event_entity.get("order_id")

    logger.info(f"[WEBHOOK RECEIVED] event={event_name} payment_id={payment_id} amount=₹{amount}")

    # --------------------------------------------------------------------------
    # Race Condition Handler: payment.captured received
    # --------------------------------------------------------------------------
    if event_name == "payment.captured":
        # Check if an active recovery action was queued for this order
        matching_event_id = order_id or payment_id
        if matching_event_id in PENDING_RECOVERY_QUEUE:
            logger.info(f"RACE CONDITION RESOLVED: Cancelling queued outreach for {matching_event_id}")
            PENDING_RECOVERY_QUEUE[matching_event_id]["status"] = "cancelled_by_webhook"
            log_audit_entry(
                event_id=matching_event_id,
                node_name="webhook_receiver",
                action_taken="Queued Recovery Cancelled (Payment Captured)",
                details={"payment_id": payment_id, "amount": amount},
                reasoning="Customer completed payment before automated dispatch. Duplicate contact prevented.",
            )
            return {"status": "cancelled_in_flight_recovery", "event_id": matching_event_id}

        return {"status": "captured_acknowledged", "payment_id": payment_id}

    # --------------------------------------------------------------------------
    # Trigger Recovery Pipeline on payment.failed
    # --------------------------------------------------------------------------
    if event_name == "payment.failed":
        evt_id = f"evt_rzp_{payment_id}"
        req_obj = ProcessEventRequest(
            event_id=evt_id,
            event_type="subscription_failed" if "sub_" in str(order_id) else "payment_degraded",
            amount=amount,
            customer_email=customer_email,
            customer_phone=customer_phone,
            razorpay_ref=payment_id,
            metadata={"error_code": event_entity.get("error_code"), "error_description": event_entity.get("error_description")},
        )
        return await process_event_endpoint(req_obj)

    return {"status": "ignored", "event": event_name}
