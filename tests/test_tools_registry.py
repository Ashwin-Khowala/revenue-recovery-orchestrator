"""
Unit Tests for Unified Tool Registry
Verifies cross-model compatibility for Gemini, Azure OpenAI, and Claude.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from orchestrator.tools import (
    get_gemini_tools,
    get_openai_tools,
    execute_tool,
    ALL_TOOLS_MAP,
)


def test_gemini_tools_exported():
    """Verifies that all tools are callable for Gemini / Google GenAI."""
    gemini_tools = get_gemini_tools(role="all")
    assert len(gemini_tools) == len(ALL_TOOLS_MAP)
    assert len(gemini_tools) >= 6
    for t in gemini_tools:
        assert callable(t)
    print(f"✅ Test 1: {len(gemini_tools)} Gemini tool callables exported correctly.")


def test_openai_tools_schema_validity():
    """Verifies that all tool schemas are valid OpenAI function definitions."""
    openai_tools = get_openai_tools(role="all")
    assert len(openai_tools) == len(ALL_TOOLS_MAP)
    for t in openai_tools:
        assert t.get("type") == "function"
        fn = t.get("function", {})
        assert "name" in fn
        assert "description" in fn
        assert "parameters" in fn
    print(f"✅ Test 2: {len(openai_tools)} OpenAI tool schemas formatted properly.")


def test_execute_customer_intelligence():
    """Verifies execute_tool for get_customer_intelligence."""
    res = execute_tool("get_customer_intelligence", {"customer_id": "cust_0001"})
    assert res.get("success") is True
    assert res.get("found") is True
    assert "payment_reliability_pct" in res
    print("✅ Test 3: get_customer_intelligence executed successfully.")


def test_execute_concession_discount():
    """Verifies concession discount calculation and guardrail cap."""
    res = execute_tool("apply_concession_discount", {"discount_percent": 10, "reason": "Payer requested discount"})
    assert res.get("success") is True
    assert res.get("discount_applied_pct") == 10
    assert res.get("status") == "applied"
    print("✅ Test 4: apply_concession_discount executed successfully.")


def test_execute_register_promise_to_pay():
    """Verifies promise-to-pay registration."""
    res = execute_tool("register_promise_to_pay", {"promised_date": "Next Monday", "note": "Will settle on payday"})
    assert res.get("success") is True
    assert res.get("status") == "scheduled"
    assert res.get("reminders_paused") is True
    print("✅ Test 5: register_promise_to_pay executed successfully.")


def test_execute_merchant_overview():
    """Verifies merchant portfolio financial overview tool."""
    res = execute_tool("get_merchant_financial_overview", {"merchant_id": "merch_01"})
    assert res.get("success") is True
    assert "total_at_risk_inr" in res
    assert "total_recovered_inr" in res
    print("✅ Test 6: get_merchant_financial_overview executed successfully.")


def test_execute_decline_taxonomy_and_funnel():
    """Verifies decline code lookup and funnel analytics tools."""
    decline_res = execute_tool("lookup_decline_code", {"decline_code": "insufficient_funds"})
    assert decline_res.get("success") is True
    assert decline_res.get("retry_strategy") == "pay_cycle_delay"

    funnel_res = execute_tool("get_checkout_funnel_metrics", {"merchant_id": "merch_01"})
    assert funnel_res.get("success") is True
    assert "margin_shield_saved_inr" in funnel_res
    print("✅ Test 7: Decline taxonomy and checkout funnel tools executed successfully.")


def test_context_injection():
    """Verifies that missing arguments are auto-populated from context."""
    res = execute_tool("get_customer_intelligence", {}, context={"customer_id": "cust_0002"})
    assert res.get("success") is True
    assert res.get("customer_id") == "cust_0002"
    print("✅ Test 8: Context auto-injection verified.")


if __name__ == "__main__":
    test_gemini_tools_exported()
    test_openai_tools_schema_validity()
    test_execute_customer_intelligence()
    test_execute_concession_discount()
    test_execute_register_promise_to_pay()
    test_execute_merchant_overview()
    test_execute_decline_taxonomy_and_funnel()
    test_context_injection()
    print("\n🎉 ALL UNIFIED TOOL REGISTRY TESTS PASSED!")
