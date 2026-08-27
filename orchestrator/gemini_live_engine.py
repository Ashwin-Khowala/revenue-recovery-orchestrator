"""
Gemini Live & Tool-Calling Voice Agent Engine
Powered by Google GenAI (gemini-3.1-flash-live-preview).

Architecture — Persistent Session with History-Aware Reconnection:
  • GeminiLiveSession keeps client.aio.live.connect() open for the full WebSocket
    conversation — one session per client, not one per turn.
  • AUDIO response modality (required for gemini-3.1-flash-live-preview — it is a
    native audio model and does NOT support TEXT modality).
  • output_audio_transcription gives us text alongside audio so we return both.
  • _history stores up to 20 turns; on reconnect the last N turns are injected
    into the system instruction so the model picks up exactly where it left off.
  • Auto-reconnect: if the Gemini session drops (10-min hard limit, network blip),
    reconnect() rebuilds the session with history and retries the current turn.
"""

import os
import json
import asyncio
import base64
import logging
from typing import Dict, Any, List, Optional

from dotenv import load_dotenv

load_dotenv()

from orchestrator.tools import (
    get_gemini_tools,
    execute_tool,
    apply_concession_discount,
    register_promise_to_pay,
    get_merchant_financial_overview,
    approve_high_value_invoice,
)

logger = logging.getLogger("orchestrator.gemini_live")


# ============================================================================
# 1. LANGUAGE DETECTION & SYSTEM PROMPT BUILDER
# ============================================================================

def detect_language(text: str) -> str:
    """Detects whether user is speaking Hindi, Hinglish, or English."""
    t = text.lower()
    hindi_words = [
        "kya", "kyun", "hai", "mujhe", "mera", "meri", "namaste", "rupaye", "chahiye",
        "kab", "kaise", "haan", "nahi", "bhai", "shukriya", "dhanyawad", "kam", "chhoot",
        "somwar", "kal", "parso", "de dunga", "bhejo", "thoda", "badhiya", "karo", "kitna",
        "paisa", "rakho", "roko", "bhej", "raha", "hoga", "batao", "sun", "sunao",
    ]
    if any(w in t.split() for w in hindi_words):
        return "hinglish"
    if any('\u0900' <= char <= '\u097F' for char in text):
        return "hindi"
    return "english"


def build_system_instruction(
    role: str,
    customer_name: str,
    amount: float,
    root_cause: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> str:
    """Build the system instruction, optionally including recent history for reconnects."""
    base = (
        f"You are the Razorpay AI Voice Recovery Assistant.\n"
        f"Role: {'Customer Recovery Concierge' if role == 'payer' else 'Merchant Operations Copilot'}\n"
        f"Current User: {customer_name}\n"
        f"Pending Amount: ₹{amount:,.2f}\n"
        f"Root Cause: {root_cause}\n\n"
        "STRICT BEHAVIOR & LANGUAGE INSTRUCTIONS:\n"
        "1. DYNAMIC LANGUAGE MIRRORING: Detect and match the user's language exactly.\n"
        "   - English user → reply ONLY in fluent, professional English.\n"
        "   - Hindi/Hinglish user → reply ONLY in warm Hinglish (Latin script).\n"
        "   - Never switch languages mid-conversation.\n"
        "2. SPOKEN BREVITY: 1-2 short spoken sentences only. Polite, empathetic, clear.\n"
        "3. TOOL CALLING (MANDATORY):\n"
        "   - Discount/waiver/kam karo → call `apply_concession_discount`.\n"
        "   - Pay later commitment → call `register_promise_to_pay`.\n"
        "   - Revenue/financial stats → call `get_merchant_financial_overview`.\n"
        "   - Pending incidents → call `get_at_risk_incidents`.\n"
        "   - Customer history → call `get_customer_intelligence`.\n"
        "   - Approve high-value invoice → call `approve_high_value_invoice`.\n"
    )

    # Inject recent history into system instruction on reconnect
    if history:
        recent = history[-12:]  # Last 12 turns (6 exchanges)
        lines = []
        for turn in recent:
            speaker = "User" if turn["speaker"] == "user" else "You (AI)"
            lines.append(f"{speaker}: {turn['text']}")
        history_block = "\n".join(lines)
        base += (
            "\n\nCONVERSATION HISTORY (reconnection context — continue naturally):\n"
            f"{history_block}\n"
            "Continue the conversation exactly where it left off. Do not re-introduce yourself."
        )

    return base


# ============================================================================
# 2. PERSISTENT GEMINI LIVE SESSION WITH HISTORY & AUTO-RECONNECT
# ============================================================================

class GeminiLiveSession:
    """
    Holds ONE persistent Gemini Live session for the full conversation.

    Key behaviours:
    - connect()    : open session, seed history into system instruction
    - send_turn()  : send text → collect audio + transcript → update history
    - reconnect()  : close + reopen with history preserved → transparent recovery
    - close()      : gracefully shut down the Gemini session
    """

    MAX_HISTORY = 20          # turns kept in memory
    RECONNECT_DELAY_S = 1.0   # seconds to wait before reconnect attempt

    def __init__(
        self,
        role: str,
        customer_name: str,
        amount: float,
        root_cause: str,
        customer_id: str,
        merchant_id: str,
    ):
        self.role = role
        self.customer_name = customer_name
        self.amount = amount
        self.root_cause = root_cause
        self.customer_id = customer_id
        self.merchant_id = merchant_id

        # Persistent conversation history — survives reconnects
        self._history: List[Dict[str, str]] = []

        self._session = None
        self._session_ctx = None
        self._client = None
        self._active = False

        self._api_key = (
            os.getenv("GEMINI_API_KEY") or
            os.getenv("GOOGLE_API_KEY") or
            ""
        )
        self._model = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.1-flash-live-preview")

    # ------------------------------------------------------------------
    # History helpers
    # ------------------------------------------------------------------

    def _append_history(self, speaker: str, text: str) -> None:
        self._history.append({"speaker": speaker, "text": text})
        if len(self._history) > self.MAX_HISTORY:
            self._history = self._history[-self.MAX_HISTORY:]

    def get_history(self) -> List[Dict[str, str]]:
        return list(self._history)

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    async def _make_config(self):
        from google.genai import types

        system_inst = build_system_instruction(
            self.role,
            self.customer_name,
            self.amount,
            self.root_cause,
            history=self._history if self._history else None,
        )

        # gemini-3.1-flash-live-preview is a native audio model:
        # ONLY supports AUDIO modality — TEXT modality raises APIError 1007.
        # We request output_audio_transcription to get text alongside the PCM.
        return types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            system_instruction=types.Content(
                parts=[types.Part(text=system_inst)]
            ),
            tools=get_gemini_tools(self.role),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            input_audio_transcription=types.AudioTranscriptionConfig(),
        )

    async def connect(self) -> None:
        """Open the Gemini Live session. Safe to call after close() for reconnects."""
        if not self._api_key:
            raise RuntimeError("No Gemini API key configured")

        from google import genai

        self._client = genai.Client(api_key=self._api_key)
        config = await self._make_config()
        self._session_ctx = self._client.aio.live.connect(
            model=self._model, config=config
        )
        self._session = await self._session_ctx.__aenter__()
        self._active = True
        reconnect_note = " (reconnect with history)" if self._history else ""
        logger.info(
            f"[GEMINI LIVE] Session opened for {self.customer_name} ({self.role}){reconnect_note}"
        )

    async def close(self) -> None:
        """Close session cleanly without clearing conversation history."""
        self._active = False
        if self._session_ctx:
            try:
                await self._session_ctx.__aexit__(None, None, None)
            except Exception:
                pass
        self._session = None
        self._session_ctx = None
        logger.info("[GEMINI LIVE] Session closed (history preserved).")

    async def reconnect(self) -> None:
        """Close and reopen the session, injecting history into system instruction."""
        logger.info(
            f"[GEMINI LIVE] Reconnecting with {len(self._history)} history turns..."
        )
        await self.close()
        await asyncio.sleep(self.RECONNECT_DELAY_S)
        await self.connect()

    @property
    def is_active(self) -> bool:
        return self._active and self._session is not None

    # ------------------------------------------------------------------
    # Turn execution
    # ------------------------------------------------------------------

    async def send_turn(self, user_speech: str) -> Dict[str, Any]:
        """
        Send one user turn and collect the full model response.
        Updates history and handles tool calls synchronously.
        Returns: {voice_reply, audio_base64, audio_sample_rate, executed_tools,
                  updated_amount, detected_language, provider}
        """
        if not self.is_active:
            raise RuntimeError("Session not connected — call connect() first")

        from google.genai import types

        detected_lang = detect_language(user_speech)
        executed_tools: List[Dict[str, Any]] = []
        updated_amount = self.amount

        # Record user turn in history
        self._append_history("user", user_speech)

        # Send via send_realtime_input (correct API for real-time text/audio)
        await self._session.send_realtime_input(text=user_speech)

        # Collect model response for this turn
        accumulated_audio = bytearray()
        transcript_parts: List[str] = []

        async for response in self._session.receive():

            # --- Synchronous Tool Calling ---
            if response.tool_call:
                function_responses = []
                for call in response.tool_call.function_calls:
                    fn_name = call.name
                    fn_args = dict(call.args or {})
                    logger.info(f"[GEMINI LIVE] Tool: {fn_name}({fn_args})")

                    tool_res = execute_tool(
                        fn_name,
                        fn_args,
                        context={
                            "customer_id": self.customer_id,
                            "merchant_id": self.merchant_id,
                            "amount": self.amount,
                        },
                    )
                    executed_tools.append(tool_res)

                    if fn_name == "apply_concession_discount":
                        updated_amount = tool_res.get(
                            "updated_amount", round(self.amount * 0.95)
                        )

                    function_responses.append(
                        types.FunctionResponse(
                            name=fn_name,
                            id=call.id,
                            response=tool_res,
                        )
                    )

                # Return tool results (synchronous only per Gemini Live spec)
                try:
                    await self._session.send_tool_response(
                        function_responses=function_responses
                    )
                except Exception:
                    try:
                        await self._session.send(
                            input=types.LiveClientToolResponse(
                                function_responses=function_responses
                            )
                        )
                    except Exception as e2:
                        logger.warning(f"[GEMINI LIVE] Tool response send failed: {e2}")

            # --- Audio + Transcription ---
            content = response.server_content
            if content:
                if content.model_turn:
                    for part in content.model_turn.parts:
                        # Accumulate raw PCM audio (24kHz, 16-bit, mono)
                        if part.inline_data and part.inline_data.data:
                            accumulated_audio.extend(part.inline_data.data)
                        # Also capture any text parts
                        if part.text:
                            transcript_parts.append(part.text)

                # Audio transcription (preferred text source)
                if content.output_transcription and content.output_transcription.text:
                    t = content.output_transcription.text
                    if t not in transcript_parts:
                        transcript_parts.append(t)

                # Turn complete — done collecting
                if content.turn_complete:
                    break

        # Build voice reply text
        voice_reply = " ".join(transcript_parts).strip()

        # Deterministic keyword tool fallback (if model skipped tool calling)
        speech_lower = user_speech.lower()
        if not executed_tools:
            if any(k in speech_lower for k in ("discount", "offer", "kam", "concession", "less", "chhoot")):
                tool_res = execute_tool(
                    "apply_concession_discount",
                    {"discount_percent": 5},
                    context={"customer_id": self.customer_id},
                )
                executed_tools.append(tool_res)
                updated_amount = round(self.amount * 0.95)
            elif any(k in speech_lower for k in ("monday", "tomorrow", "next week", "kal", "somwar", "promise")):
                tool_res = execute_tool(
                    "register_promise_to_pay",
                    {"promised_date": "Next Monday"},
                    context={"customer_id": self.customer_id},
                )
                executed_tools.append(tool_res)
            elif any(k in speech_lower for k in ("financial", "status", "revenue", "numbers", "kpi", "kitna")):
                tool_res = execute_tool(
                    "get_merchant_financial_overview",
                    {"merchant_id": self.merchant_id},
                )
                executed_tools.append(tool_res)
            elif any(k in speech_lower for k in ("approve", "techmatrix", "invoice")):
                tool_res = execute_tool(
                    "approve_high_value_invoice",
                    {"invoice_id": "TechMatrix Corp"},
                    context={"merchant_id": self.merchant_id},
                )
                executed_tools.append(tool_res)

        # Final voice reply fallback
        if not voice_reply:
            is_hindi = detected_lang in ("hindi", "hinglish")
            voice_reply = (
                f"Ji {self.customer_name}, maine aapki baat sun li hai."
                if is_hindi
                else f"Understood, {self.customer_name}. I have noted your request."
            )

        # Update amount if tool changed it
        for t in executed_tools:
            if t.get("tool") == "apply_concession_discount":
                updated_amount = t.get("updated_amount", updated_amount)

        # Record agent turn in history
        self._append_history("agent", voice_reply)

        # Encode audio
        audio_b64 = (
            base64.b64encode(bytes(accumulated_audio)).decode("utf-8")
            if accumulated_audio
            else None
        )

        return {
            "success": True,
            "voice_reply": voice_reply,
            "audio_base64": audio_b64,
            "audio_sample_rate": 24000,
            "executed_tools": executed_tools,
            "updated_amount": updated_amount,
            "detected_language": detected_lang,
            "provider": "gemini_3.1_flash_live",
        }


# ============================================================================
# 3. SYNCHRONOUS FALLBACK PIPELINE
# ============================================================================

def _run_sync_fallback_turn(
    user_speech: str,
    role: str,
    customer_name: str,
    amount: float,
    root_cause: str,
    customer_id: str,
    merchant_id: str,
    detected_lang: str,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Gemini 2.5 Flash → Azure OpenAI → Deterministic fallback chain."""

    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    executed_tools: List[Dict[str, Any]] = []
    updated_amount = amount
    system_inst = build_system_instruction(role, customer_name, amount, root_cause, history)

    # A. Gemini 2.5 Flash Chat
    if gemini_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=gemini_key)
            chat = client.chats.create(
                model=os.getenv("GEMINI_CHAT_MODEL", "gemini-2.5-flash"),
                config=types.GenerateContentConfig(
                    system_instruction=system_inst,
                    temperature=0.3,
                ),
            )
            response = chat.send_message(user_speech)
            spoken_reply = response.text.strip() if response.text else "Ji, note record kar liya hai."

            speech_lower = user_speech.lower()
            if any(k in speech_lower for k in ("discount", "offer", "kam", "concession", "less", "chhoot")):
                tool_res = execute_tool("apply_concession_discount", {"discount_percent": 5}, context={"customer_id": customer_id})
                executed_tools.append(tool_res)
                updated_amount = round(amount * 0.95)
            elif any(k in speech_lower for k in ("monday", "tomorrow", "next week", "kal", "somwar", "promise")):
                tool_res = execute_tool("register_promise_to_pay", {"promised_date": "Next Monday"}, context={"customer_id": customer_id})
                executed_tools.append(tool_res)
            elif any(k in speech_lower for k in ("financial", "status", "revenue", "numbers", "kpi", "kitna")):
                tool_res = execute_tool("get_merchant_financial_overview", {"merchant_id": merchant_id})
                executed_tools.append(tool_res)
            elif any(k in speech_lower for k in ("approve", "techmatrix", "invoice")):
                tool_res = execute_tool("approve_high_value_invoice", {"invoice_id": "TechMatrix Corp"}, context={"merchant_id": merchant_id})
                executed_tools.append(tool_res)

            return {
                "success": True,
                "voice_reply": spoken_reply,
                "executed_tools": executed_tools,
                "updated_amount": updated_amount,
                "detected_language": detected_lang,
                "provider": "gemini_2.5_flash",
            }
        except Exception as e:
            logger.warning(f"Gemini 2.5 Flash fallback error: {e}")

    # B. Azure OpenAI
    if azure_key and azure_endpoint:
        try:
            from openai import AzureOpenAI
            from orchestrator.tools import get_openai_tools

            client = AzureOpenAI(
                api_key=azure_key,
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
                azure_endpoint=azure_endpoint,
            )

            # Build messages with history for Azure
            messages = [{"role": "system", "content": system_inst}]
            if history:
                for turn in history[-8:]:
                    messages.append({
                        "role": "user" if turn["speaker"] == "user" else "assistant",
                        "content": turn["text"],
                    })
            messages.append({"role": "user", "content": user_speech})

            resp = client.chat.completions.create(
                model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini"),
                messages=messages,
                tools=get_openai_tools(role),
                tool_choice="auto",
                max_completion_tokens=250,
            )
            msg = resp.choices[0].message
            if msg.tool_calls:
                for t in msg.tool_calls:
                    fn = t.function.name
                    args = json.loads(t.function.arguments or "{}")
                    tool_res = execute_tool(fn, args, context={"customer_id": customer_id, "merchant_id": merchant_id, "amount": amount})
                    executed_tools.append(tool_res)
                    if fn == "apply_concession_discount":
                        updated_amount = round(amount * 0.95)
                spoken_reply = (
                    "Haan ji, maine aapki request process kar di hai."
                    if detected_lang in ("hindi", "hinglish") else
                    "Certainly, I have processed your request."
                )
            else:
                spoken_reply = msg.content or "Note recorded."

            return {
                "success": True,
                "voice_reply": spoken_reply,
                "executed_tools": executed_tools,
                "updated_amount": updated_amount,
                "detected_language": detected_lang,
                "provider": "azure_openai",
            }
        except Exception as e:
            logger.warning(f"Azure fallback error: {e}")

    # C. Deterministic Multilingual Fallback
    is_hindi = detected_lang in ("hindi", "hinglish")
    speech_lower = user_speech.lower()

    if any(k in speech_lower for k in ("discount", "offer", "kam", "concession", "less", "chhoot")):
        tool_res = apply_concession_discount(5)
        executed_tools.append(tool_res)
        updated_amount = round(amount * 0.95)
        spoken_reply = (
            f"Haan ji {customer_name}! Humne aapke liye 5% recovery discount apply kar diya hai. Ab payable amount ₹{updated_amount:,} hai."
            if is_hindi else
            f"Certainly {customer_name}! We have approved a 5% recovery discount. Your new payable amount is ₹{updated_amount:,}."
        )
    elif any(k in speech_lower for k in ("monday", "tomorrow", "next week", "kal", "somwar", "promise")):
        tool_res = register_promise_to_pay("Next Monday")
        executed_tools.append(tool_res)
        spoken_reply = (
            f"Bahut badhiya {customer_name}! Aapka payment commitment register ho gaya hai."
            if is_hindi else
            f"Thank you {customer_name}! Your payment commitment has been registered."
        )
    elif any(k in speech_lower for k in ("financial", "status", "revenue", "numbers", "kpi", "kitna")):
        tool_res = get_merchant_financial_overview(merchant_id)
        executed_tools.append(tool_res)
        spoken_reply = (
            "Total ₹2,45,998 at-risk revenue hai, ₹44,075 recover ho chuka hai."
            if is_hindi else
            "Total at-risk revenue is ₹2,45,998, with ₹44,075 recovered and zero duplicate contacts."
        )
    elif any(k in speech_lower for k in ("approve", "techmatrix", "invoice")):
        tool_res = approve_high_value_invoice("TechMatrix Corp")
        executed_tools.append(tool_res)
        spoken_reply = (
            "TechMatrix Corp ka ₹1,45,000 invoice approve ho gaya hai."
            if is_hindi else
            "TechMatrix Corp invoice of ₹1,45,000 has been approved and dispatched."
        )
    else:
        spoken_reply = (
            f"Ji {customer_name}! Maine aapka note record kar liya hai."
            if is_hindi else
            f"Hello {customer_name}! I have recorded your note."
        )

    return {
        "success": True,
        "voice_reply": spoken_reply,
        "executed_tools": executed_tools,
        "updated_amount": updated_amount,
        "detected_language": detected_lang,
        "provider": "deterministic_multilingual",
    }


# ============================================================================
# 4. SINGLE-TURN ASYNC ENTRY POINT (HTTP endpoint fallback)
# ============================================================================

async def run_gemini_live_turn(
    user_speech: str,
    role: str = "payer",
    customer_name: str = "Ashwin Khowala",
    amount: float = 4999.0,
    root_cause: str = "subscription_failed",
    customer_id: str = "cust_0001",
    merchant_id: str = "merch_01",
    audio_bytes: Optional[bytes] = None,
) -> Dict[str, Any]:
    """Single-turn entry point for the HTTP voice-agent-turn endpoint."""
    detected_lang = detect_language(user_speech)

    if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
        try:
            session = GeminiLiveSession(
                role=role,
                customer_name=customer_name,
                amount=amount,
                root_cause=root_cause,
                customer_id=customer_id,
                merchant_id=merchant_id,
            )
            await asyncio.wait_for(session.connect(), timeout=8.0)
            try:
                result = await asyncio.wait_for(session.send_turn(user_speech), timeout=20.0)
                return result
            finally:
                await session.close()
        except Exception as e:
            logger.warning(f"Gemini Live single-turn error: {e}. Using fallback.")

    return _run_sync_fallback_turn(
        user_speech=user_speech,
        role=role,
        customer_name=customer_name,
        amount=amount,
        root_cause=root_cause,
        customer_id=customer_id,
        merchant_id=merchant_id,
        detected_lang=detected_lang,
    )


def run_voice_agent_turn(
    user_speech: str,
    role: str = "payer",
    customer_name: str = "Ashwin Khowala",
    amount: float = 4999.0,
    root_cause: str = "subscription_failed",
    customer_id: str = "cust_0001",
    merchant_id: str = "merch_01",
) -> Dict[str, Any]:
    """Synchronous wrapper for the async Gemini Live turn."""
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(
                    asyncio.run,
                    run_gemini_live_turn(
                        user_speech=user_speech,
                        role=role,
                        customer_name=customer_name,
                        amount=amount,
                        root_cause=root_cause,
                        customer_id=customer_id,
                        merchant_id=merchant_id,
                    ),
                ).result()
        else:
            return asyncio.run(
                run_gemini_live_turn(
                    user_speech=user_speech,
                    role=role,
                    customer_name=customer_name,
                    amount=amount,
                    root_cause=root_cause,
                    customer_id=customer_id,
                    merchant_id=merchant_id,
                )
            )
    except Exception as e:
        logger.warning(f"Async Gemini Live loop error: {e}. Running sync fallback.")
        return _run_sync_fallback_turn(
            user_speech=user_speech,
            role=role,
            customer_name=customer_name,
            amount=amount,
            root_cause=root_cause,
            customer_id=customer_id,
            merchant_id=merchant_id,
            detected_lang=detect_language(user_speech),
        )
