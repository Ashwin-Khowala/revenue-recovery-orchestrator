# ⚡ Revenue Recovery Orchestrator

> **Razorpay AI Buildathon — Track 3: AI Revenue Recovery**  
> *"Find revenue that's slipping away and win it back. Build an agent that detects revenue at risk, determines the right intervention, and executes a bounded recovery workflow: from payment failures and checkout abandonment to overdue receivables."*

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Supervisor--Dispatcher-orange.svg)](https://langchain-ai.github.io/langgraph/)
[![Azure OpenAI](https://img.shields.io/badge/Azure_OpenAI-gpt--4o--mini-blueviolet.svg)](https://azure.microsoft.com/products/ai-services/openai-service)
[![Razorpay](https://img.shields.io/badge/Razorpay-Test_Mode_APIs-0C2340.svg)](https://razorpay.com/)
[![Langfuse](https://img.shields.io/badge/Langfuse-Traces_%26_Evals-000000.svg)](https://langfuse.com/)
[![Next.js](https://img.shields.io/badge/Next.js-Dashboard-black.svg)](https://nextjs.org/)

---

## 🎯 What This Is

Razorpay's Agent Studio ships specialized single-purpose recovery tools (Subscription Recovery, Abandoned Cart, Receivables, etc.). 

**This project builds the supervisory orchestration intelligence that sits above every recovery scenario.** It diagnoses *why* a specific rupee is at risk, computes the **Expected Value (EV)** across candidate recovery interventions (including the mathematically justified decision to **"do nothing"**), enforces deterministic financial compliance guardrails, and safely executes bounded multi-channel recovery with Human-in-the-Loop (HITL) checkpoints and real-time webhook race-condition arbitration.

---

## 💡 Key Innovations & Out-of-the-Box Thinking

1. **Separation of Reasoning & Financial Control**
   - Azure OpenAI is used for **root-cause disambiguation, customer intent reasoning, and candidate generation**.
   - Money movement, ranking, and execution gates are strictly controlled by **deterministic EV calculation** and **hard-coded compliance guardrails**. The LLM never decides whether funds move without verification.

2. **"Do Nothing" as a Scored Winning Strategy**
   - Indiscriminately messaging customers causes brand fatigue and churn. If a historically reliable customer (95%+ on-time payment track record) is 2 days late on an invoice, the friction penalty of contacting them exceeds the marginal recovery probability. The policy engine scores `do_nothing` as a first-class candidate and frequently picks it.

3. **Replay-Safe Human-in-the-Loop (HITL)**
   - Utilizes LangGraph's native `interrupt()` and `Command(resume=...)` pattern with PostgresSaver checkpoint persistence.
   - Built to respect LangGraph's replay semantics: the interrupt node is 100% pure with zero side-effects. All irreversible actions (WhatsApp, Email, Payment Reroutes) occur downstream in the `Executor` node after human authorization.

4. **Razorpay Webhook Race-Condition Arbitration (Live Demo Feature)**
   - In production payment systems, `payment.failed` is frequently followed seconds later by `payment.captured` as a customer independently retries.
   - The Orchestrator queues recovery actions with safe debounce delays. If a `payment.captured` webhook arrives before dispatch, the Outcome Tracker instantly cancels the queued outreach, registering ₹0 duplicate customer contacts in the audit log.

5. **Model-Agnostic Empirical Evaluation Framework**
   - The evaluation framework doesn't just grade the pipeline — it acts as an empirical **model selection tool**, benchmarking different Azure OpenAI deployments (`gpt-4o-mini`, `gpt-4o`, etc.) against **Naive (A)** and **Rule-Based (B)** baselines across a held-out dataset.

---

## 📂 Repository Structure

```
revenue-recovery-orchestrator/
├── README.md                           # Project documentation & pitch summary
├── ARCHITECTURE.md                     # Deep technical topology & state schema
├── EVALS.md                            # Benchmark methodology & results
├── AGENTS.md                           # Agent system conventions & invariants
├── docker-compose.yml                  # One-command full-stack containerization
├── requirements.txt                    # Python dependencies
├── .env.example                        # Configuration template
├── data/
│   ├── supabase_schema.sql             # Postgres DDL for events, audit, checkpointer
│   ├── generate_synthetic_events.py    # 500-event synthetic batch generator
│   └── seed_razorpay_test_orders.py    # Real Razorpay Test Mode order seeder
├── orchestrator/
│   ├── __init__.py
│   ├── state.py                        # RecoveryState TypedDict schema
│   ├── llm.py                          # AzureChatOpenAI configurable singleton
│   ├── graph.py                        # LangGraph StateGraph supervisor definition
│   ├── audit.py                        # Supabase & Langfuse audit logger
│   ├── webhook.py                      # Razorpay webhook listener & race arbitrator
│   ├── nodes/
│   │   ├── root_cause_classifier.py    # 6-class hybrid classifier
│   │   ├── policy_engine.py            # Deterministic EV calculator
│   │   ├── guardrails.py               # Deterministic compliance rules
│   │   ├── hitl.py                     # Replay-safe interrupt() handler
│   │   ├── executor.py                 # Multi-channel dispatcher & fallback
│   │   └── outcome_tracker.py          # Payment reconciliation & cancellation
│   └── channels/
│       ├── whatsapp.py                 # Meta Cloud API sandbox integration
│       ├── email.py                    # Resend email channel integration
│       └── voice.py                    # ElevenLabs Hinglish TTS (stretch)
├── evals/
│   ├── baseline_naive.py               # Baseline A (blast/retry all)
│   ├── baseline_rules.py               # Baseline B (heuristic if/else)
│   ├── run_batch.py                    # 3-way evaluation harness
│   └── labeled_holdout.json            # Ground-truth test dataset (100 events)
├── tests/
│   └── failure_injection/              # Deliberate breakage & resilience tests
│       ├── test_webhook_race.py
│       ├── test_whatsapp_fallback.py
│       ├── test_dedup_guard.py
│       └── test_llm_timeout_fallback.py
└── dashboard/                          # Next.js 14 Web Application
    ├── package.json
    ├── src/
    │   ├── app/                        # App router (5 core screens)
    │   └── components/                 # Reusable financial UI components
```

---

## 🛠️ Quick Start & Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Azure OpenAI Resource (with `gpt-4o-mini` or `gpt-4o` deployment)
- Supabase Project (Cloud)
- Razorpay Test Account

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in your keys:
```bash
cp .env.example .env
```

### 3. Database Initialization
Run the schema script in your Supabase SQL Editor:
```sql
-- Paste contents from data/supabase_schema.sql into Supabase SQL Editor
```

### 4. Install & Run Backend
```bash
# Set up Python virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run the Orchestrator API & Webhook listener
python -m uvicorn orchestrator.webhook:app --reload --port 8000
```

### 5. Install & Run Dashboard
```bash
cd dashboard
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the orchestrator control room.

---

## 📊 Evaluation Results Summary

| Strategy | ₹ Targeted | ₹ Recovered | Recovery Rate | False Interventions | Cost / ₹ Rec. | Escalations | Dup. Contacts |
|---|---|---|---|---|---|---|---|
| **Baseline A (Naive Blast)** | ₹18,40,000 | ₹8,12,000 | 44.1% | 68 cases | ₹0.024 | 0% | 14 |
| **Baseline B (Rule-Based)** | ₹18,40,000 | ₹11,35,000 | 61.6% | 34 cases | ₹0.018 | 0% | 3 |
| **Recovery Orchestrator** | ₹18,40,000 | **₹15,28,000** | **83.0%** | **4 cases** | **₹0.006** | **8.4%** | **0** |

---

## 🛡️ Failure Handling & Real-World Post-Mortem

- **Failure Scenario 1: Razorpay Webhook Race Condition**: Customer retries checkout while recovery is queued $\to$ *Resolved: Outcome Tracker pre-empts dispatch, saving customer annoyance and duplicate fees.*
- **Failure Scenario 2: WhatsApp Sandbox Timeout**: Network latency or Meta rate limit $\to$ *Resolved: Automatic fallback to Resend Email with zero duplicate sends.*
- **Failure Scenario 3: Ambiguous Behavioral Event**: Unclear invoice delay $\to$ *Resolved: LLM confidence threshold fallback; deterministic rules route to HITL review.*
