"""
Unified Tool Registry for Multi-Model Execution
Supports Google GenAI (Gemini Live), Azure OpenAI, and Anthropic Claude.
"""

import json
import logging
from typing import Dict, Any, List, Callable, Optional

from orchestrator.tools.customer_tools import (
    get_customer_intelligence,
    apply_concession_discount,
    register_promise_to_pay,
    get_payment_link,
    get_payment_history,
    get_invoice_aging,
    get_subscription_plan_details,
    escalate_to_human,
)
from orchestrator.tools.merchant_tools import (
    get_merchant_financial_overview,
    get_at_risk_incidents,
    approve_high_value_invoice,
    lookup_decline_code,
    get_checkout_funnel_metrics,
    get_subscription_churn_analysis,
    trigger_outbound_recovery_action,
    get_b2b_aging_and_receivables_summary,
    resolve_b2b_process_blocker,
    route_b2b_dispute_to_human,
    simulate_b2b_ap_email_reply,
    get_mandate_portfolio_health,
    simulate_mandate_rail_decision,
    trigger_mandate_renewal_flow,
    dispatch_afa_pre_debit_notification,
    get_ptp_cashflow_forecast_tool,
    simulate_ptp_linguistic_score_tool,
)

logger = logging.getLogger("orchestrator.tools.registry")

# Map of tool names to callable Python functions
ALL_TOOLS_MAP: Dict[str, Callable[..., Any]] = {
    "get_customer_intelligence": get_customer_intelligence,
    "apply_concession_discount": apply_concession_discount,
    "register_promise_to_pay": register_promise_to_pay,
    "get_payment_link": get_payment_link,
    "get_payment_history": get_payment_history,
    "get_invoice_aging": get_invoice_aging,
    "get_subscription_plan_details": get_subscription_plan_details,
    "escalate_to_human": escalate_to_human,
    "get_merchant_financial_overview": get_merchant_financial_overview,
    "get_at_risk_incidents": get_at_risk_incidents,
    "approve_high_value_invoice": approve_high_value_invoice,
    "lookup_decline_code": lookup_decline_code,
    "get_checkout_funnel_metrics": get_checkout_funnel_metrics,
    "get_subscription_churn_analysis": get_subscription_churn_analysis,
    "trigger_outbound_recovery_action": trigger_outbound_recovery_action,
    "get_b2b_aging_and_receivables_summary": get_b2b_aging_and_receivables_summary,
    "resolve_b2b_process_blocker": resolve_b2b_process_blocker,
    "route_b2b_dispute_to_human": route_b2b_dispute_to_human,
    "simulate_b2b_ap_email_reply": simulate_b2b_ap_email_reply,
    "get_mandate_portfolio_health": get_mandate_portfolio_health,
    "simulate_mandate_rail_decision": simulate_mandate_rail_decision,
    "trigger_mandate_renewal_flow": trigger_mandate_renewal_flow,
    "dispatch_afa_pre_debit_notification": dispatch_afa_pre_debit_notification,
    "get_ptp_cashflow_forecast": get_ptp_cashflow_forecast_tool,
    "simulate_ptp_linguistic_score": simulate_ptp_linguistic_score_tool,
}

PAYER_TOOL_NAMES = [
    "apply_concession_discount",
    "register_promise_to_pay",
    "get_payment_link",
    "get_customer_intelligence",
    "get_payment_history",
    "get_invoice_aging",
    "get_subscription_plan_details",
    "escalate_to_human",
]

MERCHANT_TOOL_NAMES = [
    "get_merchant_financial_overview",
    "get_at_risk_incidents",
    "get_customer_intelligence",
    "get_payment_history",
    "get_invoice_aging",
    "get_subscription_plan_details",
    "escalate_to_human",
    "approve_high_value_invoice",
    "lookup_decline_code",
    "get_checkout_funnel_metrics",
    "get_subscription_churn_analysis",
    "trigger_outbound_recovery_action",
    "get_b2b_aging_and_receivables_summary",
    "resolve_b2b_process_blocker",
    "route_b2b_dispute_to_human",
    "simulate_b2b_ap_email_reply",
    "get_mandate_portfolio_health",
    "simulate_mandate_rail_decision",
    "trigger_mandate_renewal_flow",
    "dispatch_afa_pre_debit_notification",
    "get_ptp_cashflow_forecast",
    "simulate_ptp_linguistic_score",
    "apply_concession_discount",
    "register_promise_to_pay",
]

# JSON Schemas for OpenAI / Azure OpenAI
OPENAI_TOOL_SCHEMAS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "get_customer_intelligence",
            "description": "Fetches customer payment profile, reliability score, and past recovery history.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer ID (e.g. 'cust_0001')"},
                },
                "required": ["customer_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_merchant_financial_overview",
            "description": "Fetches merchant portfolio totals: at-risk revenue, recovered revenue, margin protected, pending approvals, and zero-spam compliance.",
            "parameters": {
                "type": "object",
                "properties": {
                    "merchant_id": {"type": "string", "description": "Merchant ID (e.g. 'merch_01')"},
                },
                "required": ["merchant_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_at_risk_incidents",
            "description": "Fetches pending at-risk recovery incidents requiring review or follow-up.",
            "parameters": {
                "type": "object",
                "properties": {
                    "merchant_id": {"type": "string", "description": "Merchant ID"},
                    "limit": {"type": "integer", "description": "Max incidents to return", "default": 5},
                    "issue_type": {"type": "string", "description": "Optional issue filter (e.g. 'mandate_auth_failed', 'subscription_failed')"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_decline_code",
            "description": "Looks up a bank decline code to explain fault domain, retry delay, and customer contact rules.",
            "parameters": {
                "type": "object",
                "properties": {
                    "decline_code": {"type": "string", "description": "Decline code (e.g. 'gateway_timeout', 'insufficient_funds', 'card_expired', 'mandate_auth_failed')"},
                },
                "required": ["decline_code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_checkout_funnel_metrics",
            "description": "Fetches checkout funnel drop-off analytics and margin shield metrics.",
            "parameters": {
                "type": "object",
                "properties": {
                    "merchant_id": {"type": "string", "description": "Merchant ID", "default": "merch_01"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_subscription_churn_analysis",
            "description": "Evaluates subscription health to recommend 14-day grace period for active users or pause off-ramp for dormant users.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer ID (e.g. 'cust_0001')"},
                },
                "required": ["customer_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trigger_outbound_recovery_action",
            "description": "Dispatches a recovery action across WhatsApp, Telegram, or triggers an AI Voice Call to the customer.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_name": {"type": "string", "description": "Customer recipient name"},
                    "channel": {"type": "string", "description": "Channel: 'whatsapp', 'telegram', 'voice'"},
                    "amount": {"type": "number", "description": "Amount in INR"},
                    "root_cause": {"type": "string", "description": "Issue type"},
                },
                "required": ["customer_name", "channel"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "apply_concession_discount",
            "description": "Applies an instant recovery discount/concession (1-15%) on a pending payment.",
            "parameters": {
                "type": "object",
                "properties": {
                    "discount_percent": {"type": "integer", "description": "Discount percentage (1-15%)", "default": 5},
                    "reason": {"type": "string", "description": "Reason for discount"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "register_promise_to_pay",
            "description": "Registers a Promise-to-Pay (PTP) commitment date and pauses automated outreach. ONLY call this when the customer provides a legitimate, physically possible calendar date (e.g., 'Tomorrow', 'Next Monday', '15 October', '2026-09-30'). NEVER call with impossible dates like '31 September', day '0', or nonsense.",
            "parameters": {
                "type": "object",
                "properties": {
                    "promised_date": {"type": "string", "description": "Legitimate calendar date promised by customer (e.g., 'Next Monday', 'Tomorrow', '15 October', '2026-09-30')"},
                    "note": {"type": "string", "description": "Customer context or explanation note"},
                },
                "required": ["promised_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_payment_link",
            "description": "Generates a 1-click Razorpay verified checkout link for instant customer settlement.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_name": {"type": "string", "description": "Customer recipient name"},
                    "amount": {"type": "number", "description": "Payable amount in INR"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "approve_high_value_invoice",
            "description": "Approves an escalated high-value invoice (>= ₹1,00,000) for recovery outreach.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string", "description": "Invoice reference or customer name"},
                    "approval_note": {"type": "string", "description": "Authorization reason"},
                },
                "required": ["invoice_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_b2b_aging_and_receivables_summary",
            "description": "Fetches enterprise B2B Accounts Receivable aging buckets, credit exposure, PO friction items, and active commercial disputes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "merchant_id": {"type": "string", "description": "Merchant ID (e.g. 'merch_01')"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "resolve_b2b_process_blocker",
            "description": "Applies a missing PO number to an invoice and re-dispatches a clean invoice with a 1-click Razorpay payment link to Accounts Payable.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string", "description": "Invoice reference ID (e.g. 'INV-2026-0599')"},
                    "po_number": {"type": "string", "description": "Client PO Number (e.g. 'PO-9821')"},
                    "client_company": {"type": "string", "description": "Client Company Name"},
                },
                "required": ["invoice_id", "po_number"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "route_b2b_dispute_to_human",
            "description": "Stops all automated dunning on a disputed B2B invoice and routes an escalation ticket to the Account Executive.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {"type": "string", "description": "Invoice reference ID"},
                    "dispute_reason": {"type": "string", "description": "Client dispute reason"},
                    "client_company": {"type": "string", "description": "Client Company Name"},
                },
                "required": ["invoice_id", "dispute_reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_b2b_ap_email_reply",
            "description": "Simulates and executes semantic Mem0-style intent extraction on an inbound email from a client AP team.",
            "parameters": {
                "type": "object",
                "properties": {
                    "email_text": {"type": "string", "description": "Inbound email reply text from Accounts Payable"},
                    "invoice_id": {"type": "string", "description": "Invoice reference ID"},
                    "client_company": {"type": "string", "description": "Client Company Name"},
                },
                "required": ["email_text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_mandate_portfolio_health",
            "description": "Fetches portfolio-level recurring mandate health, mandates expiring in 30 days, AFA threshold breaches, and issuing bank registration success rates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "merchant_id": {"type": "string", "description": "Merchant ID (e.g. 'merch_01')"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_mandate_rail_decision",
            "description": "Evaluates a mandate debit attempt against declarative scheme Rule-Packs (UPI Autopay, eNACH, Bacs, SEPA).",
            "parameters": {
                "type": "object",
                "properties": {
                    "rail": {"type": "string", "description": "Scheme name ('upi_autopay', 'enach', 'bacs_direct_debit', 'sepa_core')"},
                    "amount": {"type": "number", "description": "Debit amount in INR"},
                    "failure_reason": {"type": "string", "description": "Bank return reason or code"},
                    "current_retry_count": {"type": "integer", "description": "Attempts made so far in current cycle"},
                    "mandate_status": {"type": "string", "description": "'active', 'expiring_soon', 'expired', 'revoked_by_payer'"},
                },
                "required": ["rail", "amount"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trigger_mandate_renewal_flow",
            "description": "Dispatches a proactive 1-click mandate re-registration link ahead of mandate expiration.",
            "parameters": {
                "type": "object",
                "properties": {
                    "mandate_id": {"type": "string", "description": "Mandate ID"},
                    "customer_name": {"type": "string", "description": "Customer Name"},
                    "customer_phone": {"type": "string", "description": "Customer Phone Number"},
                },
                "required": ["mandate_id", "customer_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "dispatch_afa_pre_debit_notification",
            "description": "Dispatches RBI-compliant 24h pre-debit AFA notification with 1-tap OTP/UPI auth link for debits > ₹15,000.",
            "parameters": {
                "type": "object",
                "properties": {
                    "mandate_id": {"type": "string", "description": "Mandate ID"},
                    "amount": {"type": "number", "description": "Debit amount in INR"},
                    "customer_name": {"type": "string", "description": "Customer Name"},
                    "customer_phone": {"type": "string", "description": "Customer Phone Number"},
                },
                "required": ["mandate_id", "amount", "customer_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_ptp_cashflow_forecast",
            "description": "Fetches rolling 7-day, 14-day, and 30-day forward cash-flow liquidity forecast derived from active Promise-to-Pay commitments.",
            "parameters": {
                "type": "object",
                "properties": {
                    "merchant_id": {"type": "string", "description": "Merchant ID", "default": "merch_01"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "simulate_ptp_linguistic_score",
            "description": "Simulates real-time linguistic confidence scoring on a customer promise at capture time.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_wording": {"type": "string", "description": "Exact spoken or written promise statement"},
                    "amount": {"type": "number", "description": "Outstanding amount"},
                    "customer_name": {"type": "string", "description": "Customer Name"},
                },
                "required": ["customer_wording"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_payment_history",
            "description": "Returns the last N payment episodes for a customer: date, amount, outcome, and channel. Use when a customer asks 'Show my payment history', 'What have I paid?', or 'When was my last payment?'",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer ID (e.g. 'cust_0001')"},
                    "limit": {"type": "integer", "description": "Number of records to return (default 10)", "default": 10},
                },
                "required": ["customer_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_invoice_aging",
            "description": "Returns how many days overdue a customer's invoice is and which aging bucket (0-30d, 31-60d, 61-90d, 90d+). Use when asked 'How overdue am I?', 'When was my payment due?', 'How many days late am I?'",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer ID"},
                    "event_id": {"type": "string", "description": "Optional specific incident ID"},
                },
                "required": ["customer_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_subscription_plan_details",
            "description": "Returns subscription plan name, billing cycle, amount, grace period status. Use when asked 'What plan am I on?', 'When does my subscription renew?', 'Is my account active?'",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer ID (e.g. 'cust_0001')"},
                },
                "required": ["customer_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": "Immediately pauses all automated outreach and routes the customer to a human agent with a Telegram alert to merchant admins. CALL THIS when the customer says: 'speak to a human', 'I want a person', 'call me', 'escalate', 'manager', 'representative', 'I want to speak to someone', or expresses frustration.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_id": {"type": "string", "description": "Customer ID"},
                    "customer_name": {"type": "string", "description": "Customer's name"},
                    "reason": {"type": "string", "description": "Why the escalation was triggered"},
                    "amount": {"type": "number", "description": "Amount involved in INR"},
                },
                "required": ["customer_id", "reason"],
            },
        },
    },
]


def get_gemini_tools(role: str = "all") -> List[Callable[..., Any]]:
    """
    Returns a list of Python callables for Google GenAI / Gemini Live AFC (Automatic Function Calling).
    """
    if role == "payer":
        return [ALL_TOOLS_MAP[name] for name in PAYER_TOOL_NAMES]
    elif role == "merchant":
        return [ALL_TOOLS_MAP[name] for name in MERCHANT_TOOL_NAMES]
    return list(ALL_TOOLS_MAP.values())


def get_openai_tools(role: str = "all") -> List[Dict[str, Any]]:
    """
    Returns tool definitions formatted for OpenAI / Azure OpenAI Chat Completions.
    """
    if role == "payer":
        return [t for t in OPENAI_TOOL_SCHEMAS if t["function"]["name"] in PAYER_TOOL_NAMES]
    elif role == "merchant":
        return [t for t in OPENAI_TOOL_SCHEMAS if t["function"]["name"] in MERCHANT_TOOL_NAMES]
    return OPENAI_TOOL_SCHEMAS


def execute_tool(
    tool_name: str,
    arguments: Optional[Dict[str, Any]] = None,
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Centralized execution dispatcher for any tool call across any model provider.
    
    Args:
        tool_name: Name of tool function to execute
        arguments: Arguments dictionary supplied by the LLM
        context: Execution context (customer_id, merchant_id, event_id, etc.)
    """
    if tool_name not in ALL_TOOLS_MAP:
        logger.warning(f"Requested unknown tool: {tool_name}")
        return {
            "tool": tool_name,
            "success": False,
            "error": f"Tool '{tool_name}' not registered in Unified Tool Registry.",
        }

    args = dict(arguments or {})
    ctx = dict(context or {})

    # Auto-inject contextual identifiers if missing from LLM arguments
    if "customer_id" not in args and "customer_id" in ctx:
        args["customer_id"] = ctx["customer_id"]
    if "merchant_id" not in args and "merchant_id" in ctx:
        args["merchant_id"] = ctx["merchant_id"]
    if "event_id" not in args and "event_id" in ctx:
        args["event_id"] = ctx["event_id"]

    func = ALL_TOOLS_MAP[tool_name]
    logger.info(f"[REGISTRY] Executing tool {tool_name} with args: {args}")

    try:
        # Filter args according to function signature
        import inspect
        sig = inspect.signature(func)
        valid_kwargs = {}
        for param_name in sig.parameters:
            if param_name in args:
                valid_kwargs[param_name] = args[param_name]

        res = func(**valid_kwargs)
        if isinstance(res, dict):
            res["tool"] = tool_name
            res["success"] = True
            return res
        return {
            "tool": tool_name,
            "success": True,
            "result": res,
            "message": str(res),
        }
    except Exception as e:
        logger.error(f"[REGISTRY] Tool execution failed for {tool_name}: {e}", exc_info=True)
        return {
            "tool": tool_name,
            "success": False,
            "error": str(e),
            "message": f"Tool '{tool_name}' encountered an error: {e}",
        }
