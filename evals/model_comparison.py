"""
Multi-Model Benchmark: Revenue Recovery Orchestrator
=====================================================
Runs 6 representative test cases through multiple model backends and measures:
  - Root-cause classification accuracy
  - Intervention action quality
  - Latency (wall-clock ms per event)
  - Estimated API cost per 1,000 events

Models evaluated:
  1. google/gemini-2.5-flash       (via Gemini API)
  2. azure/gpt-4o-mini             (via Azure OpenAI)
  3. azure/gpt-4o                  (via Azure OpenAI)
  4. deterministic-rules-only      (baseline, no LLM)

Usage:
    python evals/model_comparison.py
    python evals/model_comparison.py --output evals/model_results.json
"""

import json
import os
import sys
import time
import argparse
import statistics
from typing import Any

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ.setdefault("DISABLE_AUDIT_DB", "true")

from dotenv import load_dotenv
load_dotenv()

PRICING = {
    "gemini-2.5-flash": {"input": 0.30, "output": 2.50, "label": "Gemini 2.5 Flash"},
    "gpt-4o-mini":      {"input": 0.15, "output": 0.60, "label": "GPT-4o mini"},
    "gpt-4o":           {"input": 2.50, "output": 10.00, "label": "GPT-4o"},
    "rules-only":       {"input": 0.00, "output": 0.00, "label": "Deterministic Rules"},
}

AVG_INPUT_TOKENS  = 420
AVG_OUTPUT_TOKENS = 280
EVENTS_PER_1K = 1000

def cost_per_1k(model_key: str) -> float:
    p = PRICING[model_key]
    cost = (p["input"] * AVG_INPUT_TOKENS / 1_000_000) + (p["output"] * AVG_OUTPUT_TOKENS / 1_000_000)
    return round(cost * EVENTS_PER_1K, 4)

EVENTS = [
    {"event_id":"cmp_001","event_type":"payment_degraded","amount":8500.0,"merchant_id":"merch_03","customer_id":"cust_001","customer_name":"Priya Verma","customer_email":"priya@example.com","customer_phone":"+919876543210","history":{"prior_contacts":0,"prior_payment_success_rate":0.95,"customer_avg_days_late":1},"metadata":{"failure_bank":"HDFC","pct_merchant_failures_same_route":0.72,"error_code":"GATEWAY_TIMEOUT"},"ground_truth_root_cause":"payment_degraded","expected_action":"reroute"},
    {"event_id":"cmp_002","event_type":"checkout_abandoned","amount":3499.0,"merchant_id":"merch_01","customer_id":"cust_002","customer_name":"Aditya Joshi","customer_email":"aditya@example.com","customer_phone":"+919123456789","history":{"prior_contacts":0,"prior_payment_success_rate":0.78,"customer_avg_days_late":3},"metadata":{"cart_items":["Enterprise Plan"],"time_since_abandon_minutes":30},"ground_truth_root_cause":"checkout_abandoned","expected_action":"whatsapp"},
    {"event_id":"cmp_003","event_type":"subscription_failed","amount":1999.0,"merchant_id":"merch_02","customer_id":"cust_003","customer_name":"Meera Patel","customer_email":"meera@example.com","customer_phone":"+919988776655","history":{"prior_contacts":1,"prior_payment_success_rate":0.88,"customer_avg_days_late":4},"metadata":{"failure_reason":"card_expired","subscription_plan":"Pro Monthly"},"ground_truth_root_cause":"subscription_failed","expected_action":"whatsapp"},
    {"event_id":"cmp_004","event_type":"receivable_overdue","amount":75000.0,"merchant_id":"merch_04","customer_id":"cust_004","customer_name":"Rajesh Industries","customer_email":"ap@rajeshindustries.com","customer_phone":"+919876500000","history":{"prior_contacts":0,"prior_payment_success_rate":0.65,"customer_avg_days_late":12},"metadata":{"invoice_number":"INV-2026-0587","days_overdue":15},"ground_truth_root_cause":"receivable_overdue","expected_action":"whatsapp"},
    {"event_id":"cmp_005","event_type":"receivable_overdue","amount":5000.0,"merchant_id":"merch_01","customer_id":"cust_005","customer_name":"Reliable Corp","customer_email":"finance@reliablecorp.com","customer_phone":"+919876501234","history":{"prior_contacts":0,"prior_payment_success_rate":0.97,"customer_avg_days_late":1},"metadata":{"invoice_number":"INV-2026-0601","days_overdue":2},"ground_truth_root_cause":"receivable_overdue","expected_action":"do_nothing","is_natural_payer":True},
    {"event_id":"cmp_006","event_type":"mandate_auth_failed","amount":25000.0,"merchant_id":"merch_05","customer_id":"cust_006","customer_name":"Kavita Singh","customer_email":"kavita@example.com","customer_phone":"+919876543299","history":{"prior_contacts":0,"prior_payment_success_rate":0.91,"customer_avg_days_late":0},"metadata":{"afa_step_reached":False,"mandate_type":"e-mandate","bank":"SBI"},"ground_truth_root_cause":"mandate_auth_failed","expected_action":"send_afa_link"},
]

SYSTEM_PROMPT = '''You are a Revenue Recovery Orchestrator. Classify the root cause into one of:
payment_degraded, mandate_auth_failed, subscription_failed, checkout_abandoned, receivable_overdue, promise_to_pay

Then recommend the single best recovery action:
- reroute (payment_degraded only, NEVER contact customer)
- send_afa_link (mandate_auth_failed)
- send_payment_link (checkout_abandoned / subscription_failed)
- send_invoice_reminder (receivable_overdue with poor payment history)
- do_nothing (natural payers with 95%+ on-time rate who are 1-2 days late)
- escalate_human (amounts >= 100000)
- whatsapp (send WhatsApp outreach for checkout/subscription)

Reply ONLY with this JSON (no markdown, no code blocks):
{"root_cause":"<category>","confidence":<0.0-1.0>,"action":"<action>","reasoning":"<one sentence>"}'''

def build_user_prompt(event: dict) -> str:
    return json.dumps({"event_type": event["event_type"],"amount": event["amount"],"history": event["history"],"metadata": event["metadata"]}, indent=2)

def parse_llm_output(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("`"):
        parts = raw.split("`")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    try:
        return json.loads(raw)
    except Exception:
        import re
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                return json.loads(m.group())
            except Exception:
                pass
    return {}

def run_gemini(event: dict) -> dict:
    """Run event through Gemini 2.5 Flash (google-genai SDK)."""
    from google import genai
    from google.genai import types as gtypes
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return {"error": "GEMINI_API_KEY not set", "latency_ms": 0}
    client = genai.Client(api_key=api_key)
    t0 = time.perf_counter()
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=build_user_prompt(event),
            config=gtypes.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.1,
                max_output_tokens=512,
            ),
        )
        raw = response.text or ""
    except Exception as e:
        return {"error": str(e), "latency_ms": int((time.perf_counter()-t0)*1000)}
    result = parse_llm_output(raw)
    result["latency_ms"] = int((time.perf_counter()-t0)*1000)
    return result

def run_azure(event: dict, deployment: str) -> dict:
    from openai import AzureOpenAI
    client = AzureOpenAI(api_key=os.getenv("AZURE_OPENAI_API_KEY"), api_version=os.getenv("AZURE_OPENAI_API_VERSION","2024-12-01-preview"), azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT",""))
    t0 = time.perf_counter()
    try:
        resp = client.chat.completions.create(model=deployment, messages=[{"role":"system","content":SYSTEM_PROMPT},{"role":"user","content":build_user_prompt(event)}], temperature=0.1, max_tokens=512)
        raw = resp.choices[0].message.content or ""
    except Exception as e:
        return {"error": str(e), "latency_ms": int((time.perf_counter()-t0)*1000)}
    result = parse_llm_output(raw)
    result["latency_ms"] = int((time.perf_counter()-t0)*1000)
    return result

def run_rules_only(event: dict) -> dict:
    t0 = time.perf_counter()
    et = event["event_type"]
    pct = event.get("metadata",{}).get("pct_merchant_failures_same_route", 0.0)
    if pct > 0.5:
        rc, act = "payment_degraded", "reroute"
    elif et == "mandate_auth_failed":
        rc, act = "mandate_auth_failed", "send_afa_link"
    elif et == "subscription_failed":
        rc, act = "subscription_failed", "send_payment_link"
    elif et == "checkout_abandoned":
        rc, act = "checkout_abandoned", "send_payment_link"
    elif et == "receivable_overdue":
        rc, act = "receivable_overdue", "send_invoice_reminder"  # cannot model natural payer
    else:
        rc, act = et, "do_nothing"
    return {"root_cause":rc,"confidence":1.0,"action":act,"reasoning":"Deterministic rule","latency_ms":int((time.perf_counter()-t0)*1000)}

def score_result(result: dict, event: dict) -> dict:
    gt_cause = event["ground_truth_root_cause"]
    gt_action = event.get("expected_action","")
    is_natural = event.get("is_natural_payer", False)
    pred_cause = result.get("root_cause","")
    pred_action = result.get("action","")
    action_map = {"whatsapp":"send_payment_link","send_payment_link":"whatsapp"}  # treat as equivalent
    action_correct = (pred_action == gt_action) or (action_map.get(pred_action) == gt_action) or (not gt_action)
    false_intervention = is_natural and pred_action not in ("do_nothing","reroute","escalate_human")
    return {"cause_correct": pred_cause==gt_cause, "action_correct": action_correct, "false_intervention": false_intervention, "confidence": result.get("confidence",0.0), "latency_ms": result.get("latency_ms",0), "error": result.get("error")}

def run_benchmark() -> dict:
    deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME","gpt-4o-mini")
    print(f"\n{'='*70}\n  REVENUE RECOVERY MULTI-MODEL BENCHMARK\n  Azure: {deployment} | Events: {len(EVENTS)}\n{'='*70}\n")
    model_configs = [
        ("gemini-2.5-flash", lambda e: run_gemini(e)),
        ("gpt-4o-mini", lambda e: run_azure(e, deployment)),
        ("gpt-4o", lambda e: run_azure(e, "gpt-4o")),
        ("rules-only", lambda e: run_rules_only(e)),
    ]
    all_results = {}
    for model_key, runner in model_configs:
        label = PRICING[model_key]["label"]
        print(f"-> [{label}]")
        model_scores = []
        for event in EVENTS:
            sys.stdout.write(f"   {event['event_id']} {event['event_type']} ... ")
            sys.stdout.flush()
            raw = runner(event)
            s = score_result(raw, event)
            s.update({"event_id":event["event_id"],"event_type":event["event_type"],"amount":event["amount"],"ground_truth":event["ground_truth_root_cause"],"predicted":raw.get("root_cause","?"),"action":raw.get("action","?"),"reasoning":raw.get("reasoning","")})
            model_scores.append(s)
            print(f"{'OK ' if s['cause_correct'] else 'FAIL'}  ({s['latency_ms']}ms)")
        all_results[model_key] = model_scores
        print()
    summary = {}
    for mk, scores in all_results.items():
        n = len(scores)
        valid = [s for s in scores if not s.get("error")]
        cause_acc  = sum(1 for s in valid if s["cause_correct"])/n*100
        action_acc = sum(1 for s in valid if s["action_correct"])/n*100
        false_intv = sum(1 for s in valid if s["false_intervention"])
        lats = [s["latency_ms"] for s in valid]
        p50 = round(statistics.median(lats)) if lats else 0
        p95 = round(sorted(lats)[max(0,int(len(lats)*0.95)-1)]) if lats else 0
        summary[mk] = {
            "label": PRICING[mk]["label"],
            "cause_accuracy_pct": round(cause_acc,1),
            "action_accuracy_pct": round(action_acc,1),
            "false_interventions": false_intv,
            "total_events": n,
            "errors": len([s for s in scores if s.get("error")]),
            "latency_p50_ms": p50,
            "latency_p95_ms": p95,
            "avg_confidence": round(statistics.mean(s["confidence"] for s in valid if s["confidence"]) if valid else 0, 3),
            "cost_per_1k_usd": cost_per_1k(mk),
            "per_event": scores,
        }
    print("\n"+"="*70+"\n  SUMMARY\n"+"="*70)
    print(f"{'Model':<25} {'Class%':>7} {'Action%':>8} {'FI':>3} {'P50ms':>7} {'$/1k':>8}")
    print("-"*70)
    for mk,s in summary.items():
        print(f"{s['label']:<25} {s['cause_accuracy_pct']:>6.1f}% {s['action_accuracy_pct']:>7.1f}% {s['false_interventions']:>3} {s['latency_p50_ms']:>7} ")
    return summary

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="evals/model_results.json")
    args = parser.parse_args()
    summary = run_benchmark()
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, default=str)
    print(f"\nOK  Results written to {args.output}")
    print("  Run: python evals/generate_report.py  to build the HTML pitch deck\n")

if __name__ == "__main__":
    main()
