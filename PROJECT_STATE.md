# ⚡ Revenue Recovery Intelligence Platform — Master Context & State

> **Razorpay AI Buildathon — Track 3: AI Revenue Recovery**  
> **Project Goal**: Build an autonomous, supervisory revenue recovery platform that detects at-risk transactions, reasons with 4-tier behavioral memory, calculates deterministic Expected Value (EV), enforces strict financial compliance guardrails, and safely executes multi-channel recovery workflows with Human-in-the-Loop (HITL) checkpoints and tamper-evident audit logging.

---

## 1. Problem Statement & The Real-World Gap

### The Macro Problem
Every year, over **$80B+ in transaction volume** is lost globally due to failed payments, RBI mandate friction, B2B net-terms defaults, and checkout drop-offs. In India's high-velocity digital economy, this is compounded by:
- Recurring mandate compliance (>₹15,000 RBI Additional Factor Authentication rules).
- Gateway and bank server route degradation (>30% intermittent failure spikes).
- High-intent cart abandonment where indiscriminate discounting destroys margins.
- B2B overdue receivables where heavy-handed collections alienate VIP enterprise clients.

### Why Existing Solutions Fail ("The Naive Spam Trap")
Most existing recovery tools operate as **dumb retry crons** or **indiscriminate spam bots**:
1. **Brand Fatigue & Churn**: They bombard every customer with generic WhatsApp/SMS nudges. If a high-reliability customer (95%+ on-time payment track record) is 1 day late, aggressive messaging annoys them and destroys lifetime value (LTV).
2. **Contacting Customers on Infrastructure Faults**: When HDFC/SBI gateway routes degrade, blasting customers to "retry payment" wastes money and causes confusion when the fault is purely upstream.
3. **Agent Theater & Uncontrolled LLMs**: Wrapping an LLM in a loose prompt and letting it decide financial actions creates hallucination risks, unauthorized discounts, and duplicate contacts.
4. **Lack of Behavioral Memory**: Systems treat every failure as day-zero without knowing if a customer responds best to WhatsApp, honors promise-to-pay dates, or prefers Hindi.

---

## 2. Our Solution: Revenue Recovery Intelligence Platform

We have engineered an **enterprise-grade, stateful financial agent system** built on the principle of **Separation of Reasoning & Financial Control**:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               MULTI-CHANNEL INGESTION & OUTREACH                                 │
│          Razorpay Webhooks  •  WhatsApp API  •  Telegram Bot  •  Resend Email  •  Voice          │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                         LANGGRAPH SUPERVISORY ORCHESTRATOR PIPELINE                              │
│                                                                                                  │
│  [Node 0: memory_enrichment] ──► Pulls Customer Profile, 54k History, Policies, Channel Stats    │
│            │                                                                                     │
│            ▼                                                                                     │
│  [Node 1: classify_root_cause] ──► 6-Class Taxonomy (Hybrid Rule Engine + Azure OpenAI)          │
│            │                                                                                     │
│            ▼                                                                                     │
│  [Node 2: score_policy_options] ─► Deterministic Expected Value (EV) with "Do Nothing" Scored   │
│            │                                                                                     │
│            ▼                                                                                     │
│  [Node 3: check_guardrails] ────► Hard Financial Invariants (₹1L Cap, 2-Contact Max, 24h Dedup) │
│            │                                                                                     │
│      ┌─────┴─────────────────┐                                                                   │
│      │ ALLOW                 │ ESCALATE                                                          │
│      ▼                       ▼                                                                   │
│  [Node 4: execute_action]   [Node 5: hitl_escalation] ──► Proactive Telegram Alert + interrupt()│
│      │                               │ (resume via Command)                                      │
│      └──────────────┬────────────────┘                                                           │
│                     ▼                                                                            │
│  [Node 6: outcome_tracker] ─────► Razorpay Webhook Race Arbitrator & Dedup Tracker (Zero Dupes) │
│            │                                                                                     │
│            ▼                                                                                     │
│  [Node 7: write_audit_entry] ───► SHA-256 Tamper-Evident Hash Chain + Supabase + Langfuse Cloud  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Architectural Pillars

### A. 4-Tier Memory Layer (Prisma + Supabase Postgres)
1. **Entity Layer (`merchants`)**: Merchant industry profile, average invoice size, daily limits per channel, custom contact policies, and escalation rules.
2. **Profile Layer (`customer_profiles`)**: Stable identity (`cust_0001` to `cust_2000`), payment reliability score ($[0, 1]$), risk score, preferred channel, native language (English, Hindi, Hinglish, Tamil, Bengali), and historical promise accuracy.
3. **Episodic Layer (`customer_episodes`)**: **54,779 historical episodes** recording past failures, outreach channels, response delays in hours, promise kept/broken outcomes, and payment recoveries.
4. **Operational Registry (`telegram_chats`, `merchant_users`)**: Live mapping of customer phones/IDs and merchant admins to Telegram `chat_id`s for two-way proactive interactions.

### B. 6-Class Root Cause Schema
1. `payment_degraded`: Bank route or gateway degradation (>30% failure rate). **Action**: Silent secondary gateway reroute. Customer is NEVER contacted (Zero friction).
2. `mandate_auth_failed`: RBI recurring mandate > ₹15,000 missing AFA. **Action**: 1-click mandate consent re-auth link via WhatsApp/Telegram.
3. `subscription_failed`: Recurring card/mandate soft decline or balance limit. **Action**: Dynamic Razorpay payment link with smart retry sequencer.
4. `checkout_abandoned`: High-intent cart drop-off (15-60 min window). **Action**: Model on-time history. High-reliability customers get `do_nothing`; others get dynamic 1-5% micro-incentive.
5. `receivable_overdue`: B2B overdue invoice with net terms analysis. **Action**: Progressive escalation based on payment track record.
6. `promise_to_pay`: Customer agreed to pay on a specific date ($T_{\text{promised}}$). **Action**: Suspend all outreach; schedule auto-recheck at $T_{\text{promised}} + 24\text{h}$.

### C. Mathematical Policy Formulation (Expected Value)
For any candidate intervention $a \in \mathcal{A}$ on event $E$ with amount $A$:

$$\text{EV}(a) = P(\text{recovery} \mid a, \text{history}) \times A - C(a) - F(a, N_{\text{contacts}}) - R(a, A)$$

- **`do_nothing` as a First-Class Scored Decision**: If $EV(\text{do\_nothing}) > \max_{a} EV(a)$, the engine intentionally stays silent, preventing brand damage on natural payers.
- $F(a, N)$: Exponential customer friction penalty ($\lambda \cdot N_{\text{contacts}}^2$).
- $C(a)$: Direct execution cost (WhatsApp ₹0.80, Email ₹0.05, API Reroute ₹0.00, Human ₹50.00).

### D. Hard Financial Guardrails & Replay-Safe HITL
- **Amount Authorization Cap**: Any action on amounts $\ge \text{₹1,00,000}$ triggers mandatory human approval (`ESCALATE`).
- **Max Contact Rule**: Never exceed 2 customer outreach attempts per incident.
- **Dedup Rule**: Enforce a strict 24-hour quiet period across channels for identical `customer_id`.
- **Zero Duplicate Contacts Guarantee ($= 0$)**: If an out-of-order `payment.captured` webhook arrives while recovery is pending, the action is cancelled instantly.
- **Replay-Safe LangGraph `interrupt()`**: The HITL node sends a Telegram interactive alert (Approve/Reject) to the merchant *before* calling `interrupt()`, keeping the node functional and safe for resumption.

### E. Tamper-Evident Audit Hash Chain
Every decision, rule execution, and outcome is logged with a cryptographic SHA-256 hash:
$$\text{Hash}_n = \text{SHA256}(\text{Hash}_{n-1} \parallel \text{EventID} \parallel \text{Timestamp} \parallel \text{StateDiff} \parallel \text{Action})$$
The `verify_audit_chain()` utility mathematically validates audit integrity.

---

## 4. Current State & Completed Deliverables

| Component | Status | Details |
|---|---|---|
| **Prisma DB Schema** | ✅ Complete | Tables: `merchants`, `merchant_users`, `customer_profiles`, `customer_episodes`, `events`, `audit_entries`, `telegram_chats`, `evaluation_runs`. Pushed to Supabase Postgres. |
| **5-Layer Synthetic World** | ✅ Complete | Generated & seeded into Supabase: **20 Merchants**, **2,000 Customer Profiles**, **54,779 Historical Episodes**, **550 Events** (500 base + 50 adversarial edge cases). |
| **4-Tier Memory Layer** | ✅ Complete | `orchestrator/memory/` module + `memory_enrichment` Node 0 in LangGraph graph. Enriches customer priors before LLM execution. |
| **Proactive Telegram Bot** | ✅ Complete | Rewritten `telegram_bot.py` with `send_recovery_message()` (resolves `chat_id` from DB to proactively initiate outreach) & `send_hitl_alert_to_merchant()` (interactive Approve/Reject buttons). |
| **Audit Hash Chain** | ✅ Complete | SHA-256 chaining implemented in `orchestrator/audit.py` with tamper verification function. |
| **Backend REST APIs** | ✅ Complete | `GET /api/customers/:id` (AI behavioral overview, risk signals, episodes), `GET /api/merchants/:id/customers` (paginated risk list), `GET /api/merchants/:id/at-risk-summary`, `POST /api/customers/:id/link-telegram`. |
| **Merchant Dashboard** | ✅ Complete | Built in Next.js 14 (`/merchant`, `/merchant/customers/[merchantId]`, `/merchant/customers/[merchantId]/[customerId]`) featuring AI risk overviews, channel bars, and episode timelines. |

---

## 5. Next Steps & Target Roadmap

### 🎯 Phase 5: Voice Chat & Gemini Live System
1. **Gemini Live WebSocket Overhaul (`orchestrator/webhook.py`)**:
   - Replace brittle voice handlers with a robust bidirectional Gemini Live API WebSocket connection conforming to Google's official Live API specs.
2. **Real Function-Calling & Data Tools**:
   - Equip the Live Voice Agent with structured tools to query live customer memory:
     - `get_customer_payment_history(customer_id)`
     - `get_outstanding_invoice(invoice_id)`
     - `get_merchant_daily_metrics(merchant_id)`
     - `schedule_promise_to_pay(customer_id, date, amount)`
3. **Multilingual & Tone Adaptation**:
   - Real-time language matching (English, Hindi, Hinglish) matching customer profile preferences.
4. **Role-Separated Voice Portals**:
   - **Merchant Voice Assistant**: Real-time voice query tool for merchants ("What is my total at-risk revenue today? Why did customer X fail?").
   - **Payer Voice Interaction**: Seamless voice payment assistance & promise-to-pay negotiation with speech-to-text mic options.

### 🎯 Phase 6: Portfolio Optimizer & Real-Time Analytics
- Build interactive portfolio-level visualization in the Next.js dashboard displaying at-risk distribution, root-cause pie breakdowns, and real-time recovered revenue counters.

### 🎯 Phase 7: Evaluation Framework & Multi-Model Benchmark
- Benchmark `gpt-4o-mini` vs `gpt-4o` vs `Rule-based` vs `Naive Blast` across the 550 seeded test cases.
- Integrate DeepEval / G-Eval for factual consistency and reasoning quality.
