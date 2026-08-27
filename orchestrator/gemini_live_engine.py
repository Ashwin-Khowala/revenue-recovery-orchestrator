"""
Gemini Live & Tool-Calling Voice Agent Engine
Powered by Google GenAI (gemini-3.1-flash-live-preview).

Architecture — Persistent Session Model:
- A single Gemini Live WebSocket session is kept open for the full conversation.
- Text is sent via send_realtime_input(text=...) per the skill spec.
- The receive() loop runs concurrently and streams responses back.
- Tool calls are handled synchronously and tool responses are sent back inline.
- On session expiry (~10 min), the session is transparently reconnected.

Per the Gemini Live API skill:
  - Use send_realtime_input for ALL real-time input (text + audio).
  - Only AUDIO or TEXT response_modalities per session, not both.
  - We use TEXT modality so we get transcripts without raw PCM overhead.
  - Function calling is synchronous only.
"""

import os
import json
import asyncio
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
        "paisa", "rakho", "roko", "bhej", "raha", "hoga", "batao", "sun", "sunao"
    ]
    if any(w in t.split() for w in hindi_words):
        return "hinglish"
    if any('\u0900' <= char <= '\u097F' for char in text):
        return "hindi"
    return "english"


def build_system_instruction(role: str, customer_name: str, amount: float, root_cause: str) -> str:
    return (
        f"You are the Razorpay AI Voice Recovery Assistant.\n"
        f"Role: {'Customer Recovery Concierge' if role == 'payer' else 'Merchant Operations Copilot'}\n"
        f"Current User: {customer_name}\n"
        f"Pending Amount: ₹{amount:,.2f}\n"
        f"Root Cause: {root_cause}\n\n"
        "STRICT BEHAVIOR & LANGUAGE INSTRUCTIONS:\n"
        "1. DYNAMIC LANGUAGE MIRRORING: You MUST detect and match the user's language.\n"
        "   - If the user speaks English -> Reply ONLY in fluent, professional English.\n"
        "   - If the user speaks Hindi or Hinglish -> Reply ONLY in warm, conversational Hinglish (Hindi written in Latin/Roman script).\n"
        "   - NEVER reply in English to a Hindi/Hinglish message. NEVER reply in Hindi script to an English message.\n"
        "2. SPOKEN BREVITY: Spoken responses must be 1 to 2 short sentences. Polite, empathetic, and clear.\n"
        "3. TOOL CALLING (MANDATORY):\n"
        "   - When customer asks for a discount/waiver/kam karo -> Call `apply_concession_discount`.\n"
        "   - When customer commits to pay later (e.g. 'Monday', 'tomorrow', 'next week', 'kal', 'somwar') -> Call `register_promise_to_pay`.\n"
        "   - When merchant asks for revenue/stats/financials -> Call `get_merchant_financial_overview`.\n"
        "   - When merchant asks about pending incidents/failures -> Call `get_at_risk_incidents`.\n"
        "   - When merchant asks about a customer history -> Call `get_customer_intelligence`.\n"
        "   - When merchant authorizes/approves high value invoice -> Call `approve_high_value_invoice`.\n"
    )


# ============================================================================
# 2. PERSISTENT GEMINI LIVE SESSION
# ============================================================================

class GeminiLiveSession:
    """
    Holds a persistent Gemini Live session open for the entire WebSocket conversation.
    Reconnects transparently if the session expires (~10 min limit).
    """

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

        self._session = None
        self._session_ctx = None
        self._client = None
        self._lock = asyncio.Lock()
        self._active = False

        gemini_key = (
            os.getenv("GEMINI_API_KEY") or
            os.getenv("GOOGLE_API_KEY") or
            "AIzaSyDYfiLQy-hArB7jwU4zWCEY8FyL5AgNqss"
        )
        self._api_key = gemini_key
        self._model = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.1-flash-live-preview")

    async def _build_config(self):
        from google.genai import types
        system_inst = build_system_instruction(
            self.role, self.customer_name, self.amount, self.root_cause
        )
        return types.LiveConnectConfig(
            # TEXT modality: clean text responses, no raw PCM decoding overhead
            response_modalities=[types.Modality.TEXT],
            system_instruction=types.Content(
                parts=[types.Part(text=system_inst)]
            ),
            tools=get_gemini_tools(self.role),
        )

    async def connect(self):
        """Open the persistent Gemini Live session."""
        from google import genai
        self._client = genai.Client(api_key=self._api_key)
        config = await self._build_config()
        self._session_ctx = self._client.aio.live.connect(
            model=self._model, config=config
        )
        self._session = await self._session_ctx.__aenter__()
        self._active = True
        logger.info(f"[GEMINI LIVE] Persistent session opened for {self.customer_name} ({self.role})")

    async def close(self):
        """Close the Gemini Live session cleanly."""
        self._active = False
        if self._session_ctx:
            try:
                await self._session_ctx.__aexit__(None, None, None)
            except Exception:
                pass
        self._session = None
        self._session_ctx = None
        logger.info("[GEMINI LIVE] Session closed.")

    async def send_turn(self, user_speech: str) -> Dict[str, Any]:
        """
        Send a user message and collect the full response for this turn.
        Handles tool calls synchronously within the same session.
        Returns a dict with voice_reply, executed_tools, updated_amount.
        """
        if not self._active or self._session is None:
            raise RuntimeError("Session not connected")

        from google.genai import types

        detected_lang = detect_language(user_speech)
        executed_tools: List[Dict[str, Any]] = []
        updated_amount = self.amount

        # Send via send_realtime_input (correct API per skill spec)
        await self._session.send_realtime_input(text=user_speech)

        # Collect response for this turn
        transcript_parts: List[str] = []

        async for response in self._session.receive():
            # --- Tool Calling (synchronous) ---
            if response.tool_call:
                function_responses = []
                for call in response.tool_call.function_calls:
                    fn_name = call.name
                    fn_args = dict(call.args or {})
                    logger.info(f"[GEMINI LIVE] Tool call: {fn_name}({fn_args})")

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
                        updated_amount = tool_res.get("updated_amount", round(self.amount * 0.95))

                    function_responses.append(
                        types.FunctionResponse(
                            name=fn_name,
                            id=call.id,
                            response=tool_res,
                        )
                    )

                # Send tool response back to Gemini (synchronous function calling)
                try:
                    await self._session.send_tool_response(
                        function_responses=function_responses
                    )
                except Exception as e:
                    logger.warning(f"[GEMINI LIVE] send_tool_response error: {e}")
                    try:
                        tool_resp = types.LiveClientToolResponse(
                            function_responses=function_responses
                        )
                        await self._session.send(input=tool_resp)
                    except Exception as e2:
                        logger.warning(f"[GEMINI LIVE] Fallback tool send error: {e2}")

            # --- Server Content (Text + Transcription) ---
            content = response.server_content
            if content:
                # TEXT modality response parts
                if content.model_turn:
                    for part in content.model_turn.parts:
                        if part.text:
                            transcript_parts.append(part.text)

                # Output transcription (for AUDIO modality — safe to also check)
                if content.output_transcription and content.output_transcription.text:
                    if content.output_transcription.text not in transcript_parts:
                        transcript_parts.append(content.output_transcription.text)

                # Turn complete signal — this turn is done
                if content.turn_complete:
                    break

        voice_reply = "".join(transcript_parts).strip()

        # Deterministic keyword fallback if LLM didn't call tool
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

        if not voice_reply:
            is_hindi = detected_lang in ("hindi", "hinglish")
            voice_reply = (
                f"Ji {self.customer_name}! Maine aapki baat sun li hai."
                if is_hindi
                else f"Understood, {self.customer_name}. I have noted your request."
            )

        return {
            "success": True,
            "voice_reply": voice_reply,
            "executed_tools": executed_tools,
            "updated_amount": updated_amount,
            "detected_language": detected_lang,
            "provider": "gemini_3.1_flash_live",
        }


# ============================================================================
# 3. SYNCHRONOUS FALLBACK PIPELINE (used when Gemini Live is unavailable)
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
) -> Dict[str, Any]:
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    executed_tools: List[Dict[str, Any]] = []
    updated_amount = amount
    system_inst = build_system_instruction(role, customer_name, amount, root_cause)

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
            logger.warning(f"Gemini chat fallback error: {e}")

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
            messages = [
                {"role": "system", "content": system_inst},
                {"role": "user", "content": user_speech},
            ]
            resp = client.chat.completions.create(
                model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini"),
                messages=messages,
                tools=get_openai_tools(role),
                tool_choice="auto",
                max_completion_tokens=250,
            )
            msg = resp.choices[0].message
            if msg.tool_calls:
                import json as _json
                for t in msg.tool_calls:
                    fn = t.function.name
                    args = _json.loads(t.function.arguments or "{}")
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
            f"Bahut badhiya {customer_name}! Aapka payment commitment register ho gaya hai aur reminders pause ho gaye hain."
            if is_hindi else
            f"Thank you {customer_name}! Your payment commitment has been registered. All automated reminders are now paused."
        )
    elif any(k in speech_lower for k in ("financial", "status", "revenue", "numbers", "kpi", "kitna")):
        tool_res = get_merchant_financial_overview(merchant_id)
        executed_tools.append(tool_res)
        spoken_reply = (
            "Admin, total ₹2,45,998 at-risk revenue hai, ₹44,075 recover ho chuka hai aur strictly 0 duplicate spam messages hain."
            if is_hindi else
            "Admin, total at-risk revenue is ₹2,45,998, with ₹44,075 recovered and strictly zero duplicate contacts."
        )
    elif any(k in speech_lower for k in ("approve", "techmatrix", "invoice")):
        tool_res = approve_high_value_invoice("TechMatrix Corp")
        executed_tools.append(tool_res)
        spoken_reply = (
            "TechMatrix Corp ka ₹1,45,000 invoice outreach approve ho gaya hai aur notification safely dispatch ho gayi hai."
            if is_hindi else
            "TechMatrix Corp invoice outreach of ₹1,45,000 has been approved and dispatched safely."
        )
    else:
        spoken_reply = (
            f"Ji {customer_name}! Maine aapka note record kar liya hai aur schedule update kar diya hai."
            if is_hindi else
            f"Hello {customer_name}! I have recorded your note and updated your schedule."
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
# 4. SINGLE-TURN ASYNC ENTRY POINT (used by HTTP fallback endpoint)
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
    """
    Single-turn async entry point for the HTTP voice-agent-turn endpoint.
    Opens a fresh Gemini Live session, sends one turn, closes it.
    For persistent sessions (WebSocket), use GeminiLiveSession directly.
    """
    gemini_key = (
        os.getenv("GEMINI_API_KEY") or
        os.getenv("GOOGLE_API_KEY") or
        "AIzaSyDYfiLQy-hArB7jwU4zWCEY8FyL5AgNqss"
    )
    detected_lang = detect_language(user_speech)

    if gemini_key:
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
    """
    Synchronous entry point that runs the async Gemini Live turn in an event loop.
    """
    try:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                result = pool.submit(
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
                return result
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
        logger.warning(f"Error executing async Gemini Live loop: {e}. Running fallback.")
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
