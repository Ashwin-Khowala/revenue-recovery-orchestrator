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
)
from orchestrator.tools.merchant_tools import (
    get_merchant_financial_overview,
    get_at_risk_incidents,
    approve_high_value_invoice,
)

logger = logging.getLogger("orchestrator.tools.registry")

# Map of tool names to callable Python functions
ALL_TOOLS_MAP: Dict[str, Callable[..., Any]] = {
    "get_customer_intelligence": get_customer_intelligence,
    "apply_concession_discount": apply_concession_discount,
    "register_promise_to_pay": register_promise_to_pay,
    "get_merchant_financial_overview": get_merchant_financial_overview,
    "get_at_risk_incidents": get_at_risk_incidents,
    "approve_high_value_invoice": approve_high_value_invoice,
}

PAYER_TOOL_NAMES = [
    "apply_concession_discount",
    "register_promise_to_pay",
    "get_customer_intelligence",
]

MERCHANT_TOOL_NAMES = [
    "get_merchant_financial_overview",
    "get_at_risk_incidents",
    "get_customer_intelligence",
    "approve_high_value_invoice",
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
            "description": "Fetches merchant portfolio totals: at-risk revenue, recovered revenue, and zero-spam compliance.",
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
            "description": "Fetches unresolved at-risk recovery incidents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "merchant_id": {"type": "string", "description": "Merchant ID"},
                    "limit": {"type": "integer", "description": "Max incidents to return", "default": 5},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "apply_concession_discount",
            "description": "Applies an instant recovery discount/concession (e.g. 5%) on a pending payment.",
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
            "description": "Registers a Promise-to-Pay (PTP) commitment date and pauses automated outreach.",
            "parameters": {
                "type": "object",
                "properties": {
                    "promised_date": {"type": "string", "description": "Date promised by customer (e.g., 'Monday', 'Tomorrow')"},
                    "note": {"type": "string", "description": "Note or reason"},
                },
                "required": ["promised_date"],
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
        for param in sig.parameters.values():
            if param.name in args:
                valid_kwargs[param.name] = args[param.name]
            elif param.default is not inspect.Parameter.empty:
                valid_kwargs[param.name] = param.default

        result = func(**valid_kwargs)
        if isinstance(result, dict):
            result.setdefault("success", True)
            return result
        return {"tool": tool_name, "success": True, "result": result}
    except Exception as e:
        logger.error(f"[REGISTRY] Tool execution failed for {tool_name}: {e}", exc_info=True)
        return {
            "tool": tool_name,
            "success": False,
            "error": str(e),
        }
