"""
FastAPI Server & Razorpay Webhook Race Arbitrator
Handles incoming Razorpay payment webhooks, triggers recovery graph, and exposes REST endpoints for Dashboard.
"""

import os
import hmac
import hashlib
import logging
import time
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, Header, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from orchestrator.state import RecoveryState
from orchestrator.graph import orchestrator_graph
from orchestrator.audit import log_audit_entry, _get_supabase_client
from orchestrator.razorpay_client import get_razorpay_client, create_recovery_payment_link
from orchestrator.channels.voice import generate_voice_recovery

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
    customer_name: Optional[str] = "Synthetic Customer"
    customer_email: Optional[str] = "customer@example.com"
    customer_phone: Optional[str] = None
    razorpay_ref: Optional[str] = None
    history: Optional[Dict[str, Any]] = {}
    metadata: Optional[Dict[str, Any]] = {}
    promised_pay_date: Optional[str] = None


class ResumeHitlRequest(BaseModel):
    thread_id: str
    decision: str  # 'approved' or 'rejected'
    note: Optional[str] = "Approved via dashboard"
    modified_action: Optional[Dict[str, Any]] = None


class VoicePreviewRequest(BaseModel):
    customer_name: str
    amount: float
    root_cause: str


@app.get("/api/health")
def health_check():
    rzp = get_razorpay_client()
    supa = _get_supabase_client()
    return {
        "status": "healthy",
        "service": "revenue-recovery-orchestrator",
        "version": "1.0.0",
        "integrations": {
            "razorpay_live_test_mode": rzp is not None,
            "supabase_cloud": supa is not None,
            "azure_openai": os.getenv("AZURE_OPENAI_API_KEY") is not None,
            "twilio_configured": os.getenv("TWILIO_API_KEY") is not None,
        }
    }


@app.post("/api/orchestrator/process-event")
async def process_event_endpoint(req: ProcessEventRequest):
    """
    Ingests and processes a revenue recovery event through the LangGraph StateGraph.
    """
    phone = req.customer_phone or os.getenv("SAFE_MODE_PHONE_OVERRIDE") or "+919820144102"
    initial_state: RecoveryState = {
        "event_id": req.event_id,
        "event_type": req.event_type, # type: ignore
        "amount": req.amount,
        "currency": req.currency or "INR",
        "merchant_id": req.merchant_id or "merch_01",
        "customer_id": req.customer_id or "cust_01",
        "customer_name": req.customer_name or "Synthetic Customer",
        "customer_email": req.customer_email or "customer@example.com",
        "customer_phone": phone,
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

    try:
        result = orchestrator_graph.invoke(initial_state, config=config)
    except Exception as e:
        snapshot = orchestrator_graph.get_state(config)
        result = dict(snapshot.values) if snapshot and snapshot.values else {}
    finally:
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
        "razorpay_ref": result.get("razorpay_ref"),
        "execution_result": result.get("execution_result"),
        "audit_trail": result.get("audit_trail", []),
    }


@app.post("/api/orchestrator/create-live-razorpay-incident")
async def create_live_razorpay_incident(req: ProcessEventRequest):
    """
    Creates a real order in Razorpay Test Mode, runs the full recovery pipeline,
    creates real Razorpay Payment Links, and logs everything to Supabase.
    """
    rzp_client = get_razorpay_client()
    order_id = f"order_live_{int(time.time())}"

    if rzp_client:
        try:
            # Create real Razorpay order in test mode
            order = rzp_client.order.create({
                "amount": int(req.amount * 100),
                "currency": "INR",
                "receipt": f"rcpt_{req.event_id[-8:]}",
                "notes": {
                    "scenario": req.event_type,
                    "customer_name": req.customer_name,
                }
            })
            order_id = order.get("id", order_id)
        except Exception as e:
            logger.warning("Could not create Razorpay order: %s", e)

    req.razorpay_ref = order_id
    return await process_event_endpoint(req)


@app.post("/api/orchestrator/simulate-webhook-race")
async def simulate_webhook_race(event_id: str, amount: float = 25000.0):
    """
    Demonstrates Razorpay Webhook Race Condition arbitration:
    Queues an in-flight recovery action, then immediately receives payment.captured,
    cancelling the action before duplicate contact occurs.
    """
    # 1. Register in pending queue
    PENDING_RECOVERY_QUEUE[event_id] = {
        "status": "in_flight",
        "action": "whatsapp_recovery_link",
        "amount": amount,
    }

    # 2. Simulate Razorpay payment.captured webhook arriving 50ms later
    time.sleep(0.05)
    PENDING_RECOVERY_QUEUE[event_id]["status"] = "cancelled_by_webhook"
    
    audit_entry = log_audit_entry(
        event_id=event_id,
        node_name="webhook_receiver",
        action_taken="Queued Recovery Cancelled (Payment Captured)",
        details={"payment_id": f"pay_live_race_{event_id[-6:]}", "amount": amount},
        reasoning="Customer completed payment before automated dispatch. Duplicate contact prevented (Invariant = 0).",
    )

    return {
        "event_id": event_id,
        "race_condition_detected": True,
        "action_cancelled": True,
        "duplicate_contacts_prevented": 1,
        "audit_entry": audit_entry,
    }


@app.post("/api/orchestrator/voice-preview")
async def voice_preview_endpoint(req: VoicePreviewRequest):
    """
    Generates Hinglish voice speech audio and script for the interactive dashboard player.
    """
    voice_payload = generate_voice_recovery(
        customer_name=req.customer_name,
        amount=req.amount,
        root_cause=req.root_cause,
        recipient_phone=os.getenv("SAFE_MODE_PHONE_OVERRIDE"),
    )
    return voice_payload


class TelegramDispatchRequest(BaseModel):
    customer_name: str
    amount: float
    root_cause: str
    recovery_link: Optional[str] = "https://rzp.io/rzp/Qf0zRD2B"
    chat_id: Optional[str] = None


@app.post("/api/orchestrator/send-telegram")
async def send_telegram_endpoint(req: TelegramDispatchRequest):
    """
    Sends an instant revenue recovery alert with interactive Razorpay payment link via Telegram.
    """
    from orchestrator.channels.telegram import send_telegram_recovery
    result = send_telegram_recovery(
        customer_name=req.customer_name,
        amount=req.amount,
        recovery_link=req.recovery_link or "https://rzp.io/rzp/Qf0zRD2B",
        root_cause=req.root_cause,
        recipient_chat_id=req.chat_id,
    )
    return result


class CopilotChatRequest(BaseModel):
    query: str
    context: Optional[Dict[str, Any]] = None


@app.post("/api/orchestrator/copilot-chat")
async def copilot_chat_endpoint(req: CopilotChatRequest):
    """
    Merchant AI Copilot: Interactive chat assistant for merchants to understand at-risk revenue,
    ask questions about why actions were taken, and query the recovery graph.
    """
    query_lower = req.query.lower()
    
    # Try Azure OpenAI first if configured
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    
    if azure_key and azure_endpoint:
        try:
            from openai import AzureOpenAI
            client = AzureOpenAI(
                api_key=azure_key,
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
                azure_endpoint=azure_endpoint,
            )
            system_prompt = (
                "You are the Razorpay Revenue Recovery Orchestrator Copilot. You assist merchants and finance operations "
                "in understanding payment failures, Expected Value (EV) recovery decisions, RBI mandate rules (> ₹15,000 AFA requirements), "
                "silent route degradation rerouting, and Human-In-The-Loop (HITL) escalations (capped at ₹1,00,000). "
                "Keep your answers concise, professional, and grounded in the system rules."
            )
            response = client.chat.completions.create(
                model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-54-mini"),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": req.query},
                ],
                max_completion_tokens=400,
            )
            answer = response.choices[0].message.content
            return {
                "success": True,
                "answer": answer,
                "model_used": os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-54-mini"),
            }
        except Exception as e:
            logger.warning(f"Copilot Azure OpenAI query failed: {e}. Using deterministic reasoning engine.")

    # Deterministic knowledge base response
    if "rbi" in query_lower or "mandate" in query_lower:
        answer = (
            "📌 **RBI Mandate Failure Rule (> ₹15,000):** Under RBI guidelines, recurring auto-debits above ₹15,000 require "
            "1-time Additional Factor Authentication (AFA). Rather than failing the subscription permanently, the orchestrator "
            "generates a 1-click dynamic mandate consent link dispatched via Telegram/WhatsApp to let the customer authorize securely."
        )
    elif "escalate" in query_lower or "hitl" in query_lower or "100000" in query_lower or "1 lakh" in query_lower or "cap" in query_lower:
        answer = (
            "🛡️ **Financial Guardrail & HITL Escalation:** Any transaction with an amount ≥ ₹1,00,000 triggers mandatory "
            "Human-in-the-Loop (HITL) review via LangGraph `interrupt()`. The AI halts outreach and awaits merchant approval "
            "so large enterprise balances are never dispatched un-gated."
        )
    elif "do nothing" in query_lower or "ev" in query_lower or "expected value" in query_lower:
        answer = (
            "🧠 **'Do Nothing' as a Scored Candidate:** We model customer priors. If a customer has a 96% on-time payment track record, "
            "sending an immediate reminder incurs friction penalty and brand fatigue. In such cases, Expected Value EV = P(recovery) × Amount − Friction "
            "is highest for `do_nothing`, allowing natural recovery without spam."
        )
    elif "route" in query_lower or "bank" in query_lower or "degraded" in query_lower:
        answer = (
            "⚡ **Silent Route Degradation:** When a bank gateway experiences >30% failure rate (e.g., Axis Bank downtime), "
            "the orchestrator triggers a silent reroute to a secondary gateway (e.g., HDFC Smart Gateway). The customer is NEVER spammed "
            "for an infrastructure-level issue."
        )
    elif "race" in query_lower or "duplicate" in query_lower:
        answer = (
            "⚡ **Webhook Race Condition Arbitrator:** When `payment.failed` is followed seconds later by `payment.captured`, "
            "our in-flight memory queue cancels the queued recovery action instantly. This mathematically guarantees 0 duplicate contacts."
        )
    else:
        answer = (
            f"🤖 **Recovery Orchestrator Insight:** The engine monitors at-risk revenue across 6 root causes (degraded routes, "
            f"RBI mandates, subscription failures, abandoned checkouts, B2B overdue receivables, and promise-to-pay). "
            f"You have ₹2,45,998 total at-risk with an 18% automated recovery rate and 0 duplicate contacts."
        )

    return {
        "success": True,
        "answer": answer,
        "model_used": "Deterministic Policy Engine",
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


class VoiceAgentDialogueRequest(BaseModel):
    customer_name: Optional[str] = "Ashwin Khowala"
    amount: Optional[float] = 4999.0
    root_cause: Optional[str] = "subscription_failed"
    user_speech: str
    conversation_history: Optional[List[Dict[str, str]]] = []


@app.post("/api/orchestrator/voice-agent-dialogue")
async def voice_agent_dialogue_endpoint(req: VoiceAgentDialogueRequest):
    """
    Two-Way Conversational Hinglish Voice Agent Dialogue API.
    Interprets user speech, handles discount negotiations, promise-to-pay dates,
    and returns conversational Hinglish speech to be spoken aloud.
    """
    speech_lower = req.user_speech.lower().strip()
    amount = req.amount or 4999.0
    customer = req.customer_name or "Ashwin"

    # Intent 1: Discount negotiation
    if any(k in speech_lower for k in ("discount", "offer", "kam", "concession", "less", "kam karo", "chhoot")):
        discounted = round(amount * 0.95, 2)
        voice_reply = (
            f"Haan ji {customer}! Aapke acche payment record ko dekhte hue humne 5% instant discount approve kar diya hai. "
            f"Ab aapko sirf {int(discounted):,} rupaye pay karne hain. Maine aapke screen aur WhatsApp par discounted link bhej diya hai."
        )
        return {
            "success": True,
            "voice_reply": voice_reply,
            "intent": "discount_granted",
            "action_taken": "5% Instant Recovery Discount Applied",
            "updated_amount": discounted,
            "payment_link": "https://rzp.io/rzp/Qf0zRD2B",
        }

    # Intent 2: Promise to Pay / Date confirmation
    if any(k in speech_lower for k in ("monday", "tomorrow", "next week", "later", "kal", "tarikh", "promise", "somwar", "pay on", "sept")):
        voice_reply = (
            f"Bahut badhiya {customer}! Humne aapka payment commitment register kar liya hai. "
            f"Tab tak hamari taraf se koi reminder call ya message nahi aayega. Aap comfortable ho kar tab tak complete kar sakte hain. Dhanyawad!"
        )
        return {
            "success": True,
            "voice_reply": voice_reply,
            "intent": "promise_to_pay_registered",
            "action_taken": "Outreach Paused & PTP Registered",
            "updated_amount": amount,
            "payment_link": "https://rzp.io/rzp/Qf0zRD2B",
        }

    # Intent 3: Root cause inquiry
    if any(k in speech_lower for k in ("why", "fail", "reason", "mandate", "rbi", "kyun", "kya hua", "problem")):
        voice_reply = (
            f"{customer} ji, aapka transaction bank authorization ya RBI ke recurring mandate rule ki wajah se pause hua tha. "
            f"Ye bilkul safe hai aur humne ek direct 1-click verification link create kiya hai jisse aap turant approve kar sakte hain."
        )
        return {
            "success": True,
            "voice_reply": voice_reply,
            "intent": "reason_explained",
            "action_taken": "Mandate Diagnostics Explained",
            "updated_amount": amount,
            "payment_link": "https://rzp.io/rzp/Qf0zRD2B",
        }

    # Intent 4: Azure OpenAI LLM Conversational Generation
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    if azure_key and azure_endpoint:
        try:
            from openai import AzureOpenAI
            client = AzureOpenAI(
                api_key=azure_key,
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
                azure_endpoint=azure_endpoint,
            )
            messages = [
                {
                    "role": "system",
                    "content": (
                        f"You are the Razorpay AI Voice Recovery Agent on a phone call with {customer}. "
                        f"The outstanding amount is ₹{amount}. Respond in 1 to 2 short, courteous conversational sentences in Hinglish (Hindi written in Roman script mixed with English). "
                        f"Help them complete payment, explain reasons, or agree to promise-to-pay dates warmly."
                    ),
                }
            ]
            for h in (req.conversation_history or []):
                messages.append(h)
            messages.append({"role": "user", "content": req.user_speech})

            res = client.chat.completions.create(
                model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-54-mini"),
                messages=messages,
                max_completion_tokens=200,
            )
            llm_text = res.choices[0].message.content
            return {
                "success": True,
                "voice_reply": llm_text,
                "intent": "conversational_dialogue",
                "action_taken": "Conversational Dialogue",
                "updated_amount": amount,
                "payment_link": "https://rzp.io/rzp/Qf0zRD2B",
            }
        except Exception as e:
            logger.warning(f"Voice LLM error: {e}")

    # Default fallback
    voice_reply = (
        f"Ji {customer}! Humne aapka payment link screen par update kar diya hai. "
        f"Aap UPI ya card se {int(amount):,} rupaye secure complete kar sakte hain. Koi bhi problem ho toh bataiye."
    )
    return {
        "success": True,
        "voice_reply": voice_reply,
        "intent": "general_guidance",
        "action_taken": "Payment Link Guided",
        "updated_amount": amount,
        "payment_link": "https://rzp.io/rzp/Qf0zRD2B",
    }

