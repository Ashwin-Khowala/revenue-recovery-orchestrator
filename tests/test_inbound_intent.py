"""
Test Suite: Inbound Conversational Reply Intent Classifier
==========================================================
Validates semantic classification of customer WhatsApp/SMS/Email replies:
  1. Promise-to-Pay detection and target date extraction.
  2. Customer Cancellation / Churn detection and Stopping Rule enforcement.
  3. Alternative payment rail requests (UPI, QR code).
  4. Fast-path regulatory opt-out keywords (STOP, UNSUBSCRIBE, DND).
"""

import pytest
from orchestrator.inbound_intent import (
    classify_inbound_intent,
    handle_inbound_reply,
    InboundIntentType,
)


class TestInboundIntentClassifier:
    """E2E tests for conversational customer reply reasoning."""

    def test_fast_path_stop_opt_out(self):
        result = classify_inbound_intent("STOP")
        assert result.intent == InboundIntentType.OPT_OUT
        assert result.stopping_rule_triggered is True
        assert result.confidence == 1.0

        result_dnd = classify_inbound_intent("UNSUBSCRIBE")
        assert result_dnd.intent == InboundIntentType.OPT_OUT
        assert result_dnd.stopping_rule_triggered is True

    def test_promise_to_pay_classification(self):
        msg = "I am waiting for my salary, will definitely pay this Friday"
        result = classify_inbound_intent(msg, {"amount": 4999.0, "customer_name": "Rohan"})
        assert result.intent == InboundIntentType.PROMISE_TO_PAY
        assert result.stopping_rule_triggered is False
        assert result.confidence >= 0.8
        # Should extract a valid date string
        assert result.promised_pay_date is not None or "Friday" in result.reasoning

    def test_customer_cancellation_stopping_rule(self):
        msg = "I already asked your support team to cancel my subscription last week. Please stop charging my card!"
        result = classify_inbound_intent(msg, {"amount": 1999.0, "customer_name": "Ananya"})
        assert result.intent == InboundIntentType.CUSTOMER_CANCELLATION
        assert result.stopping_rule_triggered is True
        assert result.confidence >= 0.8

    def test_alternative_payment_rail_request(self):
        msg = "Can you send me a Google Pay or UPI link instead? My credit card is having issues."
        result = classify_inbound_intent(msg, {"amount": 2500.0, "customer_name": "Vikram"})
        assert result.intent == InboundIntentType.ALTERNATIVE_PAYMENT_REQUEST
        assert result.stopping_rule_triggered is False
        assert result.confidence >= 0.8

    def test_handle_inbound_reply_ptp_pipeline(self):
        reply_res = handle_inbound_reply(
            customer_message="I will clear this pending bill on 2026-09-10",
            event_id="test_inbound_ptp_01",
            customer_id="cust_inbound_01",
            merchant_id="merch_01",
            amount=5000.0,
        )
        assert reply_res["status"] == "processed"
        assert reply_res["intent_result"]["intent"] == "promise_to_pay"
        assert reply_res["stopping_rule_active"] is False

    def test_handle_inbound_reply_cancellation_pipeline(self):
        reply_res = handle_inbound_reply(
            customer_message="I do not want this service anymore. Do not charge me.",
            event_id="test_inbound_cancel_01",
            customer_id="cust_inbound_02",
            merchant_id="merch_01",
            amount=999.0,
        )
        assert reply_res["status"] == "processed"
        assert reply_res["intent_result"]["intent"] == "customer_cancellation"
        assert reply_res["stopping_rule_active"] is True
