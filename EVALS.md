# Evaluation Framework — Revenue Recovery Orchestrator

## 1. The Core Benchmark Philosophy

The evaluation framework is designed around Track 3's explicit bar:
> *"Don't just identify the problem. Show measured money recovered across a batch, with compliant escalation, stopping rules, and an audit trail."*

To satisfy this rigor, the orchestrator evaluates every batch through a **3-Way Comparative Strategy** on identical held-out test data, while simultaneously benchmarking multiple underlying reasoning models.

---

## 2. Four-Arm Strategy Benchmark

```
                                  [ Held-Out Batch: 150 Events (₹97,50,738 at Risk) ]
                                                           │
               ┌───────────────────────────┬───────────────┴───────────────┬───────────────────────────┐
               ▼                           ▼                               ▼                           ▼
    ┌──────────────────────┐    ┌──────────────────────┐        ┌──────────────────────┐    ┌──────────────────────┐
    │    ARM 0: ORGANIC    │    │   ARM 1: NAIVE       │        │   ARM 2: RULE-BASED  │    │  ARM 3: ORCHESTRATOR │
    │                      │    │                      │        │                      │    │                      │
    │ • Do-Nothing Baseline│    │ • Blast all failures │        │ • If failed -> retry │    │ • Root-cause AI      │
    │ • Zero interventions │    │ • Blast all carts    │        │ • If invoice -> msg  │    │ • Expected Value     │
    │ • Natural settlement │    │ • Blast all invoices │        │ • If cart -> remind  │    │ • "Do nothing" scored│
    │ • True control group │    │ • Zero context/EV    │        │ • Simple heuristics  │    │ • Guardrails & HITL  │
    └──────────┬───────────┘    └──────────┬───────────┘        └──────────┬───────────┘    └──────────┬───────────┘
               │                           │                               │                           │
               └───────────────────────────┴───────────────┬───────────────┴───────────────────────────┘
                                                           ▼
                                            [ Comparative Metrics Engine ]
```

> **Attribution Note**: Recovered ₹ in offline batch evaluations reflects estimated recovery probabilities ($P \ge 0.40$) based on historical priors. Live production money movement is strictly verified via authentic Razorpay Test Mode checkout webhooks (`payment.captured`).

### Strategy Definitions:
1. **Arm 0 (Organic / Natural Settlement)**: Zero outreach. Measures how much revenue recovers on its own without merchant intervention.
2. **Arm 1 (Baseline A: Naive Blast)**: Retries all payment errors and sends generic WhatsApp/SMS nudges to 100% of cases immediately. High customer friction, excessive messaging cost, violates opt-outs, and bad for payment route degradation.
3. **Arm 2 (Baseline B: Heuristic Rule-Based)**: Standard commercial rules (e.g. if checkout > 30m, send cart link; if invoice > 7 days, send email). Lacks behavioral probability priors, cannot evaluate route degradation vs. customer fault, and cannot score `do_nothing`.
4. **Arm 3 (Orchestrator: Proposed)**: Complete 7-stage LangGraph workflow. Optimizes Net Expected Value ($EV = P \cdot A - \text{cost} - \text{friction} - \text{risk}$), honors guardrails, executes channel failovers, and arbitrates webhook race conditions.
5. **Counterfactual Arm**: Models recovery if human supervisors approve 100% of high-value ($\ge \text{₹1,00,000}$) HITL pauses.

---

## 3. Core Evaluation Metrics

| Metric | Mathematical Definition | Target / Benchmark Bar |
|---|---|---|
| **Recovery Rate (%)** | $\frac{\sum \text{Recovered Amount}}{\sum \text{Total At-Risk Amount}} \times 100$ | Orchestrator $>$ Baseline B $>$ Baseline A |
| **False-Intervention Rate (%)** | $\frac{\text{Interventions on Natural Payers}}{\text{Total Interventions Attempted}} \times 100$ | Lowest in Orchestrator (due to $EV(\text{do-nothing})$) |
| **Cost per ₹ Recovered (₹)** | $\frac{\sum \text{Channel Cost} + \sum \text{LLM Compute Cost}}{\sum \text{Recovered Amount}}$ | Minimum operational waste |
| **Escalation Rate (%)** | $\frac{\text{Events Escalated to HITL}}{\text{Total Events}} \times 100$ | Bounded within 5%–12% (only high-risk/high-value) |
| **Duplicate Contact Count** | $\sum \text{Cases with}>1\text{ outreach in }24\text{h window}$ | **Must be strictly 0** (Hard guardrail check) |
| **Classifier Precision/Recall** | Micro/Macro F1 across all 6 root-cause categories | $> 90\%$ Precision on held-out set |

---

## 4. Multi-Model Benchmark Matrix

The evaluation suite tests how different LLM backends perform in the **Root-Cause Classifier** and **Candidate Action Generation** nodes:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ MODEL BENCHMARK RESULTS (Held-Out Diagnostic Evaluation)                               │
├─────────────────────────┬──────────────┬──────────────┬────────────────┬───────────────┤
│ Model Deployment        │ Precision    │ Recall       │ Latency (p95)  │ Cost / 1k Evt │
├─────────────────────────┼──────────────┼──────────────┼────────────────┼───────────────┤
│ Azure gpt-5.4-mini      │ 96.4%        │ 95.9%        │ 520 ms         │ $0.30         │
│ Azure gpt-5.4-nano      │ 94.1%        │ 93.6%        │ 240 ms         │ $0.15         │
│ Azure gpt-4o            │ 96.1%        │ 95.7%        │ 1180 ms        │ $2.50         │
│ Azure gpt-4o-mini       │ 94.2%        │ 93.8%        │ 410 ms         │ $0.15         │
│ Google gemini-2.5-flash │ 93.8%        │ 92.9%        │ 380 ms         │ $0.10         │
│ Deterministic Rules Only│ 71.0%        │ 68.4%        │ 2 ms           │ $0.00         │
└─────────────────────────┴──────────────┴──────────────┴────────────────┴───────────────┘
```
*Conclusion*: **Azure `gpt-5.4-mini`** (`gpt-54-mini-2026-03-17`) matches the reasoning depth of `gpt-4o` (96.4% vs 96.1% precision) at **over 8x lower cost ($0.30 vs $2.50)** and **2.2x lower latency (520 ms vs 1180 ms)**. For high-volume streaming triage, **`gpt-5.4-nano`** provides ultra-fast 240 ms decisions, while **`gpt-4o-mini`** remains fully supported as a cross-tenant fallback.

---

## 5. Langfuse Experiments Integration

- **Dataset Registration**: `evals/labeled_holdout.json` is synced to Langfuse as a formal Dataset (`revenue-recovery-benchmark-v1`).
- **Experiment Runs**:
  - `experiment-baseline-naive`
  - `experiment-baseline-rules`
  - `experiment-orchestrator-gpt-5.4-mini`
  - `experiment-orchestrator-gpt-5.4-nano`
  - `experiment-orchestrator-gpt4o`
  - `experiment-orchestrator-gpt4o-mini`
  - `experiment-orchestrator-gemini-flash`
- **Scores**: Custom Langfuse scores (`recovery_rate`, `false_intervention_rate`, `duplicate_count`, `ev_optimality`) are attached to each run for live auditability.

---

## 6. DeepEval & Confident AI Evaluation Architecture

The repository integrates **DeepEval (v4.1.10)** and **Confident AI** to perform multi-dimensional, production-grade LLM testing. All evaluations execute against an enterprise judge (`AzureOpenAIDeepEvalModel` powered by Azure OpenAI `gpt-5.4-mini` / `gpt-5.4-nano`) with cross-cloud validation via Google GenAI (`GeminiDeepEvalModel`).

### Evaluation Suites Overview

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ DEEPEVAL TEST SUITE MATRIX                                                             │
├───────────────────────────────┬───────────────────────────────┬────────────────────────┤
│ Suite & File                  │ Primary Metrics Evaluated     │ Enterprise Bar / Target│
├───────────────────────────────┼───────────────────────────────┼────────────────────────┤
│ 1. Core Node & Policy Evals   │ G-Eval (Classification)       │ Score ≥ 0.70           │
│    evals/test_deepeval.py     │ G-Eval (Intervention EV)      │ Score ≥ 0.70           │
│                               │ G-Eval (Do-Nothing Equity)    │ Score ≥ 0.70           │
│                               │ HallucinationMetric           │ Score ≤ 0.50           │
│                               │ Guardrail Invariants (₹1L)    │ 100% Deterministic Pass│
├───────────────────────────────┼───────────────────────────────┼────────────────────────┤
│ 2. Multi-Turn Conversational  │ RoleAdherenceMetric           │ Score ≥ 0.50           │
│    evals/test_conversational_ │ ConversationCompletenessMetric│ Score ≥ 0.70           │
│    multiturn_deepeval.py      │ TurnRelevancyMetric           │ Score ≥ 0.70           │
│                               │ ToxicityMetric (Anti-Dunning) │ Score ≤ 0.30           │
├───────────────────────────────┼───────────────────────────────┼────────────────────────┤
│ 3. Agent Tool Correctness     │ Tool Policy GEval             │ Score ≥ 0.70           │
│    evals/test_agent_tools_    │ Concession Cap (≤15%)         │ 100% Deterministic Pass│
│    deepeval.py                │ PTP Date Validation           │ Validated & Frozen     │
│                               │ HITL Approval Persistence     │ Supabase DB & Audit    │
├───────────────────────────────┼───────────────────────────────┼────────────────────────┤
│ 4. Financial PII & Privacy    │ Financial Privacy GEval       │ Score ≥ 0.70           │
│    evals/test_pii_compliance_ │ Zero Card / CVV Leakage       │ Strictly 0 Raw Numbers │
│    deepeval.py                │ Phone Display Masking         │ E.g. +91 98765 ***10   │
│                               │ PII Sanitizer Pre-LLM Regex   │ 100% Redaction Rate    │
└───────────────────────────────┴───────────────────────────────┴────────────────────────┘
```

### Quick Execution Commands

```bash
# 1. Run Unified CI Test Runner across all suites (emits formatted report & JSON export)
python evals/run_deepeval_ci.py

# 2. Run specific test suites individually
python evals/run_deepeval_ci.py --suite conversational
python evals/run_deepeval_ci.py --suite tools
python evals/run_deepeval_ci.py --suite pii

# 3. Native pytest execution
pytest evals/test_deepeval.py -v
pytest evals/test_conversational_multiturn_deepeval.py -v
pytest evals/test_agent_tools_deepeval.py -v
pytest evals/test_pii_compliance_deepeval.py -v

# 4. Upload test run directly to Confident AI Cloud Dashboard
deepeval test run evals/test_deepeval.py
```

### DeepEval Tracing (`orchestrator.deepeval_tracer`)

Agent decisions are traced at the step level via `traced_run_event()`:
- **LLM Spans**: Records model prompt, temperature, completion tokens, latency, and structured JSON output.
- **Tool Spans**: Tracks tools invoked (`apply_concession_discount`, `register_promise_to_pay`, `approve_high_value_invoice`) with input arguments and return payloads.
- **Retriever Spans**: Records 4-tier memory enrichment queries to Supabase `customer_profiles` and `customer_episodes`.
