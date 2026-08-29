"""
Telegram Recovery Channel
Dispatches instant revenue recovery alerts and Razorpay payment links via Telegram Bot API.
Broadcasts to active subscriber chats persisted in data/active_telegram_chats.json.
"""

import os
import json
import logging
import requests
from typing import Dict, Any, Optional, List

logger = logging.getLogger("orchestrator.channels.telegram")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CHATS_FILE = os.path.join(ROOT_DIR, "data", "active_telegram_chats.json")


def get_all_active_chat_ids(bot_token: str) -> List[str]:
    """
    Retrieves all active chat IDs from data/active_telegram_chats.json or discovers from getUpdates.
    """
    chat_ids = []
    
    # 1. Read from shared JSON file
    if os.path.exists(CHATS_FILE):
        try:
            with open(CHATS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for cid in data.keys():
                    if cid and cid not in chat_ids:
                        chat_ids.append(str(cid))
        except Exception as e:
            logger.debug(f"Could not read active chats file: {e}")

    # 2. Check environment variable
    env_cid = os.getenv("TELEGRAM_CHAT_ID")
    if env_cid and env_cid not in chat_ids:
        chat_ids.append(str(env_cid))

    # 3. Fallback to Telegram getUpdates
    if not chat_ids and bot_token:
        try:
            url = f"https://api.telegram.org/bot{bot_token}/getUpdates"
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                results = res.json().get("result", [])
                for item in results:
                    c = item.get("message", {}).get("chat", {}) or item.get("my_chat_member", {}).get("chat", {})
                    cid = c.get("id")
                    if cid and str(cid) not in chat_ids:
                        chat_ids.append(str(cid))
        except Exception:
            pass

    return chat_ids


def send_telegram_recovery(
    customer_name: str,
    amount: float,
    recovery_link: str,
    root_cause: str,
    recipient_chat_id: Optional[str] = None,
    discount_applied: float = 0.0,
) -> Dict[str, Any]:
    """
    Sends an instant revenue recovery notification with interactive payment button via Telegram Bot API.
    """
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    
    target_chat_ids = [recipient_chat_id] if recipient_chat_id else get_all_active_chat_ids(bot_token)

    # Format contextual recovery message with HTML formatting
    discount_text = f"\n<i>[Special Offer] Recovery Discount Applied: ₹{int(discount_applied):,} OFF</i>" if discount_applied > 0 else ""
    
    if root_cause == "mandate_auth_failed":
        message_text = (
            f"<b>[RBI MANDATE] Re-Authorization Required</b>\n\n"
            f"Hello <b>{customer_name}</b>, your recurring payment of <b>₹{amount:,.2f}</b> requires 1-click Additional Factor Authentication (AFA) under RBI regulations.\n"
            f"{discount_text}\n"
            f"<b>Authorize Mandate:</b> <a href='{recovery_link}'>{recovery_link}</a>"
        )
    elif root_cause == "checkout_abandoned":
        message_text = (
            f"<b>[CART RECOVERY] Complete Your Order</b>\n\n"
            f"Hi <b>{customer_name}</b>, we noticed you left items in your cart (<b>₹{amount:,.2f}</b>).\n"
            f"{discount_text}\n"
            f"<b>Complete Order Now:</b> <a href='{recovery_link}'>{recovery_link}</a>"
        )
    elif root_cause == "receivable_overdue":
        message_text = (
            f"<b>[INVOICE ALERT] High-Value Invoice Authorization</b>\n\n"
            f"Hello <b>{customer_name}</b>, high-value invoice outreach of <b>₹{amount:,.2f}</b> has been authorized.\n"
            f"<b>Settle Online:</b> <a href='{recovery_link}'>{recovery_link}</a>"
        )
    elif root_cause == "promise_to_pay":
        message_text = (
            f"<b>[PROMISE TO PAY] Commitment Scheduled</b>\n\n"
            f"Hello <b>{customer_name}</b>, your agreed payment of <b>₹{amount:,.2f}</b> has been scheduled.\n"
            f"Outreach paused. Settle anytime: <a href='{recovery_link}'>{recovery_link}</a>"
        )
    else:
        message_text = (
            f"<b>[RECOVERY] Payment Recovery Notice</b>\n\n"
            f"Hi <b>{customer_name}</b>, we noticed a temporary issue with your payment of <b>₹{amount:,.2f}</b>.\n"
            f"{discount_text}\n"
            f"<b>Complete Payment:</b> <a href='{recovery_link}'>{recovery_link}</a>"
        )

    dispatched_to = []

    if bot_token and target_chat_ids:
        for cid in target_chat_ids:
            try:
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                payload = {
                    "chat_id": cid,
                    "text": message_text,
                    "parse_mode": "HTML",
                    "disable_web_page_preview": False,
                    "reply_markup": {
                        "inline_keyboard": [
                            [{"text": f"Pay ₹{amount:,.2f} (Razorpay)", "url": recovery_link}],
                            [{"text": "Claim 5% Discount", "callback_data": "request_discount"}],
                            [{"text": "Promise to Pay Later", "callback_data": "promise_to_pay"}],
                        ]
                    },
                }
                res = requests.post(url, json=payload, timeout=10)
                if res.status_code == 200:
                    dispatched_to.append(cid)
                    logger.info(f"[TELEGRAM SENT] Dispatched to chat_id {cid}")
                else:
                    logger.warning(f"Telegram dispatch to {cid} returned {res.status_code}: {res.text}")
            except Exception as e:
                logger.error(f"Telegram dispatch to {cid} failed: {e}")

    return {
        "success": len(dispatched_to) > 0,
        "channel": "telegram",
        "target_chat_ids": target_chat_ids,
        "dispatched_to": dispatched_to,
        "message": f"Dispatched to {len(dispatched_to)} Telegram chat(s)." if dispatched_to else "Payload generated (send /start to @razorpaytestbot to link your Telegram).",
        "bot_handle": "@razorpaytestbot",
        "recovery_link": recovery_link,
        "amount": amount,
    }
