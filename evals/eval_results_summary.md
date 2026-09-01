# LLM Evaluation & Model Selection Report
**Razorpay Revenue Recovery Orchestrator — Hackathon Track 3: AI Revenue Recovery**

---

## Executive Summary

To select the most accurate, resilient, and cost-effective LLM engine for supervisory revenue recovery, we executed empirical evaluations benchmarking candidate models across multi-class recovery scenarios:

1. **Azure OpenAI gpt-4o-mini** *(Selected Production Model)*
2. **Azure OpenAI gpt-4o**
3. **Google Gemini 2.5 Flash Lite**
4. **Deterministic Heuristic Baseline**

---

## 🏆 Multi-Model Benchmark Comparison Table

| Model Candidate | Provider | Root-Cause Accuracy | Guardrail Compliance | Do-Nothing Recall | Latency ($p_{50}$) | Cost / 1,000 Incidents | Score | Recommendation |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Azure OpenAI gpt-4o-mini** | **Azure OpenAI** | **100.0%** | **100.0%** | **100.0%** | **185 ms** | **$0.1170** | **88.4** | 🚀 **SELECTED (Production)** |
| **Azure OpenAI gpt-4o** | **Azure OpenAI** | **100.0%** | **100.0%** | **100.0%** | 290 ms | $1.9500 | 82.3 | ⚡ *Frontier Diagnostic* |
| **Google Gemini 2.5 Flash Lite** | Google GenAI | **87.5%** | **100.0%** | **100.0%** | 310 ms | $0.0570 | 81.6 | 🔄 *Cross-Vendor Fallback* |
| **Heuristic Rules (Baseline)** | Deterministic | 62.5% | 100.0% | 0.0% ⚠️ | **1.2 ms** | $0.0000 | 61.2 | 🛡️ *Route Outage Fast-Path* |

---

## Key Findings & Selection Rationale

### 1. Why Azure OpenAI gpt-4o-mini is the Winning Model
- **Deterministic Compliance**: Enforces Razorpay financial invariants without prompt deviation (₹1,00,000 escalation threshold, 2-contact max limit, and 24-hour quiet windows).
- **Zero Free-Tier Quota Bottlenecks**: Hosted on dedicated Azure enterprise infrastructure, eliminating 429 rate-limiting during high-volume payment failure spikes.
- **Strict Structured Outputs**: Emits compliant JSON schemas parseable by downstream policy engines and execution nodes.
- **Operating Cost**: At **$0.117 per 1,000 recovery events**, model cost is negligible relative to recovered volume.

### 2. The Hybrid Architecture Advantage
- Technical route degradations (e.g. `payment_degraded` HDFC UPI bank gateway timeout) bypass the LLM entirely and execute through deterministic silent rerouting ($0\text{ ms}$ LLM latency, $\$0$ token cost).
- The LLM is engaged **strictly for ambiguous behavioral events** (cart drop-offs, promise-to-pay intent disambiguation, and invoice term disputes).

---

## Interactive Visual Artifacts
- **Interactive Report**: [model_comparison_report.html](model_comparison_report.html)
- **Raw Benchmark Results**: [last_run.json](last_run.json)
