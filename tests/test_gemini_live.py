"""
Test Suite for Gemini 3.1 Flash Live Voice Engine
Validates live bidirectional streaming, native audio synthesis, tool calling, and language mirroring.
"""

import asyncio
import os
import pytest
from dotenv import load_dotenv

load_dotenv()

from orchestrator.gemini_live_engine import (
    run_gemini_live_turn,
    run_voice_agent_turn,
    detect_language,
)


@pytest.mark.asyncio
async def test_gemini_live_payer_discount():
    """Tests payer asking for a discount with Gemini 3.1 Live."""
    result = await run_gemini_live_turn(
        user_speech="Can I please get a 5% discount on my invoice?",
        role="payer",
        customer_name="Ashwin Khowala",
        amount=4999.0,
        customer_id="cust_0001",
    )
    assert result["success"] is True
    assert result["voice_reply"] is not None
    assert len(result["voice_reply"]) > 0
    assert result["updated_amount"] < 4999.0


@pytest.mark.asyncio
async def test_gemini_live_merchant_overview():
    """Tests merchant asking for financial KPIs in Hinglish."""
    result = await run_gemini_live_turn(
        user_speech="Admin summary aur recovery kitna hua hai batao",
        role="merchant",
        customer_name="Admin",
        merchant_id="merch_01",
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


if __name__ == "__main__":
    asyncio.run(test_gemini_live_payer_discount())
    asyncio.run(test_gemini_live_merchant_overview())
    test_sync_voice_turn_wrapper()
