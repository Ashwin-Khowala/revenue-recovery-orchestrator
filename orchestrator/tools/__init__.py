"""
Unified Tools Package
Exposes customer & merchant tools, provider schemas (Gemini, OpenAI, Claude),
and the centralized execute_tool dispatcher.
"""

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
from orchestrator.tools.registry import (
    ALL_TOOLS_MAP,
    get_gemini_tools,
    get_openai_tools,
    execute_tool,
)

__all__ = [
    "get_customer_intelligence",
    "apply_concession_discount",
    "register_promise_to_pay",
    "get_merchant_financial_overview",
    "get_at_risk_incidents",
    "approve_high_value_invoice",
    "ALL_TOOLS_MAP",
    "get_gemini_tools",
    "get_openai_tools",
    "execute_tool",
]
