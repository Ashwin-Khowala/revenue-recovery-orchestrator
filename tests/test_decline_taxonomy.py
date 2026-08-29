"""
Test Suite: Decline Code Taxonomy Matrix
========================================
Validates 100% deterministic lookup of payment failure decline codes,
fault domain classification (Merchant vs Payer), and retry wait intervals.
"""

import pytest
from orchestrator.decline_codes import (
    lookup_decline_code,
    FaultDomain,
    RetryStrategy,
    DECLINE_CODE_TAXONOMY,
)
from orchestrator.nodes.root_cause_classifier import classify_root_cause


class TestDeclineCodeTaxonomy:
    """Unit tests for deterministic decline code matrix."""

    def test_merchant_side_gateway_timeout(self):
        info = lookup_decline_code("gateway_timeout")
        assert info.fault_domain == FaultDomain.MERCHANT_SYSTEM
        assert info.customer_contact_allowed is False
        assert info.retry_strategy == RetryStrategy.SILENT_REROUTE
        assert info.recommended_wait_hours <= 0.1  # ~5 mins

    def test_merchant_side_processor_outage(self):
        info = lookup_decline_code("processor_outage")
        assert info.fault_domain == FaultDomain.MERCHANT_SYSTEM
        assert info.customer_contact_allowed is False
        assert info.retry_strategy == RetryStrategy.SILENT_REROUTE

    def test_payer_side_insufficient_funds(self):
        info = lookup_decline_code("insufficient_funds")
        assert info.fault_domain == FaultDomain.PAYER_CUSTOMER
        assert info.customer_contact_allowed is True
        assert info.retry_strategy == RetryStrategy.DELAYED_RETRY_INCOME_CYCLE
        assert info.recommended_wait_hours >= 48.0  # 3 days wait for payroll cycle

    def test_payer_side_card_expired(self):
        info = lookup_decline_code("card_expired")
        assert info.fault_domain == FaultDomain.PAYER_CUSTOMER
        assert info.customer_contact_allowed is True
        assert info.retry_strategy == RetryStrategy.IMMEDIATE_CARD_UPDATE
        assert info.recommended_wait_hours == 0.0

    def test_payer_side_mandate_afa(self):
        info = lookup_decline_code("mandate_auth_failed")
        assert info.fault_domain == FaultDomain.PAYER_CUSTOMER
        assert info.customer_contact_allowed is True
        assert info.retry_strategy == RetryStrategy.REGULATORY_CONSENT

    def test_hard_decline_stolen_card(self):
        info = lookup_decline_code("stolen_card")
        assert info.fault_domain == FaultDomain.HARD_DECLINE
        assert info.customer_contact_allowed is False
        assert info.retry_strategy == RetryStrategy.NO_RETRY_CANCEL

    def test_synonym_normalization(self):
        info1 = lookup_decline_code("insufficient_balance")
        assert info1.code == "insufficient_funds"

        info2 = lookup_decline_code("expired_card")
        assert info2.code == "card_expired"

        info3 = lookup_decline_code("bank_timeout")
        assert info3.code == "gateway_timeout"

    def test_integration_in_root_cause_classifier(self):
        state = {
            "event_id": "test_tax_01",
            "event_type": "payment.failed",
            "amount": 4500.0,
            "metadata": {"decline_code": "gateway_timeout"},
            "history": {},
            "audit_trail": [],
        }
        res = classify_root_cause(state)
        assert res["root_cause"] == "payment_degraded"
        assert res["fault_domain"] == "merchant_system"
        assert res["confidence"] >= 0.95
        assert res["candidate_actions"][0]["target_channel"] == "reroute"
