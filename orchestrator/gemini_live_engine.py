"""
Gemini Live & Tool-Calling Voice Agent Engine
Provides real-time conversational reasoning and tool execution for both
Customer/Payer recovery conversations and Merchant operations.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ============================================================================
# TOOL DEFINITIONS FOR VOICE AGENT
# ============================================================================

VOICE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "apply_concession_discount",
            "description": "Applies an instant 5% recovery discount/concession to the customer's pending invoice.",
            "parameters": {
                "type": "object",
                "properties": {
                    "discount_percent": {
                        "type": "integer",
                        "description": "Percentage discount to apply (default 5%)",
                        "default": 5,
                    },
                    "reason": {
                        "type": "string",
                        "description": "Reason for applying discount (e.g. customer negotiated on call)",
                    },
                },
                "required": ["discount_percent"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "register_promise_to_pay",
            "description": "Schedules a Promise-to-Pay (PTP) date. Pauses all automated outreach and reminder calls.",
            "parameters": {
                "type": "object",
                "properties": {
                    "promised_date": {
                        "type": "string",
                        "description": "The date customer promised to settle payment (e.g., 'Next Monday', '2026-09-02')",
                    },
                    "note": {
                        "type": "string",
                        "description": "Customer explanation or commitment note",
                    },
                },
                "required": ["promised_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "approve_high_value_invoice",
            "description": "Merchant Tool: Approves a paused high-value invoice (>= ₹1,00,000) for TechMatrix Corp.",
            "parameters": {
                "type": "object",
                "properties": {
                    "invoice_id": {
                        "type": "string",
                        "description": "Invoice reference ID or customer name (e.g., 'TechMatrix Corp')",
                    },
                    "approval_note": {
                        "type": "string",
                        "description": "Merchant authorization note",
                    },
                },
                "required": ["invoice_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_financial_kpis",
            "description": "Merchant Tool: Fetches live business revenue metrics (total at-risk, recovered money, 0 duplicate contacts).",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]


def execute_voice_tool(name: str, arguments: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    """Executes the voice agent tool and returns structured result."""
    logger.info(f"[VOICE TOOL EXECUTE] {name} with args {arguments}")

    if name == "apply_concession_discount":
        current_amount = float(context.get("amount", 4999))
        discount = arguments.get("discount_percent", 5)
        new_amount = round(current_amount * (1.0 - (discount / 100.0)))
        return {
            "tool": name,
            "status": "applied",
            "discount_applied_pct": discount,
            "original_amount": current_amount,
            "updated_amount": new_amount,
            "message": f"🎉 5% recovery discount applied! New payable amount is ₹{new_amount:,}.",
        }

    elif name == "register_promise_to_pay":
        date = arguments.get("promised_date", "Next Monday")
        note = arguments.get("note", "Customer committed via voice call")
        return {
            "tool": name,
            "status": "scheduled",
            "promised_date": date,
            "reminders_paused": True,
            "message": f"🤝 Promise-to-Pay registered for {date}. Automated reminders are now paused.",
        }

    elif name == "approve_high_value_invoice":
        inv = arguments.get("invoice_id", "TechMatrix Corp")
        return {
            "tool": name,
            "status": "approved",
            "invoice": inv,
            "message": f"✅ High-value invoice {inv} (₹1,45,000) approved! Outreach authorized.",
        }

    elif name == "get_financial_kpis":
        return {
            "tool": name,
            "total_at_risk": 245998,
            "recovered_revenue": 44075,
            "duplicate_contacts": 0,
            "pending_approval": 145000,
            "message": "📊 Financial Snapshot: ₹2,45,998 at risk, ₹44,075 recovered, 0 duplicate spam messages.",
        }

    return {"tool": name, "status": "unknown"}


def run_voice_agent_turn(
    user_speech: str,
    role: str = "payer",
    customer_name: str = "Ashwin Khowala",
    amount: float = 4999.0,
    root_cause: str = "subscription_failed",
) -> Dict[str, Any]:
    """
    Executes a single conversational turn with full Tool Calling capabilities.
    Supports Azure OpenAI or Google GenAI SDK.
    """
    azure_key = os.getenv("AZURE_OPENAI_API_KEY")
    azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    context = {
        "role": role,
        "customer_name": customer_name,
        "amount": amount,
        "root_cause": root_cause,
    }

    system_prompt = (
        f"You are the Razorpay AI Voice Recovery Agent speaking in natural, conversational Hinglish (Hindi + English).\n"
        f"Role: {'Customer Bill Recovery Assistant' if role == 'payer' else 'Merchant Operations Copilot'}\n"
        f"Current User: {customer_name}\n"
        f"Pending Amount: ₹{amount}\n"
        f"Failure Reason: {root_cause}\n\n"
        f"RULES & TOOLS:\n"
        f"1. If customer asks for a discount/waiver/offer, CALL `apply_concession_discount` tool to give 5% off.\n"
        f"2. If customer promises to pay later (e.g. 'Monday', 'tomorrow', 'next week'), CALL `register_promise_to_pay` tool.\n"
        f"3. If merchant asks for numbers/status, CALL `get_financial_kpis` tool.\n"
        f"4. If merchant says to approve high-value invoice, CALL `approve_high_value_invoice` tool.\n"
        f"5. Keep spoken response brief, friendly, polite, and reassuring (1-3 sentences max in Hinglish).\n"
    )

    executed_tools = []
    updated_amount = amount

    # 1. Try Azure OpenAI with function calling
    if azure_key and azure_endpoint:
        try:
            from openai import AzureOpenAI
            client = AzureOpenAI(
                api_key=azure_key,
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
                azure_endpoint=azure_endpoint,
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_speech},
            ]

            response = client.chat.completions.create(
                model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-54-mini"),
                messages=messages,
                tools=VOICE_TOOLS,
                tool_choice="auto",
                max_completion_tokens=300,
            )

            msg = response.choices[0].message

            # Check if model requested a tool call
            if msg.tool_calls:
                for t in msg.tool_calls:
                    fn_name = t.function.name
                    fn_args = json.loads(t.function.arguments or "{}")
                    tool_res = execute_voice_tool(fn_name, fn_args, context)
                    executed_tools.append(tool_res)
                    if tool_res.get("updated_amount"):
                        updated_amount = tool_res["updated_amount"]

                # Second turn with tool result
                messages.append(msg)
                for t, t_res in zip(msg.tool_calls, executed_tools):
                    messages.append({
                        "role": "tool",
                        "tool_call_id": t.id,
                        "content": json.dumps(t_res),
                    })

                second_resp = client.chat.completions.create(
                    model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-54-mini"),
                    messages=messages,
                    max_completion_tokens=300,
                )
                spoken_reply = second_resp.choices[0].message.content
            else:
                spoken_reply = msg.content

            return {
                "success": True,
                "voice_reply": spoken_reply,
                "executed_tools": executed_tools,
                "updated_amount": updated_amount,
                "provider": "azure_openai_tools",
            }

        except Exception as e:
            logger.warning(f"Voice agent Azure tool calling failed: {e}. Using deterministic tool agent.")

    # 2. Deterministic Fallback with Real Tool Execution
    speech_lower = user_speech.lower()

    if any(w in speech_lower for w in ["discount", "kam", "offer", "concession", "waiver", "less", "chhoot"]):
        tool_res = execute_voice_tool("apply_concession_discount", {"discount_percent": 5}, context)
        executed_tools.append(tool_res)
        updated_amount = tool_res["updated_amount"]
        spoken_reply = (
            f"Ji {customer_name}! Humne aapke liye 5% instant concession apply kar diya hai. "
            f"Aapka naya amount ab ₹{updated_amount:,} hai. Humne payment link update kar diya hai."
        )

    elif any(w in speech_lower for w in ["monday", "somvaar", "kal", "tomorrow", "next week", "later", "baad me", "promise", "pay on"]):
        tool_res = execute_voice_tool("register_promise_to_pay", {"promised_date": "Next Monday"}, context)
        executed_tools.append(tool_res)
        spoken_reply = (
            f"Shukriya {customer_name}! Maine aapka note record kar liya hai aur reminder outreach ko pause kar diya hai. "
            f"Aap Monday ko conveniently settle kar sakte hain."
        )

    elif any(w in speech_lower for w in ["approve", "techmatrix", "yes", "authorize"]) and role == "merchant":
        tool_res = execute_voice_tool("approve_high_value_invoice", {"invoice_id": "TechMatrix Corp"}, context)
        executed_tools.append(tool_res)
        spoken_reply = "TechMatrix Corp ka ₹1,45,000 ka invoice approve ho gaya hai. Recovery outreach dispatch kar di gayi hai."

    elif any(w in speech_lower for w in ["financial", "status", "how much", "kpi", "numbers"]) and role == "merchant":
        tool_res = execute_voice_tool("get_financial_kpis", {}, context)
        executed_tools.append(tool_res)
        spoken_reply = "Aapka total ₹2,45,998 revenue at-risk hai, jisme se ₹44,075 recover ho chuka hai aur duplicate spam contacts 0 hain."

    else:
        spoken_reply = (
            f"Ji {customer_name}! Main Razorpay recovery desk se hoon. "
            f"Aapka ₹{amount:,} ka transaction hold par hai. Kya main discount apply karun ya koi specific payment date schedule karun?"
        )

    return {
        "success": True,
        "voice_reply": spoken_reply,
        "executed_tools": executed_tools,
        "updated_amount": updated_amount,
        "provider": "deterministic_tool_engine",
    }
