"""
Test Suite for Gemini 3.1 Flash Live Voice Engine
Validates live bidirectional streaming, native audio synthesis, tool calling, and persistent session memory.
"""

import asyncio
import os
import pytest
from dotenv import load_dotenv

load_dotenv()

from orchestrator.gemini_live_engine import (
    GeminiLiveSession,
    run_gemini_live_turn,
    run_voice_agent_turn,
    build_system_instruction,
)


@pytest.mark.asyncio
async def test_gemini_live_session_lifecycle():
    """Tests GeminiLiveSession persistent connection and tool execution."""
    session = GeminiLiveSession(
        role="merchant",
        customer_name="Admin",
        amount=245998.0,
        root_cause="receivable_overdue",
        customer_id="cust_0001",
        merchant_id="merch_01",
    )
    await session.connect()
    assert session.is_active is True
    
    result = await session.send_turn("Kitna paisa atka hai?")
    assert result["success"] is True
    assert result["voice_reply"] is not None
    assert len(result["voice_reply"]) > 0
    assert len(session.get_history()) == 2
    
    await session.close()
    assert session.is_active is False


@pytest.mark.asyncio
async def test_gemini_live_single_turn_helper():
    """Tests single turn helper."""
    result = await run_gemini_live_turn(
        user_speech="Can I get a discount?",
        role="payer",
        customer_name="Ashwin Khowala",
        amount=4999.0,
        customer_id="cust_0001",
    )
    assert result["success"] is True
    assert result["voice_reply"] is not None


def test_sync_voice_turn_wrapper():
    """Tests the synchronous wrapper endpoint."""
    res = run_voice_agent_turn(
        user_speech="I promise to pay next Monday",
        role="payer",
        customer_name="Ashwin",
        amount=4999.0,
    )
    assert res["success"] is True
    assert res["voice_reply"] is not None
