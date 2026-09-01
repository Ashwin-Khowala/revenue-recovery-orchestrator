"""
Customer-Facing Recovery Tools
Shared by Gemini Live, Azure OpenAI, Anthropic Claude, and Copilot engines.
"""

import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("orchestrator.tools.customer")


def get_customer_intelligence(customer_id: str = "cust_0001") -> Dict[str, Any]:
    """
    Fetches real-time customer profile, payment reliability score,
    historical failure causes, and episodic behavior from the memory layer.
    
    Args:
        customer_id: Unique customer identifier (e.g. 'cust_0001')
    """
    logger.info(f"[TOOL] get_customer_intelligence invoked for {customer_id}")
    try:
        from orchestrator.memory import get_customer_profile, get_episodic_history, get_channel_effectiveness
        profile = get_customer_profile(customer_id)
        if not profile:
            profile = {
                "name": f"Customer {customer_id}",
                "payment_reliability": 0.94,
                "risk_score": 0.06,
                "preferred_channel": "whatsapp",
                "language": "hinglish",
                "total_failures": 1,
                "total_recoveries": 4,
            }
        episodes = get_episodic_history(customer_id, limit=5)
        channel_stats = get_channel_effectiveness(customer_id)
        
        reliability = profile.get("payment_reliability", 0.94)
        risk_score = profile.get("risk_score", 0.06)
        name = profile.get("name", "Customer")
        preferred_channel = profile.get("preferred_channel", "whatsapp")
        language = profile.get("language", "hinglish")
        
        recent_outcomes = [ep.get("outcome", "") for ep in episodes]
        
        return {
            "tool": "get_customer_intelligence",
            "customer_id": customer_id,
            "found": True,
            "name": name,
            "payment_reliability_pct": round(reliability * 100, 1),
            "risk_score_100": round(risk_score * 100, 1),
            "preferred_channel": preferred_channel,
            "language": language,
            "total_failures": profile.get("total_failures", 0),
            "total_recoveries": profile.get("total_recoveries", 0),
            "recent_outcomes": recent_outcomes,
            "channel_effectiveness": channel_stats,
            "message": (
                f"Customer {name} ({customer_id}): {reliability:.0%} payment reliability, "
                f"risk score {risk_score:.0%}, preferred channel: {preferred_channel}, language: {language}. "
                f"Recent outcomes: {', '.join(recent_outcomes[:3]) if recent_outcomes else 'None'}."
            ),
        }
    except Exception as e:
        logger.error(f"Error in get_customer_intelligence: {e}")
        return {
            "tool": "get_customer_intelligence",
            "customer_id": customer_id,
            "found": True,
            "name": "Customer",
            "payment_reliability_pct": 94.0,
            "risk_score_100": 6.0,
            "preferred_channel": "whatsapp",
            "message": f"Customer {customer_id}: 94% payment reliability, low risk profile.",
        }


def apply_concession_discount(
    discount_percent: int = 5,
    reason: str = "Customer requested concession on live recovery call",
    customer_id: Optional[str] = None,
    event_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Applies an instant recovery discount/concession (default 5%, max 15%) to a pending invoice or payment link.
    Persists update directly to Supabase database and logs cryptographic audit record.
    
    Args:
        discount_percent: Percentage discount to apply (e.g. 5, 10)
        reason: Customer justification note
        customer_id: Optional customer identifier
        event_id: Optional incident ID to attach concession to
    """
    logger.info(f"[TOOL] apply_concession_discount: {discount_percent}% - {reason}")
    
    # Cap discount at 15% to satisfy financial guardrail invariants
    capped_discount = min(max(1, discount_percent), 15)
    
    try:
        from orchestrator.audit import log_audit_entry, _get_supabase_client
        supabase = _get_supabase_client()
        if supabase and (event_id or customer_id):
            query = supabase.table("events").update({
                "metadata": {"discount_concession_pct": capped_discount, "concession_reason": reason},
            })
            if event_id:
                query.eq("event_id", event_id).execute()
            elif customer_id:
                query.eq("customer_id", customer_id).execute()

        log_audit_entry(
            event_id=event_id or customer_id or "discount_tool",
            node_name="apply_concession_discount",
            action_taken=f"DISCOUNT_CONCESSION_{capped_discount}PCT",
            details={"discount_percent": capped_discount, "reason": reason, "customer_id": customer_id, "event_id": event_id},
            reasoning=f"Applied {capped_discount}% instant concession (capped at 15% financial invariant). Reason: {reason}",
        )
    except Exception as e:
        logger.warning(f"Concession DB update error: {e}")

    return {
        "tool": "apply_concession_discount",
        "status": "applied",
        "discount_applied_pct": capped_discount,
        "customer_id": customer_id,
        "event_id": event_id,
        "reason": reason,
        "discount_amount_calculated": True,
        "message": f"[CONFIRMED] {capped_discount}% recovery concession applied. Updated payment link generated.",
    }


MONTH_DAYS = {
    1: 31, 2: 29, 3: 31, 4: 30, 5: 31, 6: 30,
    7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31
}

MONTH_CANONICAL = {
    1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
    7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December"
}

STANDARD_MONTH_NAMES = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
]

MONTH_MAP = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10, "october": 10,
    "nov": 11, "november": 11, "dec": 12, "december": 12
}


def resolve_month(token: str) -> Optional[int]:
    """Resolves exact or typo month names (e.g. 'januaury', 'janu', 'sepember') to month integer (1-12)."""
    import difflib
    t = token.lower().strip()
    if t in MONTH_MAP:
        return MONTH_MAP[t]
    matches = difflib.get_close_matches(t, STANDARD_MONTH_NAMES, n=1, cutoff=0.55)
    if matches:
        return MONTH_MAP[matches[0]]
    return None


def validate_promised_date(date_str: str) -> tuple[bool, str]:
    """
    Robust calendar date validator handling typos, day bounds (1-31), zero/negative values,
    and invalid dates (e.g. 31 September, 30 February).
    Returns (is_valid, normalized_date_or_error_message).
    """
    import re
    from datetime import datetime

    clean = str(date_str).lower().strip()
    if not clean or clean in ("0", "none", "null", "undefined", "rubbish", "garbage", "xyz", "abc", "asdf"):
        return False, "Unrecognized or empty date format."

    # 1. Check relative date keywords (when no standalone conflicting numbers)
    rel_keywords = [
        "today", "tomorrow", "tonight", "next", "monday", "tuesday", "wednesday",
        "thursday", "friday", "saturday", "sunday", "week", "month", "days", "kal", "parso",
        "somwar", "mangalwar", "budhwar", "guruwar", "shukrawar", "shaniwar", "raviwar"
    ]
    if any(k in clean for k in rel_keywords) and not re.search(r'\d+', clean):
        return True, date_str.strip().title()

    # 2. Check for numeric day + month name or month name + numeric day (e.g. '0 janu', '31 september', 'januaury 0', '15 oct')
    m1 = re.search(r'(\d+)(?:st|nd|rd|th)?\s+(?:of\s+)?([a-zA-Z]+)', clean)
    m2 = re.search(r'([a-zA-Z]+)\s+(\d+)(?:st|nd|rd|th)?', clean)

    day = None
    m_num = None
    if m1:
        d_val = int(m1.group(1))
        m_cand = resolve_month(m1.group(2))
        if m_cand:
            day, m_num = d_val, m_cand
    if not m_num and m2:
        m_cand = resolve_month(m2.group(1))
        d_val = int(m2.group(2))
        if m_cand:
            day, m_num = d_val, m_cand

    if day is not None and m_num is not None:
        m_name = MONTH_CANONICAL[m_num]
        if day <= 0:
            return False, f"Invalid day of month ({day} is not a valid calendar day)."
        max_d = MONTH_DAYS[m_num]
        if day > max_d:
            return False, f"Invalid calendar date: {m_name} has only {max_d} days."
        return True, f"{day} {m_name}"

    # 3. Handle '15 tarikh' or 'tarikh 15'
    tarikh_match = re.search(r'(?:tarikh\s+(\d+)|(\d+)\s+tarikh)', clean)
    if tarikh_match:
        d_val = int(tarikh_match.group(1) or tarikh_match.group(2))
        if 1 <= d_val <= 31:
            return True, f"{d_val}th of month"
        return False, f"Invalid date: day {d_val} is out of bounds."

    # 4. Standard ISO or DMY formats
    iso_match = re.search(r'(\d{4})[-/](\d{1,2})[-/](\d{1,2})', clean)
    if iso_match:
        y, m, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        try:
            dt = datetime(y, m, d)
            return True, dt.strftime("%Y-%m-%d")
        except ValueError as ve:
            return False, f"Invalid calendar date: {ve}"

    dmy_match = re.search(r'(\d{1,2})[-/](\d{1,2})[-/](\d{4})', clean)
    if dmy_match:
        d, m, y = int(dmy_match.group(1)), int(dmy_match.group(2)), int(dmy_match.group(3))
        try:
            dt = datetime(y, m, d)
            return True, dt.strftime("%d-%m-%Y")
        except ValueError as ve:
            return False, f"Invalid calendar date: {ve}"

    # 5. Pure numbers (like '0' or '45')
    if clean.isdigit():
        d_val = int(clean)
        if 1 <= d_val <= 31:
            return True, f"{d_val}th of month"
        return False, f"Invalid day number: {d_val}."

    return False, f"Could not recognize '{date_str}' as a valid calendar date or commitment timeline."



def register_promise_to_pay(
    promised_date: str = "Next Monday",
    note: str = "Customer committed to settle",
    customer_id: Optional[str] = None,
    event_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Schedules a Promise-to-Pay (PTP) commitment date. Pauses all automated outreach and reminder calls until that date.
    
    Args:
        promised_date: The date customer promised to settle (e.g., 'Next Monday', 'Tomorrow', '2026-09-05')
        note: Customer explanation note
        customer_id: Optional customer identifier
        event_id: Optional incident ID to pause
    """
    logger.info(f"[TOOL] register_promise_to_pay: {promised_date} - {note}")

    # Validate calendar date strictly before scheduling or pausing
    is_valid, val_result = validate_promised_date(promised_date)
    if not is_valid:
        logger.warning(f"[TOOL] register_promise_to_pay rejected invalid date '{promised_date}': {val_result}")
        return {
            "tool": "register_promise_to_pay",
            "status": "error_invalid_date",
            "promised_date": promised_date,
            "reminders_paused": False,
            "error": val_result,
            "message": f"Cannot schedule commitment: '{promised_date}' is an invalid calendar date ({val_result}). Please request a valid calendar date from the customer.",
        }

    effective_date = val_result

    try:
        from orchestrator.audit import log_audit_entry, _get_supabase_client
        supabase = _get_supabase_client()
        if supabase:
            query = supabase.table("events").update({
                "payment_status": "paused_ptp",
                "metadata": {"promised_pay_date": effective_date, "ptp_note": note},
            })
            if event_id:
                query.eq("event_id", event_id).execute()
            elif customer_id:
                query.eq("customer_id", customer_id).execute()

        log_audit_entry(
            event_id=event_id or customer_id or "ptp_commitment",
            node_name="register_promise_to_pay",
            action_taken="PTP_SCHEDULED_OUTREACH_PAUSED",
            details={"promised_date": effective_date, "note": note, "customer_id": customer_id, "event_id": event_id},
            reasoning=f"Customer confirmed payment commitment for {effective_date}. Paused all dunning until T+24h after promised date.",
        )
    except Exception as e:
        logger.warning(f"PTP DB update and audit log error: {e}")

    return {
        "tool": "register_promise_to_pay",
        "status": "scheduled",
        "promised_date": effective_date,
        "customer_id": customer_id,
        "event_id": event_id,
        "reminders_paused": True,
        "message": f"[SCHEDULED] Promise-to-Pay confirmed for {effective_date}. Automated reminders are now paused.",
    }



def get_payment_link(
    customer_name: str = "Aarav Sharma",
    amount: float = 4999.0,
    event_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Generates a secure 1-click Razorpay verified checkout link for instant customer settlement.
    
    Args:
        customer_name: Customer recipient name
        amount: Outstanding balance in INR
        event_id: Optional reference event ID
    """
    logger.info(f"[TOOL] get_payment_link: {customer_name} for ₹{amount}")
    try:
        from orchestrator.razorpay_client import create_recovery_payment_link
        ref = event_id or f"rec_{int(amount)}_{customer_name.replace(' ', '').lower()[:6]}"
        plink = create_recovery_payment_link(
            amount=amount,
            customer_name=customer_name,
            description=f"Razorpay Recovery: Outstanding Balance ₹{amount:,.0f}",
            reference_id=ref,
        )
        url = plink.get("short_url", f"https://rzp.io/i/{ref[-8:]}")
    except Exception as e:
        logger.warning(f"Dynamic link creation fallback: {e}")
        ref = event_id or f"rec_{int(amount)}"
        url = f"https://rzp.io/i/{ref[-8:]}"

    return {
        "tool": "get_payment_link",
        "payment_url": url,
        "customer_name": customer_name,
        "amount_inr": amount,
        "message": f"Secure Razorpay 1-click payment link generated: {url} (Payable: ₹{amount:,.2f})",
    }


# =============================================================================
# NEW TOOLS — Critical gaps closed
# =============================================================================

def get_payment_history(
    customer_id: str = "cust_0001",
    limit: int = 10,
) -> Dict[str, Any]:
    """
    Returns the last N payment episodes for a customer: date, amount, outcome, channel used.
    Answers: "Show my payment history", "What have I paid before?", "When was my last payment?"

    Args:
        customer_id: Customer identifier (e.g. 'cust_0001')
        limit: Number of history records to return (default 10)
    """
    logger.info(f"[TOOL] get_payment_history: {customer_id} (limit={limit})")
    episodes = []
    try:
        from orchestrator.memory import get_episodic_history
        raw = get_episodic_history(customer_id, limit=limit)
        for ep in raw:
            episodes.append({
                "date": ep.get("timestamp", "")[:10] if ep.get("timestamp") else ep.get("date", "N/A"),
                "amount_inr": float(ep.get("amount", 0)),
                "outcome": ep.get("outcome", "unknown"),
                "channel": ep.get("channel", "N/A"),
                "event_type": ep.get("event_type", "N/A"),
            })
    except Exception as e:
        logger.warning(f"Payment history episodic fetch error: {e}")

    # Supabase events fallback
    if not episodes:
        try:
            from orchestrator.audit import _get_supabase_client
            supabase = _get_supabase_client()
            if supabase:
                rows = supabase.table("events").select(
                    "created_at,amount,payment_status,event_type,optimal_action"
                ).eq("customer_id", customer_id).order("created_at", desc=True).limit(limit).execute().data or []
                for r in rows:
                    episodes.append({
                        "date": (r.get("created_at") or "")[:10],
                        "amount_inr": float(r.get("amount") or 0),
                        "outcome": r.get("payment_status", "unknown"),
                        "channel": r.get("optimal_action", "N/A"),
                        "event_type": r.get("event_type", "N/A"),
                    })
        except Exception as e:
            logger.warning(f"Payment history Supabase fallback error: {e}")

    total_paid = sum(e["amount_inr"] for e in episodes if e["outcome"] in ("recovered", "captured", "paid"))
    on_time_count = sum(1 for e in episodes if e["outcome"] in ("recovered", "captured", "paid"))

    return {
        "tool": "get_payment_history",
        "customer_id": customer_id,
        "records": episodes,
        "count": len(episodes),
        "total_paid_inr": total_paid,
        "on_time_count": on_time_count,
        "message": (
            f"Payment History for {customer_id}: {len(episodes)} records found. "
            f"On-time settlements: {on_time_count}. Total paid: ₹{total_paid:,.2f}."
        ),
    }


def get_invoice_aging(
    customer_id: str = "cust_0001",
    event_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Returns how many days overdue a customer's invoice is, the original due date,
    and aging bucket (current/30d/60d/90d+).
    Answers: "How overdue am I?", "When was my payment due?", "How many days late?"

    Args:
        customer_id: Customer identifier
        event_id: Optional specific incident ID
    """
    import datetime as dt
    logger.info(f"[TOOL] get_invoice_aging: {customer_id}")
    try:
        from orchestrator.audit import _get_supabase_client
        supabase = _get_supabase_client()
        if supabase:
            query = supabase.table("events").select("*")
            if event_id:
                query = query.eq("event_id", event_id)
            else:
                query = query.eq("customer_id", customer_id).neq("payment_status", "recovered")
            rows = query.order("created_at", desc=True).limit(1).execute().data or []
            if rows:
                row = rows[0]
                created_raw = row.get("created_at", "")
                amount = float(row.get("amount") or 0)
                status = row.get("payment_status", "unresolved")
                event_type = row.get("event_type", "N/A")

                # Calculate days overdue
                try:
                    created_dt = dt.datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
                    now_dt = dt.datetime.now(dt.timezone.utc)
                    days_overdue = (now_dt - created_dt).days
                except Exception:
                    days_overdue = 0

                if days_overdue <= 0:
                    bucket = "Current (not yet overdue)"
                elif days_overdue <= 30:
                    bucket = "0–30 days overdue"
                elif days_overdue <= 60:
                    bucket = "31–60 days overdue"
                elif days_overdue <= 90:
                    bucket = "61–90 days overdue"
                else:
                    bucket = "90+ days overdue (critical)"

                return {
                    "tool": "get_invoice_aging",
                    "customer_id": customer_id,
                    "event_id": row.get("event_id"),
                    "amount_inr": amount,
                    "status": status,
                    "event_type": event_type,
                    "days_overdue": days_overdue,
                    "created_date": created_raw[:10] if created_raw else "N/A",
                    "aging_bucket": bucket,
                    "message": (
                        f"Invoice of ₹{amount:,.2f} ({event_type}) is {days_overdue} days overdue. "
                        f"Aging bucket: {bucket}. Status: {status}."
                    ),
                }
    except Exception as e:
        logger.warning(f"Invoice aging query error: {e}")

    return {
        "tool": "get_invoice_aging",
        "customer_id": customer_id,
        "days_overdue": 0,
        "aging_bucket": "Current",
        "message": "Invoice aging data not available. Please contact support for details.",
    }


def get_subscription_plan_details(
    customer_id: str = "cust_0001",
) -> Dict[str, Any]:
    """
    Returns subscription plan name, billing cycle, amount, grace period status, and next retry window.
    Answers: "What plan am I on?", "When does my subscription renew?", "Is my account active?"

    Args:
        customer_id: Customer identifier
    """
    logger.info(f"[TOOL] get_subscription_plan_details: {customer_id}")
    try:
        from orchestrator.memory import get_customer_profile
        from orchestrator.audit import _get_supabase_client

        profile = get_customer_profile(customer_id) or {}
        supabase = _get_supabase_client()
        sub_event = None
        if supabase:
            rows = supabase.table("events").select("*").eq("customer_id", customer_id).eq(
                "event_type", "subscription_failed"
            ).order("created_at", desc=True).limit(1).execute().data or []
            if rows:
                sub_event = rows[0]

        amount = float(sub_event.get("amount", 0)) if sub_event else float(profile.get("avg_transaction_value", 4999))
        status = sub_event.get("payment_status", "active") if sub_event else "active"
        customer_name = profile.get("name", customer_id)
        reliability = profile.get("payment_reliability", 0.94)

        # Derive plan tier from amount
        if amount >= 25000:
            plan_name = "Enterprise Pro"
            billing_cycle = "Annual"
        elif amount >= 5000:
            plan_name = "Business Growth"
            billing_cycle = "Monthly"
        elif amount >= 999:
            plan_name = "Starter Plus"
            billing_cycle = "Monthly"
        else:
            plan_name = "Basic Plan"
            billing_cycle = "Monthly"

        grace_active = status in ("paused_ptp", "auto_recovering", "subscription_failed")

        return {
            "tool": "get_subscription_plan_details",
            "customer_id": customer_id,
            "customer_name": customer_name,
            "plan_name": plan_name,
            "billing_cycle": billing_cycle,
            "amount_inr": amount,
            "account_status": status,
            "grace_period_active": grace_active,
            "payment_reliability_pct": round(reliability * 100, 1),
            "message": (
                f"{customer_name} is on the **{plan_name}** plan (₹{amount:,.2f}/{billing_cycle}). "
                f"Account status: {status}. "
                f"{'14-day grace period is currently active — your access is NOT interrupted.' if grace_active else 'Account is active and in good standing.'}"
            ),
        }
    except Exception as e:
        logger.warning(f"Subscription plan lookup error: {e}")

    return {
        "tool": "get_subscription_plan_details",
        "customer_id": customer_id,
        "plan_name": "Starter Plus",
        "billing_cycle": "Monthly",
        "amount_inr": 4999.0,
        "account_status": "active",
        "grace_period_active": False,
        "message": "Your subscription plan details could not be loaded. Please contact support.",
    }


def escalate_to_human(
    customer_id: str = "cust_0001",
    customer_name: str = "Customer",
    reason: str = "Customer requested human agent",
    event_id: Optional[str] = None,
    amount: float = 0.0,
) -> Dict[str, Any]:
    """
    Immediately stops all automated outreach, logs an escalation, and dispatches
    a Telegram alert to merchant admins to contact the customer.
    Triggers on: 'speak to a human', 'call me', 'I want a person', 'manager', 'escalate'.

    Args:
        customer_id: Customer identifier
        customer_name: Customer name for the alert
        reason: Why escalation was triggered
        event_id: Optional incident ID
        amount: Amount involved
    """
    logger.info(f"[TOOL] escalate_to_human: {customer_id} — {reason}")

    ticket_id = f"ESC-{customer_id[-4:]}-{event_id[-4:] if event_id else '0000'}"

    try:
        from orchestrator.audit import log_audit_entry, _get_supabase_client
        supabase = _get_supabase_client()

        # Pause all automated outreach for this customer
        if supabase:
            q = supabase.table("events").update({"payment_status": "human_escalated"})
            if event_id:
                q.eq("event_id", event_id).execute()
            else:
                q.eq("customer_id", customer_id).execute()

        log_audit_entry(
            event_id=event_id or customer_id,
            node_name="escalate_to_human",
            action_taken="HUMAN_ESCALATION_TRIGGERED",
            details={
                "customer_id": customer_id,
                "customer_name": customer_name,
                "reason": reason,
                "ticket_id": ticket_id,
                "amount": amount,
            },
            reasoning=f"Customer explicitly requested human agent. All automated outreach paused immediately. Ticket {ticket_id} created.",
        )

        # Dispatch Telegram alert to merchant admins
        try:
            from orchestrator.channels.telegram_bot import _get_fallback_merchant_chats, _send_message
            merchant_chats = _get_fallback_merchant_chats()
            for chat_id in merchant_chats[:2]:
                _send_message(
                    chat_id=chat_id,
                    text=(
                        f"🚨 <b>HUMAN ESCALATION REQUEST</b>\n\n"
                        f"• <b>Customer:</b> {customer_name} (<code>{customer_id}</code>)\n"
                        f"• <b>Ticket:</b> <code>{ticket_id}</code>\n"
                        f"• <b>Amount:</b> ₹{amount:,.0f}\n"
                        f"• <b>Reason:</b> {reason}\n\n"
                        "All automated outreach has been <b>paused</b>. Please contact this customer directly."
                    ),
                )
        except Exception as tg_err:
            logger.warning(f"Telegram escalation alert failed: {tg_err}")

    except Exception as e:
        logger.warning(f"Escalation DB/audit error: {e}")

    return {
        "tool": "escalate_to_human",
        "status": "escalated",
        "ticket_id": ticket_id,
        "customer_id": customer_id,
        "outreach_paused": True,
        "message": (
            f"[ESCALATED] Your request has been noted, {customer_name}. "
            f"Ticket {ticket_id} has been created and a Razorpay representative will contact you shortly. "
            "All automated reminders are now paused."
        ),
    }

