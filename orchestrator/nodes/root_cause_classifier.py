"""
Node 1: Root-Cause Classifier
Hybrid approach: Deterministic rules for unambiguous cases (0 latency / 0 LLM cost) +
Azure OpenAI for ambiguous behavioral reasoning and candidate action generation.
"""

import json
import logging
from typing import Dict, Any
from orchestrator.state import RecoveryState
from orchestrator.llm import get_azure_chat_llm
from orchestrator.audit import log_audit_entry

logger = logging.getLogger("orchestrator.classifier")


def classify_root_cause(state: RecoveryState) -> Dict[str, Any]:
    """
    Classifies the revenue at risk into one of 6 categories and synthesizes candidate interventions.
    """
    event_id = state.get("event_id", "unknown")
    event_type = state.get("event_type")
    amount = state.get("amount", 0.0)
    history = state.get("history", {})
    metadata = state.get("metadata", {})

    # --------------------------------------------------------------------------
    # Deterministic Rule Check 1: Payment Route / Gateway Degradation
    # --------------------------------------------------------------------------
    if event_type == "payment_degraded" or metadata.get("pct_merchant_failures_same_route", 0) >= 0.35:
        root_cause = "payment_degraded"
        confidence = 0.99
        reasoning = "Deterministic match: Route degradation detected (>35% route failure rate). Customer must NOT be contacted."
        candidate_actions = [
            {"action_type": "silent_route_reroute", "target_channel": "reroute", "cost": 0.0, "description": "Reroute payment to secondary bank gateway with 5m backoff"},
            {"action_type": "do_nothing", "target_channel": "none", "cost": 0.0, "description": "Wait for gateway route health recovery"}
        ]
        
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="classify_root_cause",
            action_taken=f"Classified as {root_cause} (Rule Engine)",
            details={"root_cause": root_cause, "confidence": confidence, "candidate_actions": candidate_actions},
            reasoning=reasoning,
        )
        return {
            "root_cause": root_cause,
            "confidence": confidence,
            "classification_reasoning": reasoning,
            "candidate_actions": candidate_actions,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Deterministic Rule Check 2: RBI > ₹15,000 Mandate AFA Step Missing
    # --------------------------------------------------------------------------
    if (event_type == "mandate_auth_failed" or amount > 15000) and metadata.get("afa_step_reached") is False:
        root_cause = "mandate_auth_failed"
        confidence = 0.98
        reasoning = f"Deterministic match: Mandate amount ₹{amount} > ₹15,000 without RBI Additional Factor Authentication (AFA)."
        candidate_actions = [
            {"action_type": "whatsapp_mandate_afa_link", "target_channel": "whatsapp", "cost": 0.80, "description": "Send pre-authenticated RBI mandate consent link via WhatsApp"},
            {"action_type": "email_mandate_afa_link", "target_channel": "email", "cost": 0.05, "description": "Send mandate re-authentication email"},
            {"action_type": "do_nothing", "target_channel": "none", "cost": 0.0, "description": "Do nothing (Low EV due to mandatory RBI regulatory block)"}
        ]
        
        audit_entry = log_audit_entry(
            event_id=event_id,
            node_name="classify_root_cause",
            action_taken=f"Classified as {root_cause} (Rule Engine)",
            details={"root_cause": root_cause, "confidence": confidence, "candidate_actions": candidate_actions},
            reasoning=reasoning,
        )
        return {
            "root_cause": root_cause,
            "confidence": confidence,
            "classification_reasoning": reasoning,
            "candidate_actions": candidate_actions,
            "audit_trail": state.get("audit_trail", []) + [audit_entry],
        }

    # --------------------------------------------------------------------------
    # Ambiguous / Behavioral Classification: Azure OpenAI Reasoning
    # --------------------------------------------------------------------------
    llm = get_azure_chat_llm(temperature=0.0)

    if llm is not None:
        try:
            prompt = f"""You are the Root-Cause Classifier for an AI Revenue Recovery Orchestrator.
Analyze the following payment/revenue incident and output structured JSON.

Event Details:
- Event ID: {event_id}
- Event Type: {event_type}
- Amount: ₹{amount}
- Customer History: {json.dumps(history)}
- Incident Metadata: {json.dumps(metadata)}

Possible Categories:
1. 'subscription_failed': Recurring billing decline (card expired, soft decline, insufficient funds).
2. 'checkout_abandoned': Cart drop-off by high-intent user.
3. 'receivable_overdue': B2B unpaid invoice past terms.
4. 'payment_degraded': Technical failure/route degradation.
5. 'mandate_auth_failed': Recurring mandate > ₹15,000 lacking AFA consent.
6. 'promise_to_pay': Customer promised to pay on a specific date.

Respond ONLY with a valid JSON object formatted as:
{{
  "root_cause": "<category>",
  "confidence": <float 0.0 to 1.0>,
  "reasoning": "<brief explanation>",
  "candidate_actions": [
    {{
      "action_type": "<e.g. whatsapp_quick_link | email_invoice_reminder | do_nothing | scheduled_ptp_check>",
      "target_channel": "<whatsapp | email | reroute | scheduled_check | none>",
      "cost": <float estimated execution cost in INR>,
      "description": "<action description>"
    }}
  ]
}}
"""
            response = llm.invoke(prompt)
            content = response.content.strip()
            # Clean markdown codeblocks if present
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            parsed = json.loads(content.strip())
            
            root_cause = parsed.get("root_cause", event_type or "subscription_failed")
            confidence = float(parsed.get("confidence", 0.85))
            reasoning = parsed.get("reasoning", "Azure OpenAI reasoning classification")
            candidate_actions = parsed.get("candidate_actions", [])

            # Always ensure 'do_nothing' exists as a candidate for evaluation
            has_do_nothing = any(a.get("action_type") == "do_nothing" for a in candidate_actions)
            if not has_do_nothing:
                candidate_actions.append({
                    "action_type": "do_nothing",
                    "target_channel": "none",
                    "cost": 0.0,
                    "description": "Natural recovery without outreach friction"
                })

            audit_entry = log_audit_entry(
                event_id=event_id,
                node_name="classify_root_cause",
                action_taken=f"Classified as {root_cause} (Azure OpenAI)",
                details={"root_cause": root_cause, "confidence": confidence, "candidate_actions": candidate_actions},
                reasoning=reasoning,
            )
            return {
                "root_cause": root_cause,
                "confidence": confidence,
                "classification_reasoning": reasoning,
                "candidate_actions": candidate_actions,
                "audit_trail": state.get("audit_trail", []) + [audit_entry],
            }
        except Exception as e:
            logger.error(f"LLM Classification failed for event {event_id}: {e}. Falling back to heuristic baseline.")

    # --------------------------------------------------------------------------
    # Heuristic Fallback (if Azure OpenAI unavailable or offline)
    # --------------------------------------------------------------------------
    fallback_cause = event_type or "subscription_failed"
    fallback_actions = [
        {"action_type": "whatsapp_recovery_nudge", "target_channel": "whatsapp", "cost": 0.80, "description": "WhatsApp recovery link"},
        {"action_type": "email_invoice_reminder", "target_channel": "email", "cost": 0.05, "description": "Email recovery notification"},
        {"action_type": "do_nothing", "target_channel": "none", "cost": 0.0, "description": "Allow natural customer recovery"}
    ]
    audit_entry = log_audit_entry(
        event_id=event_id,
        node_name="classify_root_cause",
        action_taken=f"Classified as {fallback_cause} (Heuristic Fallback)",
        details={"root_cause": fallback_cause, "confidence": 0.70, "candidate_actions": fallback_actions},
        reasoning="Deterministic heuristic fallback path executed.",
    )
    return {
        "root_cause": fallback_cause,
        "confidence": 0.70,
        "classification_reasoning": "Heuristic fallback classification.",
        "candidate_actions": fallback_actions,
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }
