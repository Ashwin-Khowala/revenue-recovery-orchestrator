"""
Tests for Indic Voice AI, Code-Switching Semantic Extraction, and Telephony Guardrails
"""

import pytest
from datetime import datetime, timezone
from orchestrator.channels.voice import (
    generate_voice_recovery,
    validate_calling_window,
    check_human_handoff_trigger,
    extract_call_transcript_intent,
    DEFAULT_VOICE_CONFIG,
)
from orchestrator.inbound_intent import classify_inbound_intent, InboundIntentType
from orchestrator.nodes.guardrails import check_guardrails


def test_indic_voice_pipeline_config():
    """Verify 4-stage Indic voice pipeline specification."""
    assert DEFAULT_VOICE_CONFIG.stt_provider == "sarvam_indic_multilingual"
    assert DEFAULT_VOICE_CONFIG.tts_provider == "smallest_ai_indic"
    assert DEFAULT_VOICE_CONFIG.vad_silence_timeout_ms == 350
    assert DEFAULT_VOICE_CONFIG.barge_in_enabled is True
    assert DEFAULT_VOICE_CONFIG.ai_disclosure_mandatory is True


def test_calling_window_trai_validation():
    """Verify TRAI 9 AM - 9 PM IST window enforcement."""
    # 10:00 AM IST (04:30 UTC) -> Valid
    valid_utc = datetime(2026, 8, 30, 4, 30, tzinfo=timezone.utc)
    is_valid, msg = validate_calling_window(valid_utc)
    assert is_valid is True

    # 11:30 PM IST (18:00 UTC) -> Invalid (Nighttime violation)
    invalid_night_utc = datetime(2026, 8, 30, 18, 0, tzinfo=timezone.utc)
    is_valid, msg = validate_calling_window(invalid_night_utc)
    assert is_valid is False
    assert "TRAI Compliance Block" in msg

    # 6:00 AM IST (00:30 UTC) -> Invalid (Early morning violation)
    invalid_morning_utc = datetime(2026, 8, 30, 0, 30, tzinfo=timezone.utc)
    is_valid, msg = validate_calling_window(invalid_morning_utc)
    assert is_valid is False


def test_mandatory_ai_disclosure_in_voice_script():
    """Verify all generated voice scripts begin with clear AI & recording disclosure."""
    res = generate_voice_recovery(
        customer_name="Aarav Sharma",
        amount=4999.0,
        root_cause="checkout_abandoned",
        behavioral_cause="technical_form_friction",
    )
    assert res["ai_disclosure_included"] is True
    assert "Razorpay's AI Recovery Concierge" in res["script"]
    assert "recorded line" in res["script"]


def test_human_handoff_trigger():
    """Verify immediate human handoff trigger when caller demands a human or shows distress."""
    is_handoff, reason = check_human_handoff_trigger("Please let me talk to a human manager right now.")
    assert is_handoff is True
    assert "human" in reason.lower()

    is_handoff, reason = check_human_handoff_trigger("Kripya kisi insaan se baat karao, bot se nahi karni.")
    assert is_handoff is True

    is_handoff, reason = check_human_handoff_trigger("Haan payment link bhej do, main kar deta hoon.")
    assert is_handoff is False


def test_signature_demo_beat_hinglish_soft_ptp():
    """
    CRITICAL SIGNATURE DEMO BEAT:
    Tests that 'haan bhai, paisa toh bhejunga, but abhi thoda tight hai'
    is classified as a soft Promise-to-Pay rather than a refusal, pausing dunning.
    """
    transcript = "haan bhai, paisa toh bhejunga, but abhi thoda tight hai"
    result = extract_call_transcript_intent(
        call_transcript=transcript,
        customer_id="cust_0001",
        customer_name="Aarav Sharma",
        amount=4999.0,
        event_id="evt_voice_demo_01",
    )

    assert result["extracted_intent"] == "promise_to_pay"
    assert result["dunning_paused"] is True
    assert result["human_handoff_required"] is False
    assert result["confidence"] > 0.75
    assert "audit_hash" in result


def test_voice_calling_window_guardrail():
    """Verify guardrail check blocks voice calls attempted outside legal hours when strict mode enabled."""
    state = {
        "event_id": "evt_test_night_voice",
        "amount": 2500.0,
        "root_cause": "subscription_failed",
        "chosen_action": {"target_channel": "voice"},
        "metadata": {"strict_calling_window": True},
        "history": {"prior_contacts": 0},
    }
    # Test night hour override
    from unittest.mock import patch
    with patch("orchestrator.channels.voice.validate_calling_window", return_value=(False, "TRAI Compliance Block")):
        res = check_guardrails(state)
        assert res["guardrail_result"] == "BLOCK"
        assert res["guardrail_rule_fired"] == "RULE_VOICE_OUTSIDE_LEGAL_CALLING_HOURS"
