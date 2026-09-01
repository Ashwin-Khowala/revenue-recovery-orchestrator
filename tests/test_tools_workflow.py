"""
End-to-End Workflow Verification Tests for Multi-Model Voice and Chat Tools
Validates end-to-end multi-turn conversational recovery workflows for both Payer and Merchant.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from orchestrator.gemini_live_engine import (
    _run_sync_fallback_turn,
    build_system_instruction,
)
from orchestrator.tools import execute_tool


# ============================================================================
# 1. PAYER FULL MULTI-TURN RECOVERY CONVERSATION WORKFLOW
# ============================================================================

def test_payer_end_to_end_journey():
    """
    Simulates a full 7-step customer interaction:
    1. Plan inquiry -> returns plan details
    2. Overdue inquiry -> returns aging and days
    3. Payment history -> returns past settlement records
    4. Concession request -> applies 5% discount
    5. Promise-to-Pay -> schedules commitment and pauses outreach
    6. Payment link -> generates Razorpay 1-click URL
    7. Escalation request -> creates ESC ticket and pauses outreach
    """
    customer_id = "cust_0001"
    customer_name = "Ashwin Khowala"
    amount = 4999.0

    # Step 1: Subscription Plan Details
    turn1 = _run_sync_fallback_turn(
        user_speech="What subscription plan am I currently on?",
        role="payer",
        customer_name=customer_name,
        amount=amount,
        root_cause="subscription_failed",
        customer_id=customer_id,
        merchant_id="merch_01",
        force_heuristic=True,
    )
    assert turn1["success"] is True
    assert any(t["tool"] == "get_subscription_plan_details" for t in turn1.get("executed_tools", []))
    assert "Plan" in turn1["voice_reply"] or "plan" in turn1["voice_reply"] or "Starter" in turn1["voice_reply"]

    # Step 2: Invoice Aging Inquiry
    turn2 = _run_sync_fallback_turn(
        user_speech="How many days overdue is my bill?",
        role="payer",
        customer_name=customer_name,
        amount=amount,
        root_cause="subscription_failed",
        customer_id=customer_id,
        merchant_id="merch_01",
        force_heuristic=True,
    )
    assert turn2["success"] is True
    assert any(t["tool"] == "get_invoice_aging" for t in turn2.get("executed_tools", []))
    assert "days overdue" in turn2["voice_reply"].lower() or "overdue" in turn2["voice_reply"].lower()

    # Step 3: Payment History Inquiry
    turn3 = _run_sync_fallback_turn(
        user_speech="Can you show my past payment history?",
        role="payer",
        customer_name=customer_name,
        amount=amount,
        root_cause="subscription_failed",
        customer_id=customer_id,
        merchant_id="merch_01",
        force_heuristic=True,
    )
    assert turn3["success"] is True
    assert any(t["tool"] == "get_payment_history" for t in turn3.get("executed_tools", []))
    assert "payment history" in turn3["voice_reply"].lower() or "settled" in turn3["voice_reply"].lower()

    # Step 4: Settlement Concession Discount
    turn4 = _run_sync_fallback_turn(
        user_speech="Can you offer a 5% discount or concession on this invoice?",
        role="payer",
        customer_name=customer_name,
        amount=amount,
        root_cause="subscription_failed",
        customer_id=customer_id,
        merchant_id="merch_01",
        force_heuristic=True,
    )
    assert turn4["success"] is True
    assert any(t["tool"] == "apply_concession_discount" for t in turn4.get("executed_tools", []))
    assert turn4["updated_amount"] < amount
    assert turn4["updated_amount"] == round(amount * 0.95)

    # Step 5: Promise-to-Pay Commitment
    turn5 = _run_sync_fallback_turn(
        user_speech="I promise to pay next Monday after salary",
        role="payer",
        customer_name=customer_name,
        amount=turn4["updated_amount"],
        root_cause="subscription_failed",
        customer_id=customer_id,
        merchant_id="merch_01",
        force_heuristic=True,
    )
    assert turn5["success"] is True
    assert any(t["tool"] == "register_promise_to_pay" for t in turn5.get("executed_tools", []))
    assert "Next Monday" in turn5["voice_reply"] or "paused" in turn5["voice_reply"].lower()

    # Step 6: 1-Click Payment Link
    turn6 = _run_sync_fallback_turn(
        user_speech="Please send me the Razorpay payment link to pay now",
        role="payer",
        customer_name=customer_name,
        amount=turn4["updated_amount"],
        root_cause="subscription_failed",
        customer_id=customer_id,
        merchant_id="merch_01",
        force_heuristic=True,
    )
    assert turn6["success"] is True
    assert any(t["tool"] == "get_payment_link" for t in turn6.get("executed_tools", []))
    assert "rzp.io" in turn6["voice_reply"] or "https://" in turn6["voice_reply"]

    # Step 7: Human Escalation
    turn7 = _run_sync_fallback_turn(
        user_speech="I want to speak with a human manager immediately",
        role="payer",
        customer_name=customer_name,
        amount=turn4["updated_amount"],
        root_cause="subscription_failed",
        customer_id=customer_id,
        merchant_id="merch_01",
        force_heuristic=True,
    )
    assert turn7["success"] is True
    assert any(t["tool"] == "escalate_to_human" for t in turn7.get("executed_tools", []))
    assert "ESC-" in turn7["voice_reply"] or "representative" in turn7["voice_reply"].lower()
    print("[PASS] Payer end-to-end journey verified.")


# ============================================================================
# 2. MERCHANT SUPERVISORY WORKFLOW
# ============================================================================

def test_merchant_supervisory_workflow():
    """
    Simulates merchant operations supervisory journey:
    1. Overall financial health
    2. At-risk incidents triage
    3. PTP cash flow forecasting
    4. RBI Mandate & AFA compliance
    5. B2B receivables aging & dispute resolution
    6. Checkout drop-off & margin shield
    7. Subscription churn diagnostics
    8. High-value escalation authorization
    """
    merchant_id = "merch_01"

    # 1. Financial Overview
    m_turn1 = _run_sync_fallback_turn(
        user_speech="Give me the total financial overview and at-risk revenue",
        role="merchant",
        customer_name="Merchant Operations",
        amount=245998.0,
        root_cause="receivable_overdue",
        customer_id="cust_0001",
        merchant_id=merchant_id,
        force_heuristic=True,
    )
    assert m_turn1["success"] is True
    assert any(t["tool"] == "get_merchant_financial_overview" for t in m_turn1.get("executed_tools", []))

    # 2. Incident Queue
    m_turn2 = _run_sync_fallback_turn(
        user_speech="Show me the list of pending at-risk incidents",
        role="merchant",
        customer_name="Merchant Operations",
        amount=245998.0,
        root_cause="receivable_overdue",
        customer_id="cust_0001",
        merchant_id=merchant_id,
        force_heuristic=True,
    )
    assert m_turn2["success"] is True
    assert any(t["tool"] == "get_at_risk_incidents" for t in m_turn2.get("executed_tools", []))

    # 3. PTP Liquidity Forecast
    m_turn3 = _run_sync_fallback_turn(
        user_speech="What is our 7-day cash flow forecast from active promise to pay commitments?",
        role="merchant",
        customer_name="Merchant Operations",
        amount=245998.0,
        root_cause="promise_to_pay",
        customer_id="cust_0001",
        merchant_id=merchant_id,
        force_heuristic=True,
    )
    assert m_turn3["success"] is True
    assert any(t["tool"] == "get_ptp_cashflow_forecast" for t in m_turn3.get("executed_tools", []))
    assert "Promise-to-Pay" in m_turn3["voice_reply"] or "PTP" in m_turn3["voice_reply"] or "inflow" in m_turn3["voice_reply"].lower()

    # 4. Mandate Portfolio & RBI AFA
    m_turn4 = _run_sync_fallback_turn(
        user_speech="How is our recurring mandate health and RBI AFA threshold compliance?",
        role="merchant",
        customer_name="Merchant Operations",
        amount=245998.0,
        root_cause="mandate_auth_failed",
        customer_id="cust_0001",
        merchant_id=merchant_id,
        force_heuristic=True,
    )
    assert m_turn4["success"] is True
    assert any(t["tool"] == "get_mandate_portfolio_health" for t in m_turn4.get("executed_tools", []))
    assert "Mandate" in m_turn4["voice_reply"] or "AFA" in m_turn4["voice_reply"]

    # 5. B2B Receivables & Aging
    m_turn5 = _run_sync_fallback_turn(
        user_speech="Show me overdue B2B receivables and aging buckets",
        role="merchant",
        customer_name="Merchant Operations",
        amount=245998.0,
        root_cause="receivable_overdue",
        customer_id="cust_0001",
        merchant_id=merchant_id,
        force_heuristic=True,
    )
    assert m_turn5["success"] is True
    assert any(t["tool"] == "get_b2b_aging_and_receivables_summary" for t in m_turn5.get("executed_tools", []))
    assert "B2B" in m_turn5["voice_reply"] or "aging" in m_turn5["voice_reply"].lower()

    # 6. Checkout Funnel & Margin Shield
    m_turn6 = _run_sync_fallback_turn(
        user_speech="What are our checkout funnel drop-offs and margin shield savings?",
        role="merchant",
        customer_name="Merchant Operations",
        amount=245998.0,
        root_cause="checkout_abandoned",
        customer_id="cust_0001",
        merchant_id=merchant_id,
        force_heuristic=True,
    )
    assert m_turn6["success"] is True
    assert any(t["tool"] == "get_checkout_funnel_metrics" for t in m_turn6.get("executed_tools", []))
    assert "Margin Shield" in m_turn6["voice_reply"] or "Checkout" in m_turn6["voice_reply"]

    # 7. Subscription Churn
    m_turn7 = _run_sync_fallback_turn(
        user_speech="Analyze subscription churn risk for customer cust_0001",
        role="merchant",
        customer_name="Merchant Operations",
        amount=245998.0,
        root_cause="subscription_failed",
        customer_id="cust_0001",
        merchant_id=merchant_id,
        force_heuristic=True,
    )
    assert m_turn7["success"] is True
    assert any(t["tool"] == "get_subscription_churn_analysis" for t in m_turn7.get("executed_tools", []))

    # 8. High-Value Escalation Approval
    m_turn8 = _run_sync_fallback_turn(
        user_speech="Approve high-value invoice for TechMatrix Corp",
        role="merchant",
        customer_name="TechMatrix Corp",
        amount=145000.0,
        root_cause="receivable_overdue",
        customer_id="cust_0001",
        merchant_id=merchant_id,
        force_heuristic=True,
    )
    assert m_turn8["success"] is True
    assert any(t["tool"] == "approve_high_value_invoice" for t in m_turn8.get("executed_tools", []))
    assert "approved" in m_turn8["voice_reply"].lower()
    print("[PASS] Merchant supervisory workflow verified.")


# ============================================================================
# 3. PROMISE-TO-PAY DATE PARSING INTELLIGENCE IN WORKFLOW
# ============================================================================

def test_ptp_date_extraction_workflow():
    """Verifies various natural language dates are correctly parsed and passed to tool."""
    test_phrases = [
        ("I will pay tomorrow morning", "Tomorrow"),
        ("I will pay this Friday", "This Friday"),
        ("I will pay in 3 days", "In 3 Days"),
        ("I promise to settle in 7 days", "In 7 Days"),
        ("I will pay next Monday", "Next Monday"),
        ("I will pay on salary day", "On Salary Date"),
    ]

    for speech, expected_date in test_phrases:
        res = _run_sync_fallback_turn(
            user_speech=speech,
            role="payer",
            customer_name="Test User",
            amount=5000.0,
            root_cause="subscription_failed",
            customer_id="cust_0001",
            merchant_id="merch_01",
            force_heuristic=True,
        )
        assert res["success"] is True
        ptp_tools = [t for t in res.get("executed_tools", []) if t.get("tool") == "register_promise_to_pay"]
        assert len(ptp_tools) == 1
        assert ptp_tools[0]["status"] == "scheduled"
        assert ptp_tools[0]["promised_date"] == expected_date
    print("[PASS] PTP natural language date extraction workflow verified.")


if __name__ == "__main__":
    test_payer_end_to_end_journey()
    test_merchant_supervisory_workflow()
    test_ptp_date_extraction_workflow()
    print("\n[SUCCESS] ALL WORKFLOW VERIFICATION TESTS PASSED!")
