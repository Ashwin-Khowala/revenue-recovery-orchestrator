"""
Inbound Customer Reply Intent Classifier
=========================================
Uses Azure OpenAI GPT-5.4 Mini to reason over unstructured customer replies
(WhatsApp, SMS, Email, Telegram) and extract high-signal actionable intents:

  1. promise_to_pay: Extracts target date & pauses outreach until T_promised + 24h.
  2. customer_cancellation: Identifies genuine churn/cancellation intent and triggers
     the STOPPING RULE to prevent over-dunning.
  3. alternative_payment_request: Customer requests UPI / QR / Netbanking rail.
  4. general_dispute_query: Customer questions charge or invoice line items.
  5. opt_out: Customer sends standard opt-out keywords (STOP, UNSUBSCRIBE, DND).
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from dotenv import load_dotenv
from orchestrator.llm import get_azure_chat_llm
from orchestrator.audit import log_audit_entry, _get_supabase_client
from orchestrator.razorpay_client import create_recovery_payment_link

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"), override=True)

logger = logging.getLogger("orchestrator.inbound_intent")


class InboundIntentType(str, Enum):
    PROMISE_TO_PAY = "promise_to_pay"
    CUSTOMER_CANCELLATION = "customer_cancellation"
    ALTERNATIVE_PAYMENT_REQUEST = "alternative_payment_request"
    GENERAL_DISPUTE_QUERY = "general_dispute_query"
    OPT_OUT = "opt_out"
    OTHER = "other"


class InboundIntentResult(BaseModel):
    intent: InboundIntentType
    confidence: float = Field(..., ge=0.0, le=1.0)
    reasoning: str
    promised_pay_date: Optional[str] = None  # ISO-8601 YYYY-MM-DD
    preferred_payment_method: Optional[str] = None  # upi, netbanking, card, etc.
    cancellation_reason: Optional[str] = None
    stopping_rule_triggered: bool = False
    suggested_reply_message: str


def _detect_quick_keywords(message: str) -> Optional[InboundIntentResult]:
    """Fast-path deterministic keyword match for standard opt-out tokens."""
    msg_clean = message.strip().upper()
    if msg_clean in ("STOP", "UNSUBSCRIBE", "CANCEL ALL", "QUIT", "DND", "OPT OUT", "OPTOUT"):
        return InboundIntentResult(
            intent=InboundIntentType.OPT_OUT,
            confidence=1.0,
            reasoning="Exact match on regulatory opt-out / DND compliance keyword.",
            stopping_rule_triggered=True,
            suggested_reply_message="You have been successfully unsubscribed from recovery communications. No further messages will be sent.",
        )
    return None


def classify_inbound_intent(
    customer_message: str,
    context: Optional[Dict[str, Any]] = None,
) -> InboundIntentResult:
    """
    Classifies a customer inbound reply message using Azure OpenAI GPT-5.4 Mini.
    Extracts structured intent, promised payment date, or churn stopping triggers.
    """
    if not customer_message or not customer_message.strip():
        return InboundIntentResult(
            intent=InboundIntentType.OTHER,
            confidence=0.5,
            reasoning="Empty customer message.",
            stopping_rule_triggered=False,
            suggested_reply_message="Hello, how can we assist you with your payment?",
        )

    # Fast-path check for STOP / OPT-OUT keywords
    quick_res = _detect_quick_keywords(customer_message)
    if quick_res is not None:
        return quick_res

    ctx = context or {}
    customer_name = ctx.get("customer_name", "Customer")
    amount = ctx.get("amount", 0.0)
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    prompt = f"""You are the Inbound Customer Intent Classifier for the Razorpay AI Revenue Recovery Orchestrator.
Today's Date: {today_str}

Analyze the customer's response to an outreach message regarding an unpaid invoice or failed payment (Amount: ₹{amount}).

Customer Message:
"{customer_message}"

Customer Context:
- Name: {customer_name}
- Incident Context: {json.dumps(ctx)}

Classify into exactly ONE of the following intents:
1. 'promise_to_pay': Customer agrees to pay on a specific day/date (e.g. 'I will pay this Friday', 'Salary comes on 5th, will clear it then'). If a date is mentioned, calculate the ISO-8601 date (YYYY-MM-DD) based on today ({today_str}).
2. 'customer_cancellation': Customer explicitly states they want to cancel the subscription, stop the service, or already requested cancellation (e.g. 'I stopped using this', 'Cancel my account, stop charging me', 'I do not want this'). This triggers the STOPPING RULE so we never harass churned users.
3. 'alternative_payment_request': Customer wants a different payment rail (e.g. 'Can I pay via UPI/GPay?', 'Send me a QR code', 'Can I do a bank transfer?').
4. 'general_dispute_query': Customer asks questions about the bill, invoice items, or why they are being charged.
5. 'opt_out': Customer asks not to be messaged again.
6. 'other': Ambiguous or conversational statement.

Respond ONLY with a valid JSON object matching this schema:
{{
  "intent": "promise_to_pay | customer_cancellation | alternative_payment_request | general_dispute_query | opt_out | other",
  "confidence": <float 0.0 to 1.0>,
  "reasoning": "<brief explanation of the customer intent>",
  "promised_pay_date": "<YYYY-MM-DD or null if not applicable>",
  "preferred_payment_method": "<upi | qr | netbanking | card | null>",
  "cancellation_reason": "<brief summary of churn reason or null>",
  "stopping_rule_triggered": <true if customer_cancellation or opt_out else false>,
  "suggested_reply_message": "<polite, professional recovery or acknowledgment reply>"
}}
"""
    llm = get_azure_chat_llm(temperature=0.0)
    if llm is None:
        # Fallback heuristic
        if "cancel" in customer_message.lower() or "don't want" in customer_message.lower():
            return InboundIntentResult(
                intent=InboundIntentType.CUSTOMER_CANCELLATION,
                confidence=0.85,
                reasoning="Heuristic fallback match on cancellation intent.",
                stopping_rule_triggered=True,
                suggested_reply_message=f"We have noted your cancellation request, {customer_name}. No further charges or outreach will occur.",
            )
        return InboundIntentResult(
            intent=InboundIntentType.OTHER,
            confidence=0.6,
            reasoning="LLM unavailable; safe fallback.",
            stopping_rule_triggered=False,
            suggested_reply_message=f"Hi {customer_name}, please click your payment link to complete your payment or reply with any questions.",
        )

    try:
        resp = llm.invoke(prompt)
        content = resp.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        parsed = json.loads(content.strip())
        return InboundIntentResult(**parsed)
    except Exception as e:
        logger.warning(f"Inbound intent LLM parse failed: {e}. Using rule fallback.")
        if "cancel" in customer_message.lower():
            return InboundIntentResult(
                intent=InboundIntentType.CUSTOMER_CANCELLATION,
                confidence=0.80,
                reasoning=f"Parse error fallback: {e}",
                stopping_rule_triggered=True,
                suggested_reply_message="We have noted your request to cancel. Outreach stopped.",
            )
        return InboundIntentResult(
            intent=InboundIntentType.OTHER,
            confidence=0.5,
            reasoning=f"Parse error fallback: {e}",
            stopping_rule_triggered=False,
            suggested_reply_message="Thank you for your message. We will update your payment records.",
        )


def handle_inbound_reply(
    customer_message: str,
    event_id: str,
    customer_id: str,
    merchant_id: str,
    customer_phone: Optional[str] = None,
    customer_email: Optional[str] = None,
    amount: float = 0.0,
) -> Dict[str, Any]:
    """
    Orchestrates end-to-end execution of customer inbound replies:
      1. Classifies intent via Azure GPT-5.4 Mini.
      2. If Promise-to-Pay: Upserts date into Supabase promise_to_pay table and pauses outreach.
      3. If Cancellation: Triggers stopping rule, flags churn in DB, alerts merchant.
      4. If Alternative Rail: Generates dynamic UPI/Smart link.
      5. Logs cryptographic audit trail.
    """
    context = {
        "event_id": event_id,
        "customer_id": customer_id,
        "merchant_id": merchant_id,
        "customer_phone": customer_phone,
        "customer_email": customer_email,
        "amount": amount,
    }

    intent_result = classify_inbound_intent(customer_message, context)
    action_taken = f"Intent Recognized: {intent_result.intent.value.upper()}"
    details = intent_result.model_dump()

    # 1. Handle Promise-to-Pay
    if intent_result.intent == InboundIntentType.PROMISE_TO_PAY and intent_result.promised_pay_date:
        ptp_date = intent_result.promised_pay_date
        action_taken = f"Promise-to-Pay Registered for {ptp_date}"
        if os.getenv("DISABLE_AUDIT_DB", "false").lower() not in ("1", "true", "yes"):
            client = _get_supabase_client()
            if client:
                try:
                    client.table("promise_to_pay").upsert({
                        "event_id": event_id,
                        "customer_id": customer_id,
                        "merchant_id": merchant_id,
                        "amount": amount,
                        "promised_date": ptp_date,
                        "status": "pending_check",
                        "customer_note": customer_message,
                    }).execute()
                except Exception as db_err:
                    logger.debug(f"PTP DB upsert: {db_err}")

    # 2. Handle Customer Cancellation / Stopping Rule
    elif intent_result.stopping_rule_triggered:
        action_taken = f"Stopping Rule Enforced: {intent_result.intent.value.upper()}"
        if os.getenv("DISABLE_AUDIT_DB", "false").lower() not in ("1", "true", "yes"):
            client = _get_supabase_client()
            if client:
                try:
                    # Update customer profile to DND/Churned
                    client.table("customer_profiles").update({
                        "dnd": True,
                        "churn_risk": "high",
                    }).eq("customer_id", customer_id).execute()
                except Exception as db_err:
                    logger.debug(f"Customer cancel update: {db_err}")

    # 3. Handle Alternative Payment Rail Request
    elif intent_result.intent == InboundIntentType.ALTERNATIVE_PAYMENT_REQUEST:
        payment_link = create_recovery_payment_link(
            amount=amount,
            customer_name=customer_id,
            customer_email=customer_email or "customer@example.com",
            customer_phone=customer_phone or "+919820144102",
            reference_id=f"alt_{event_id}_{int(datetime.now().timestamp())}",
            description=f"Alternative Payment Link for {event_id}",
        )
        details["generated_payment_link"] = payment_link

    # Log to cryptographic audit trail
    audit_entry = log_audit_entry(
        event_id=event_id,
        node_name="inbound_intent_classifier",
        action_taken=action_taken,
        details=details,
        reasoning=intent_result.reasoning,
    )

    return {
        "status": "processed",
        "intent_result": intent_result.model_dump(),
        "action_taken": action_taken,
        "stopping_rule_active": intent_result.stopping_rule_triggered,
        "suggested_reply": intent_result.suggested_reply_message,
        "audit_entry": audit_entry,
    }
