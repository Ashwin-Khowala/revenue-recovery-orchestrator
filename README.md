# ⚡ Revenue Recovery Intelligence Platform

> **Razorpay AI Buildathon — Track 3: AI Revenue Recovery**  
> *"Find revenue that's slipping away and win it back. Build an agent that detects revenue at risk, determines the right intervention, and executes a bounded recovery workflow: from payment failures and checkout abandonment to overdue receivables."*

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-Supervisor--Dispatcher-orange.svg)](https://langchain-ai.github.io/langgraph/)
[![Azure OpenAI](https://img.shields.io/badge/Azure_OpenAI-gpt--4o--mini-blueviolet.svg)](https://azure.microsoft.com/products/ai-services/openai-service)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748.svg)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E.svg)](https://supabase.com/)
[![Razorpay](https://img.shields.io/badge/Razorpay-Test_Mode_APIs-0C2340.svg)](https://razorpay.com/)
[![Langfuse](https://img.shields.io/badge/Langfuse-Traces_%26_Evals-000000.svg)](https://langfuse.com/)
[![Next.js](https://img.shields.io/badge/Next.js-Dashboard-black.svg)](https://nextjs.org/)

---

## 🎯 What This Is

Razorpay's Agent Studio provides individual recovery tools (Subscription Recovery, Abandoned Cart, Receivables, etc.). 

**This project builds the supervisory orchestration intelligence and memory platform that sits above every recovery scenario.** It enriches every at-risk event with a **4-tier behavioral memory architecture** (incorporating 54,000+ historical episodes across 2,000 customers), diagnoses *why* a transaction failed, computes the **Expected Value (EV)** across candidate interventions (including the mathematically justified decision to **"do nothing"**), enforces deterministic financial compliance guardrails, and safely executes bounded multi-channel recovery with Human-in-the-Loop (HITL) checkpoints and real-time webhook race-condition arbitration.

---

## 💡 Key Innovations & Out-of-the-Box Thinking

1. **4-Tier Stateful Behavioral Memory Layer**
   - Incorporates a database of **2,000 customer profiles**, **20 merchants**, and **54,779 historical episodes** (tracking past response times, preferred channels, and promise-to-pay accuracy).
   - Node 0 (`memory_enrichment`) pulls behavioral priors into the state *before* any LLM reasoning takes place.

2. **Separation of Reasoning & Financial Control**
   - Azure OpenAI is used for **root-cause disambiguation, customer intent reasoning, narrative context generation, and candidate generation**.
   - Money movement, ranking, and execution gates are strictly controlled by **deterministic EV calculation** and **hard-coded compliance guardrails**. The LLM never dispatches financial actions without verified deterministic checks.

3. **"Do Nothing" as a Scored Winning Strategy**
   - Indiscriminately messaging customers causes brand fatigue and churn. If a historically reliable customer (95%+ on-time payment track record) is 2 days late on an invoice, the friction penalty of contacting them exceeds the marginal recovery probability. The policy engine scores `do_nothing` as a first-class candidate and frequently picks it.

4. **Replay-Safe Human-in-the-Loop (HITL)**
   - Utilizes LangGraph's native `interrupt()` and `Command(resume=...)` pattern with PostgresSaver checkpoint persistence.
   - Built to respect LangGraph's replay semantics: the interrupt node is 100% pure with zero side-effects. All irreversible actions occur downstream in the `Executor` node after human authorization.
   - Merchant admins receive proactive real-time interactive Telegram alerts with Approve/Reject buttons before execution pause.

5. **Razorpay Webhook Race-Condition Arbitration**
   - In production payment systems, `payment.failed` is frequently followed seconds later by `payment.captured` as a customer independently retries.
   - The Orchestrator queues recovery actions with safe debounce delays. If a `payment.captured` webhook arrives before dispatch, the Outcome Tracker instantly cancels the queued outreach, registering exact **0 duplicate customer contacts**.

6. **Cryptographic SHA-256 Audit Chaining**
   - Every node transition, decision, and intervention is logged in an append-only SHA-256 cryptographic hash chain, enabling provable tamper-detection for compliance reporting.

---

## 📂 Repository Structure

```
revenue-recovery-orchestrator/
├── README.md                           # Project documentation & pitch summary
├── PROJECT_STATE.md                    # Master context, state & technical roadmap
├── ARCHITECTURE.md                     # Deep technical topology & state schema
├── EVALS.md                            # Benchmark methodology & results
├── AGENTS.md                           # Agent system conventions & invariants
├── prisma/
│   └── schema.prisma                   # Prisma Postgres relational schema
├── data/
│   ├── world_generator.py              # 5-layer synthetic universe generator
│   └── world.json                      # Seeded dataset (20M, 2000C, 54k episodes)
├── orchestrator/
│   ├── __init__.py
│   ├── state.py                        # RecoveryState TypedDict schema
│   ├── llm.py                          # AzureChatOpenAI configurable singleton
│   ├── graph.py                        # LangGraph StateGraph supervisor definition
│   ├── audit.py                        # SHA-256 hash-chained audit logger
│   ├── webhook.py                      # FastAPI webhooks & customer intelligence API
│   ├── memory/
│   │   ├── customer_memory.py          # Customer profile & episodic memory CRUD
│   │   └── merchant_memory.py          # Merchant policies & channel capacity
│   ├── nodes/
│   │   ├── memory_enrichment.py        # Node 0: Memory enrichment layer
│   │   ├── root_cause_classifier.py    # 6-class hybrid classifier
│   │   ├── policy_engine.py            # Deterministic EV calculator
│   │   ├── guardrails.py               # Deterministic compliance rules
│   │   ├── hitl.py                     # Replay-safe interrupt() handler
│   │   ├── executor.py                 # Multi-channel dispatcher & fallback
│   │   └── outcome_tracker.py          # Payment reconciliation & cancellation
│   └── channels/
│       ├── whatsapp.py                 # Meta Cloud API sandbox integration
│       ├── telegram_bot.py             # Proactive 2-way Telegram bot & HITL alerts
│       ├── email.py                    # Resend email channel integration
│       └── voice.py                    # Gemini Live / telephony voice flow
├── scripts/
│   ├── fast_seed.py                    # High-throughput batch database seeder
│   ├── seed_db.py                      # Full database seeder with direct psycopg2
│   └── seed_episodes.py                # 54k episode batch seeder
└── dashboard/                          # Next.js 14 Web Application
    ├── src/
    │   ├── app/
    │   │   ├── merchant/page.tsx       # Real-time merchant supervisory console
    │   │   └── merchant/customers/     # Customer intelligence profiles & episodes
    │   └── components/                 # Financial UI & interactive chatbot
```

---

## 🛠️ Quick Start & Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase Postgres Database (or PostgreSQL 15+)
- Azure OpenAI Service (or OpenAI API key)

### 2. Environment Setup
```bash
cp .env.example .env
# Fill in AZURE_OPENAI_API_KEY, SUPABASE_DB_URI, RAZORPAY_KEY_ID, TELEGRAM_BOT_TOKEN
```

### 3. Database Migration & Seeding
```bash
# Push Prisma schema to Postgres
npx prisma db push

# Fast batch seed (20 merchants, 2,000 customers, 550 events)
python scripts/fast_seed.py

# Seed 54,779 historical customer episodes
python scripts/seed_episodes.py
```

### 4. Start Full Platform
```bash
# In Unix/macOS or Git Bash
./start.sh
```
- **Backend Orchestrator API**: `http://localhost:8000`
- **Merchant Intelligence Console**: `http://localhost:3000/merchant`
- **Customer Intelligence Directory**: `http://localhost:3000/merchant/customers/merch_01`
