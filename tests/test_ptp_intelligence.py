"""
Unit Tests for Promise-to-Pay (PTP) Intelligence, Behavioral Scoring, and Cash-Flow Forecast
"""

import pytest
from orchestrator.ptp_intelligence import (
    score_promise_linguistic_confidence,
    register_ptp_commitment,
    renegotiate_ptp_commitment,
    calculate_ptp_cashflow_forecast,
    diagnose_broken_promise,
    BrokenPtpRootCause,
)
from orchestrator.tools.registry import execute_tool


def test_linguistic_confidence_hedged_vs_firm():
    """
    Test 1: Linguistic confidence scoring at capture time.
    Verifies that hedged statements have lower confidence than firm statements.
    """
    # 1. Firm commitment with implementation intention
    firm_text = "I will 100% pay ₹24,500 by this Friday via UPI"
    firm_res = score_promise_linguistic_confidence(
        customer_wording=firm_text,
        amount=24500.0,
        customer_name="Aarav Sharma",
        customer_reliability_score=0.95,
    )
    assert firm_res["commitment_strength"] in ("firm", "moderate")
    assert firm_res["linguistic_confidence"] >= 0.80
    assert firm_res["is_hedged"] is False

    # 2. Hedged cash-crunch statement
    hedged_text = "haan bhai koshish karunga paisa bhejunga but abhi thoda tight hai"
    hedged_res = score_promise_linguistic_confidence(
        customer_wording=hedged_text,
        amount=24500.0,
        customer_name="Aarav Sharma",
        customer_reliability_score=0.90,
    )
    assert hedged_res["is_hedged"] is True
    assert hedged_res["linguistic_confidence"] < firm_res["linguistic_confidence"]


def test_ptp_registration_and_dunning_pause():
    """
    Test 2: Register PTP commitment and verify dunning paused.
    """
    res = register_ptp_commitment(
        event_id="evt_ptp_test_001",
        customer_id="cust_0001",
        customer_name="Aarav Sharma",
        amount=14500.0,
        customer_wording="Salary comes on 5th will transfer then",
        channel_captured="voice",
        customer_reliability_score=0.92,
    )
    assert res["status"] == "active_watching"
    assert res["outreach_paused"] is True
    assert "ptp_id" in res
    assert res["expected_realization_rate"] > 0.0


def test_ptp_renegotiation_and_revision_ledger():
    """
    Test 3: Renegotiation preserves revision history and resets watch clock.
    """
    ptp_id = "ptp_evt_test_001"
    event_id = "evt_ptp_test_001"
    
    ren_res = renegotiate_ptp_commitment(
        ptp_id=ptp_id,
        event_id=event_id,
        new_wording="Can we push it to next Friday? Waiting for client wire.",
        new_promised_date="2026-09-12",
        customer_name="Aarav Sharma",
    )
    assert ren_res["status"] == "renegotiated_watching"
    assert ren_res["new_promised_date"] == "2026-09-12"
    assert ren_res["revision_logged"]["reason"] == "Customer requested extension / renegotiated timeline"


def test_ptp_cashflow_forecast():
    """
    Test 4: Rolling portfolio cash-flow forecast weighted by reliability and confidence.
    """
    forecast = calculate_ptp_cashflow_forecast("merch_01")
    assert forecast["total_active_ptp_commitments"] >= 5
    assert forecast["total_ptp_face_value_inr"] > 0
    assert "forecast_7_days" in forecast
    assert "forecast_14_days" in forecast
    assert "forecast_30_days" in forecast

    # Expected realization rate must be <= 100% and weighted cash <= face value
    f7 = forecast["forecast_7_days"]
    assert f7["expected_cash_inr"] <= f7["face_value_inr"]
    assert 0.0 < f7["realization_rate_pct"] <= 100.0


def test_broken_promise_root_cause_diagnosis():
    """
    Test 5: Diagnoses root causes of broken promises (forgot vs liquidity vs dispute vs unresponsive).
    """
    # 1. Forgot
    d1 = diagnose_broken_promise("ptp_01", "evt_01", "Sorry I completely forgot about this, paying now!")
    assert d1["broken_root_cause"] == BrokenPtpRootCause.FORGOT.value
    assert d1["recommended_next_action"] == "gentle_smart_link_nudge"

    # 2. Liquidity Crunch
    d2 = diagnose_broken_promise("ptp_02", "evt_02", "Still tight on money, salary delayed by 10 days")
    assert d2["broken_root_cause"] == BrokenPtpRootCause.LIQUIDITY_CRUNCH.value
    assert d2["recommended_next_action"] == "offer_split_installment_or_pause"

    # 3. Dispute
    d3 = diagnose_broken_promise("ptp_03", "evt_03", "There is a wrong GST calculation on this invoice")
    assert d3["broken_root_cause"] == BrokenPtpRootCause.COMMERCIAL_DISPUTE.value
    assert d3["recommended_next_action"] == "escalate_to_human_ap_reviewer"

    # 4. Unresponsive
    d4 = diagnose_broken_promise("ptp_04", "evt_04", "no_response_after_24h_grace")
    assert d4["broken_root_cause"] == BrokenPtpRootCause.UNRESPONSIVE.value
    assert d4["recommended_next_action"] == "escalate_to_tiered_channel"


def test_ptp_tools_execution():
    """
    Test 6: Verify PTP tools execute cleanly through the central tool registry.
    """
    res1 = execute_tool("get_ptp_cashflow_forecast", {"merchant_id": "merch_01"})
    assert res1["tool"] == "get_ptp_cashflow_forecast"
    assert "forecast" in res1

    res2 = execute_tool("simulate_ptp_linguistic_score", {
        "customer_wording": "Will pay on Friday via UPI",
        "amount": 24500.0,
    })
    assert res2["tool"] == "simulate_ptp_linguistic_score"
    assert "analysis" in res2
