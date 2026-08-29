"""
Unit & Integration Tests for Enterprise B2B Receivables Orchestrator
===================================================================
Tests 3-stage B2B intelligence, root cause diagnosis, dispute stopping rules,
tiered contact escalation, Mem0-style semantic email extraction, and merchant tools.
"""

import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from orchestrator.b2b_receivables import (
    B2BAgingBucket,
    B2BCategory,
    B2BRootCause,
    ContactTier,
    classify_aging_bucket,
    diagnose_b2b_receivable,
    extract_b2b_email_intent,
)
from orchestrator.tools import execute_tool


def test_aging_bucket_classification():
    """Verifies standard enterprise financial aging bucket boundaries."""
    assert classify_aging_bucket(15) == B2BAgingBucket.CURRENT_0_30
    assert classify_aging_bucket(45) == B2BAgingBucket.OVERDUE_31_60
    assert classify_aging_bucket(75) == B2BAgingBucket.OVERDUE_61_90
    assert classify_aging_bucket(120) == B2BAgingBucket.OVERDUE_90_PLUS
    print("[PASS] Test 1: Aging bucket classification verified across all brackets.")


def test_missing_po_process_friction_diagnosis():
    """Verifies that an invoice missing a PO is diagnosed as administrative process friction."""
    diag = diagnose_b2b_receivable(
        invoice_id="INV-2026-0599",
        client_company="Vikram Solar Infra",
        amount_inr=18500.0,
        days_overdue=35,
        po_status="missing_po",
        po_number=None,
        history={"customer_avg_days_late": 5, "prior_payment_success_rate": 0.94},
    )

    assert diag.category == B2BCategory.PROCESS_FRICTION
    assert diag.root_cause == B2BRootCause.MISSING_PO_REFERENCE
    assert diag.requires_human_routing is False
    assert diag.is_stopping_rule_triggered is False
    assert diag.target_contact_tier == ContactTier.AP_ANALYST
    assert "PO Reference Required" in diag.suggested_email_subject
    print("[PASS] Test 2: Missing PO process friction diagnosed and routed to AP analyst.")


def test_commercial_dispute_stopping_rule():
    """Verifies that a commercial dispute halts dunning immediately and routes to Account Executive."""
    diag = diagnose_b2b_receivable(
        invoice_id="INV-2026-0612",
        client_company="Apex Logistics B2B",
        amount_inr=26500.0,
        days_overdue=65,
        po_status="approved",
        po_number="PO-7741",
        dispute_flag=True,
        dispute_reason="Damaged goods in transit (40 units out of 100)",
    )

    assert diag.category == B2BCategory.COMMERCIAL_DISPUTE
    assert diag.root_cause == B2BRootCause.DISPUTED_QUANTITY_OR_ITEMS
    assert diag.requires_human_routing is True
    assert diag.is_stopping_rule_triggered is True
    assert diag.recommended_action == "route_to_account_executive"
    print("[PASS] Test 3: Commercial dispute stopping rule triggered; dunning halted & routed to human.")


def test_tiered_contact_escalation_ap_to_buyer():
    """Verifies that after 2 unresponsive AP cycles, outreach escalates to commercial buyer."""
    diag = diagnose_b2b_receivable(
        invoice_id="INV-2026-0587",
        client_company="TechMatrix Corp",
        amount_inr=145000.0,
        days_overdue=45,
        po_status="approved",
        po_number="PO-8832",
        contact_attempt_count=2,  # 2 prior silent AP contacts
    )

    assert diag.target_contact_tier == ContactTier.BUYER_BUSINESS_OWNER
    assert diag.recommended_action == "escalate_to_buyer_relationship_owner"
    print("[PASS] Test 4: Tiered contact escalation from AP to Buyer verified.")


def test_credit_distress_over_exposure():
    """Verifies that exceeding approved credit limit with aging > 60d flags financial credit review."""
    diag = diagnose_b2b_receivable(
        invoice_id="INV-2026-0540",
        client_company="HighRisk Infra",
        amount_inr=250000.0,
        days_overdue=75,
        total_exposure_inr=500000.0,
        credit_limit_inr=200000.0,
    )

    assert diag.category == B2BCategory.CASH_FLOW_RISK
    assert diag.root_cause == B2BRootCause.CREDIT_DISTRESS_RISK
    assert diag.requires_human_routing is True
    assert diag.is_stopping_rule_triggered is True
    print("[PASS] Test 5: Credit limit over-exposure flagged for financial credit hold.")


def test_semantic_email_extraction_three_replies():
    """
    Demonstrates the core pitch: Correctly distinguishing 3 real-world AP replies to the same invoice:
    1. Process Fix (Missing PO) -> Auto-applies PO
    2. Commercial Dispute -> Halts dunning & routes to human
    3. Promise-to-Pay -> Extracts date & mutes reminders
    """
    # Case 1: Process Fix
    reply_1 = extract_b2b_email_intent(
        "Hi, our AP portal rejected this invoice because it is missing PO reference #PO-9821. Please resend with PO included.",
        invoice_id="INV-001",
        client_company="Vikram Solar",
    )
    assert reply_1.reply_type == "process_fix"
    assert reply_1.stop_automated_dunning is False
    assert reply_1.escalation_required is False

    # Case 2: Commercial Dispute
    reply_2 = extract_b2b_email_intent(
        "We are disputing line item 3. 40 units out of 100 arrived damaged in transit so we are withholding payment until credit note is issued.",
        invoice_id="INV-002",
        client_company="Apex Logistics",
    )
    assert reply_2.reply_type == "commercial_dispute"
    assert reply_2.stop_automated_dunning is True
    assert reply_2.escalation_required is True

    # Case 3: Promise-to-Pay
    reply_3 = extract_b2b_email_intent(
        "Invoice approved by finance director. Payment is scheduled in our bi-weekly batch and will be paid by Friday 20th.",
        invoice_id="INV-003",
        client_company="TechMatrix Corp",
    )
    assert reply_3.reply_type == "promise_to_pay"
    assert reply_3.stop_automated_dunning is False
    assert reply_3.promised_pay_date is not None

    print("[PASS] Test 6: Mem0-style semantic email extraction correctly classified all 3 replies!")


def test_b2b_tools_execution():
    """Verifies that the B2B tools execute properly via the unified tool registry."""
    res_summary = execute_tool("get_b2b_aging_and_receivables_summary", {"merchant_id": "merch_01"})
    assert res_summary.get("success") is True
    assert "aging_buckets" in res_summary

    res_po = execute_tool("resolve_b2b_process_blocker", {"invoice_id": "INV-001", "po_number": "PO-9821"})
    assert res_po.get("success") is True
    assert res_po.get("status") == "resolved_and_redispatched"

    res_dispute = execute_tool("route_b2b_dispute_to_human", {"invoice_id": "INV-002", "dispute_reason": "Damaged goods"})
    assert res_dispute.get("success") is True
    assert res_dispute.get("status") == "dunning_halted_human_assigned"

    res_sim = execute_tool("simulate_b2b_ap_email_reply", {"email_text": "We will pay by next Friday."})
    assert res_sim.get("success") is True
    assert res_sim.get("reply_type") == "promise_to_pay"

    print("[PASS] Test 7: All 4 B2B tools executed successfully via unified registry.")


if __name__ == "__main__":
    test_aging_bucket_classification()
    test_missing_po_process_friction_diagnosis()
    test_commercial_dispute_stopping_rule()
    test_tiered_contact_escalation_ap_to_buyer()
    test_credit_distress_over_exposure()
    test_semantic_email_extraction_three_replies()
    test_b2b_tools_execution()
    print("\n[SUCCESS] ALL B2B RECEIVABLES TESTS PASSED!")
