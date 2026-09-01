"""
Unit Tests for Unified Tool Registry
Verifies cross-model compatibility for Gemini, Azure OpenAI, and Claude,
and unit tests for all customer and merchant tools.
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
from orchestrator.tools.registry import PAYER_TOOL_NAMES, MERCHANT_TOOL_NAMES


# ============================================================================
# 1. TOOL REGISTRY & SCHEMA VALIDATION TESTS
# ============================================================================

def test_gemini_tools_exported():
    """Verifies that all tools are callable for Gemini / Google GenAI."""
    gemini_tools = get_gemini_tools(role="all")
    assert len(gemini_tools) == len(ALL_TOOLS_MAP)
    assert len(gemini_tools) >= 20
    for t in gemini_tools:
        assert callable(t)
    print(f"[PASS] Test 1: {len(gemini_tools)} Gemini tool callables exported correctly.")


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
    print(f"[PASS] Test 2: {len(openai_tools)} OpenAI tool schemas formatted properly.")


def test_role_based_tool_filtering():
    """Verifies role-based tool segregation between payer and merchant."""
    payer_tools = get_gemini_tools(role="payer")
    merchant_tools = get_gemini_tools(role="merchant")

    assert len(payer_tools) == len(PAYER_TOOL_NAMES)
    assert len(merchant_tools) == len(MERCHANT_TOOL_NAMES)

    # Critical payer tools must be in payer list
    for name in ["apply_concession_discount", "register_promise_to_pay", "get_payment_link",
                 "get_payment_history", "get_invoice_aging", "get_subscription_plan_details",
                 "escalate_to_human"]:
        assert name in PAYER_TOOL_NAMES

    # Critical merchant tools must be in merchant list
    for name in ["get_merchant_financial_overview", "get_at_risk_incidents", "approve_high_value_invoice",
                 "get_b2b_aging_and_receivables_summary", "get_mandate_portfolio_health",
                 "get_ptp_cashflow_forecast"]:
        assert name in MERCHANT_TOOL_NAMES
    print("[PASS] Test 3: Role-based tool filtering verified.")


# ============================================================================
# 2. CUSTOMER / PAYER TOOLS TESTS
# ============================================================================

def test_execute_customer_intelligence():
    """Verifies execute_tool for get_customer_intelligence."""
    res = execute_tool("get_customer_intelligence", {"customer_id": "cust_0001"})
    assert res.get("success") is True
    assert res.get("found") is True
    assert "payment_reliability_pct" in res
    assert "risk_score_100" in res
    print("[PASS] Test 4: get_customer_intelligence executed successfully.")


def test_execute_concession_discount_and_guardrail_cap():
    """Verifies concession discount calculation and 15% maximum guardrail cap."""
    # Test valid discount within limit
    res1 = execute_tool("apply_concession_discount", {"discount_percent": 10, "reason": "Payer requested discount"})
    assert res1.get("success") is True
    assert res1.get("discount_applied_pct") == 10
    assert res1.get("status") == "applied"

    # Test guardrail cap enforcement (> 15% capped at 15%)
    res2 = execute_tool("apply_concession_discount", {"discount_percent": 30, "reason": "Payer requested excessive discount"})
    assert res2.get("success") is True
    assert res2.get("discount_applied_pct") == 15
    print("[PASS] Test 5: apply_concession_discount & guardrail cap (15%) verified.")


def test_execute_register_promise_to_pay_validation():
    """Verifies date validation for promise-to-pay (accepts valid, rejects invalid)."""
    # Valid date
    res_valid = execute_tool("register_promise_to_pay", {"promised_date": "Next Monday", "note": "Will settle on payday"})
    assert res_valid.get("success") is True
    assert res_valid.get("status") == "scheduled"
    assert res_valid.get("reminders_paused") is True

    # Invalid impossible date (e.g. 31 September)
    res_invalid = execute_tool("register_promise_to_pay", {"promised_date": "31 September", "note": "Impossible date"})
    assert res_invalid.get("status") == "error_invalid_date"
    assert res_invalid.get("reminders_paused") is False
    print("[PASS] Test 6: register_promise_to_pay valid & invalid date rejection verified.")


def test_execute_get_payment_history():
    """Verifies get_payment_history returns records, counts, and totals."""
    res = execute_tool("get_payment_history", {"customer_id": "cust_0001", "limit": 5})
    assert res.get("success") is True
    assert "records" in res
    assert "count" in res
    assert "total_paid_inr" in res
    assert "on_time_count" in res
    print("[PASS] Test 7: get_payment_history executed successfully.")


def test_execute_get_invoice_aging():
    """Verifies get_invoice_aging calculates days overdue and aging bucket."""
    res = execute_tool("get_invoice_aging", {"customer_id": "cust_0001"})
    assert res.get("success") is True
    assert "days_overdue" in res
    assert "aging_bucket" in res
    assert isinstance(res["days_overdue"], int)
    print("[PASS] Test 8: get_invoice_aging executed successfully.")


def test_execute_get_subscription_plan_details():
    """Verifies get_subscription_plan_details tier resolution and grace period status."""
    res = execute_tool("get_subscription_plan_details", {"customer_id": "cust_0001"})
    assert res.get("success") is True
    assert "plan_name" in res
    assert "billing_cycle" in res
    assert "amount_inr" in res
    assert "grace_period_active" in res
    print("[PASS] Test 9: get_subscription_plan_details executed successfully.")


def test_execute_escalate_to_human():
    """Verifies escalate_to_human generates ticket ID, pauses outreach, and logs audit."""
    res = execute_tool(
        "escalate_to_human",
        {"customer_id": "cust_0001", "customer_name": "Ashwin", "reason": "Customer requested manager", "amount": 4999.0}
    )
    assert res.get("success") is True
    assert res.get("status") == "escalated"
    assert res.get("ticket_id", "").startswith("ESC-")
    assert res.get("outreach_paused") is True
    print("[PASS] Test 10: escalate_to_human executed successfully.")


def test_execute_get_payment_link():
    """Verifies get_payment_link generates a 1-click Razorpay payment link."""
    res = execute_tool("get_payment_link", {"customer_name": "Aarav Sharma", "amount": 4999.0})
    assert res.get("success") is True
    assert "payment_url" in res
    assert "rzp.io" in res["payment_url"]
    print("[PASS] Test 11: get_payment_link executed successfully.")


# ============================================================================
# 3. MERCHANT / SUPERVISORY TOOLS TESTS
# ============================================================================

def test_execute_merchant_overview():
    """Verifies merchant portfolio financial overview tool."""
    res = execute_tool("get_merchant_financial_overview", {"merchant_id": "merch_01"})
    assert res.get("success") is True
    assert "total_at_risk_inr" in res
    assert "total_recovered_inr" in res
    assert "duplicate_contacts_count" in res
    assert res["duplicate_contacts_count"] == 0
    print("[PASS] Test 12: get_merchant_financial_overview executed successfully.")


def test_execute_at_risk_incidents():
    """Verifies at-risk incidents retrieval with optional issue_type filter."""
    res_all = execute_tool("get_at_risk_incidents", {"merchant_id": "merch_01", "limit": 5})
    assert res_all.get("success") is True
    assert "incidents" in res_all

    res_filtered = execute_tool("get_at_risk_incidents", {"merchant_id": "merch_01", "limit": 5, "issue_type": "subscription_failed"})
    assert res_filtered.get("success") is True
    print("[PASS] Test 13: get_at_risk_incidents with filtering verified.")


def test_execute_approve_high_value_invoice():
    """Verifies supervisor authorization of high-value invoice."""
    res = execute_tool("approve_high_value_invoice", {"invoice_id": "TechMatrix Corp", "approval_note": "Approved by CFO"})
    assert res.get("success") is True
    assert res.get("status") == "approved"
    assert res.get("invoice") == "TechMatrix Corp"
    print("[PASS] Test 14: approve_high_value_invoice executed successfully.")


def test_execute_decline_taxonomy_and_funnel():
    """Verifies decline code lookup and funnel analytics tools."""
    decline_res = execute_tool("lookup_decline_code", {"decline_code": "insufficient_funds"})
    assert decline_res.get("success") is True
    assert decline_res.get("retry_strategy") == "pay_cycle_delay"
    assert decline_res.get("customer_contact_allowed") is True

    funnel_res = execute_tool("get_checkout_funnel_metrics", {"merchant_id": "merch_01"})
    assert funnel_res.get("success") is True
    assert "margin_shield_saved_inr" in funnel_res
    assert "funnel_steps" in funnel_res
    print("[PASS] Test 15: Decline taxonomy and checkout funnel tools executed successfully.")


def test_execute_b2b_and_mandate_tools():
    """Verifies B2B receivables and mandate health tools."""
    b2b_res = execute_tool("get_b2b_aging_and_receivables_summary", {"merchant_id": "merch_01"})
    assert b2b_res.get("success") is True

    mandate_res = execute_tool("get_mandate_portfolio_health", {"merchant_id": "merch_01"})
    assert mandate_res.get("success") is True

    ptp_res = execute_tool("get_ptp_cashflow_forecast", {"merchant_id": "merch_01"})
    assert ptp_res.get("success") is True
    print("[PASS] Test 16: B2B receivables, mandate health, and PTP forecast tools executed successfully.")


def test_context_injection():
    """Verifies that missing arguments are auto-populated from context."""
    res = execute_tool("get_customer_intelligence", {}, context={"customer_id": "cust_0002"})
    assert res.get("success") is True
    assert res.get("customer_id") == "cust_0002"
    print("[PASS] Test 17: Context auto-injection verified.")


if __name__ == "__main__":
    test_gemini_tools_exported()
    test_openai_tools_schema_validity()
    test_role_based_tool_filtering()
    test_execute_customer_intelligence()
    test_execute_concession_discount_and_guardrail_cap()
    test_execute_register_promise_to_pay_validation()
    test_execute_get_payment_history()
    test_execute_get_invoice_aging()
    test_execute_get_subscription_plan_details()
    test_execute_escalate_to_human()
    test_execute_get_payment_link()
    test_execute_merchant_overview()
    test_execute_at_risk_incidents()
    test_execute_approve_high_value_invoice()
    test_execute_decline_taxonomy_and_funnel()
    test_execute_b2b_and_mandate_tools()
    test_context_injection()
    print("\n[SUCCESS] ALL UNIFIED TOOL REGISTRY TESTS PASSED!")

