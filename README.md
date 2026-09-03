# ⚡ Razorpay Revenue Recovery Orchestrator

> **Track 3: AI Revenue Recovery** — Supervisory decision engine that governs cart drop-offs, subscription declines, B2B overdue receivables, and RBI >₹15,000 mandates.

---

## 📊 Measured Benchmark (`evals/labeled_holdout.json`, 150 events, ₹97,50,738.00 at risk)

*Recovered ₹ in benchmark reflects simulated conversion thresholds ($P \ge 0.40$). Real money movement is verified separately in Razorpay Test Mode checkout verification.*

| Metric | Arm 0 (Organic) | Arm 1 (Naive Blast) | Arm 2 (Rule-Based Engine) | Arm 3 (AI Orchestrator) |
|---|---|---|---|---|
| **Gross Simulated ₹** | ₹19,45,253.00 (19.95%) | ₹55,43,558.00 (56.85%) | ₹66,60,365.00 (68.31%) | **₹32,62,834.00 (33.46%)** |
| **Incremental vs Organic** | ₹0.00 (Baseline) | ₹35,98,305.00 | ₹47,15,112.00 | **+₹13,17,581.00** |
| **Outreach Contacts Sent** | 0 (Zero Contact) | 150 | 113 | **39 (65% Less Customer Noise)** |
| **Duplicate Breaches** | 0 | 24 | 17 | **0 (Guaranteed 0)** |
| **Human Escalations (HITL)**| 0 (No Gates) | 0 (No Gates) | 0 (No Gates) | **27 (18.00% Paused)** |
| **Channel / API Cost** | ₹0.00 | ₹120.00 | ₹74.65 | **₹35.25** |

> 💡 **Why Rule-Based Engines Show Higher Gross ₹ (and why that's deceptive):**
> Dumb rule engines recover more gross ₹ simply because they have **zero safety gates**: they blast every high-value enterprise customer without authorization and rack up **17 duplicate contact breaches** violating the 24h quiet window.
> The AI Orchestrator is **compliance-gated**: it achieves **+₹13.18L incremental recovery** with **65% less customer noise (39 contacts vs 113)**, **guarantees 0 duplicate contacts**, and safely holds 27 high-value accounts ($\ge \text{₹1,00,000}$) for human review.
> When human admins sign off on high-value escalations, the **counterfactual recovery rises to ₹67,67,454.00 (69.40%)** with **zero compliance risk**.

---

## 🛡️ Core Invariants

1. **Deterministic EV Engine**: Computes Net Expected Value ($EV = P \cdot A - C - F - R$); scores *do nothing* as a first-class candidate.
2. **Hard Guardrails**: ₹1,00,000 HITL cap, 2-contact maximum, and 24-hour quiet window via persistent sidecar throttler.
3. **Webhook Race Arbitration**: Active queue cancels pending outreach immediately upon receiving `payment.captured` (0 duplicate spam).
4. **Cryptographic SHA-256 Audit**: Append-only hash-chained ledger verifying every decision.

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    %% =========================================================================
    %% 1. INGESTION & EVENT SOURCES
    %% =========================================================================
    subgraph INGESTION["1. Multi-Source Ingestion & Failure Telemetry"]
        E1["⚡ Razorpay Webhooks<br/>(payment.failed, order.paid, captured)"]
        E2["🛒 Checkout Drop-Off Telemetry<br/>(15-60 min step latency, form errors)"]
        E3["🔄 Subscription Failures<br/>(RBI >₹15,000 AFA, mandate decline)"]
        E4["📑 B2B Receivables<br/>(Net-30/60 overdue corporate invoices)"]
        E5["🤝 Promise-to-Pay (PTP)<br/>(Customer payment commitments)"]
    end

    %% =========================================================================
    %% 2. DURABLE WORKFLOW OUTER LOOP
    %% =========================================================================
    subgraph DURABLE["2. Durable Orchestration Loop (Temporal SDK & Inngest)"]
        WF["⚙️ RevenueRecoveryWorkflow<br/>(Multi-Day Saga & Crash Recovery)"]
        TIMER["⏳ Durable Timers<br/>(24h quiet spacing, 72h PTP pause)"]
        RACE_QUEUE["🛡️ Persistent Arbitration Queue<br/>(pending_recovery_queue.json)"]
    end

    %% =========================================================================
    %% 3. 4-TIER STATEFUL RELATIONAL MEMORY
    %% =========================================================================
    subgraph MEMORY["3. 4-Tier Stateful Relational Memory Layer (Postgres + Sidecars)"]
        T1["👤 Tier 1: Customer Profile<br/>(Reliability Score, Default Risk, Preferred Channel)"]
        T2["📚 Tier 2: 54,779 Historical Episodes<br/>(Past Recovery Outcomes, Average Days Late)"]
        T3["🏢 Tier 3: Merchant Contact Policies<br/>(Custom HITL Cap, Allowed Channels, Max Touches)"]
        T4["🔕 Tier 4: Omnichannel Consent & DND<br/>(Global Opt-Outs, 7-Day Cross-Track Spacing)"]
    end

    %% =========================================================================
    %% 4. LANGGRAPH SUPERVISORY DECISION GRAPH (7 NODES)
    %% =========================================================================
    subgraph GRAPH["4. Supervisory AI Decision Engine (LangGraph StateGraph)"]
        direction TB

        N0["Node 0: memory_enrichment<br/>• Pulls Customer Profile & 54k History<br/>• Retrieves Merchant Contact Policy<br/>• Synthesizes Memory Context Narrative"]

        N1["Node 1: classify_root_cause<br/>• PII Redaction Engine (PAN, Card, Phone, Email)<br/>• 30+ Code Deterministic Decline Taxonomy<br/>• Azure OpenAI gpt-4o-mini Fallback<br/>• Output: 1 of 6 Root-Cause Classes"]

        N2["Node 2: score_policy_options<br/>• Deterministic Mathematical EV Engine<br/>• EV = P(rec|hist) × Amount - Cost - Friction - Risk<br/>• 'Do Nothing' Scored as 1st-Class Decision"]

        N3{"Node 3: check_guardrails<br/>Enforces 8 Compliance Invariants:<br/>1. ₹1,00,000 High-Value Threshold<br/>2. Max 2 Contacts per Incident<br/>3. 24h Quiet Window (CrossTrackThrottler)<br/>4. Bank Degradation -> 0 Customer Noise<br/>5. Omnichannel Permanent Opt-Out<br/>6. Voluntary Churn Dunning Kill-Switch<br/>7. Dispute Isolation<br/>8. TRAI Voice Hours (09:00 - 21:00 IST)"}

        N5["Node 5: hitl_escalation<br/>• Interactive Telegram Alert to Merchant Admin<br/>• LangGraph interrupt() Pauses Thread<br/>• Awaits Admin Approve / Reject Signal<br/>• Replay-Safe Resumption"]

        N4["Node 4: execute_action<br/>• Pre-Send Webhook Race Check<br/>• WhatsApp Dispatch (Razorpay Link)<br/>• Failover to Resend Transactional Email<br/>• Plivo AI Telephony (Hinglish)<br/>• Silent Infrastructure Route Reroute"]

        N6["Node 6: outcome_tracker<br/>• Razorpay Webhook Reconciler<br/>• Dedup Arbitrator (0 Duplicate Guarantee)<br/>• Counterfactual Attribution (P >= 0.40)"]

        %% Graph Edges
        N0 --> N1
        N1 --> N2
        N2 --> N3
        N3 -- "ALLOW" --> N4
        N3 -- "ESCALATE (>= ₹1L)" --> N5
        N3 -- "BLOCK (Quiet/Opt-Out)" --> N4
        N5 -. "Command(resume=True)" .-> N4
        N4 --> N6
    end

    %% =========================================================================
    %% 5. EXECUTION CHANNELS & INFRASTRUCTURE
    %% =========================================================================
    subgraph CHANNELS["5. Multi-Channel Execution & Payment Settlement"]
        CH_WA["💬 WhatsApp Utility Template<br/>(Direct Smart Resume Link)"]
        CH_EM["📧 Resend Email API<br/>(Fallback Transactional Invoice)"]
        CH_VOICE["📞 Plivo Voice Telephony<br/>(Conversational Hinglish Call)"]
        CH_REROUTE["🔀 Gateway Silent Switch<br/>(Zero-Contact HDFC/ICICI Route)"]
        CH_RZP["💳 Razorpay Test Mode API<br/>(plink_... Authentic Checkout Links)"]
    end

    %% =========================================================================
    %% 6. CRYPTOGRAPHIC AUDIT & OBSERVABILITY
    %% =========================================================================
    subgraph AUDIT["6. Cryptographic Audit Trail & Observability"]
        LEDGER["🔐 SHA-256 Chained Hash Ledger<br/>(entry_hash = SHA256(prev_hash + data))<br/>data/audit_ledger.json + Supabase DB"]
        LANGFUSE["🔭 Langfuse Cloud Tracing<br/>(Node Latency, Token Usage, Cost)"]
        EXCEPTIONS["📋 evals/exceptions.json<br/>(Structured Non-Recovery Audit Cases)"]
    end

    %% =========================================================================
    %% 7. CONTROL SURFACES & FRONTENDS
    %% =========================================================================
    subgraph UI["7. Merchant & Operator Control Surfaces"]
        DASH["🖥️ Next.js 14 Merchant Dashboard<br/>(/merchant • At-Risk Summary • 3-Block Case File)"]
        OPTIMIZER["🎛️ Dynamic Policy Optimizer<br/>(/merchant/optimizer • Live EV Sliders)"]
        COPILOT["🎙️ Gemini Live Multilingual Voice Copilot<br/>(English / Hindi / Hinglish • Live Tools)"]
        TELEGRAM["📱 Telegram Operations Center<br/>(Merchant Alerts & Two-Way Approval)"]
    end

    %% =========================================================================
    %% SYSTEM-WIDE FLOW CONNECTIONS
    %% =========================================================================
    INGESTION --> WF
    WF --> RACE_QUEUE
    WF --> N0

    MEMORY <--> N0
    MEMORY <--> N1
    MEMORY <--> N3

    N4 --> CHANNELS
    CHANNELS --> CH_RZP
    CH_RZP -. "payment.captured webhook" .-> RACE_QUEUE
    RACE_QUEUE -. "Pre-send Cancel" .-> N4

    %% Cross-cutting audit logging
    N0 -. "log_audit_entry" .-> LEDGER
    N1 -. "log_audit_entry" .-> LEDGER
    N2 -. "log_audit_entry" .-> LEDGER
    N3 -. "log_audit_entry" .-> LEDGER
    N4 -. "log_audit_entry" .-> LEDGER
    N5 -. "log_audit_entry" .-> LEDGER
    N6 -. "log_audit_entry" .-> LEDGER
    N6 --> EXCEPTIONS

    GRAPH -. "Traces" .-> LANGFUSE
    N6 --> WF
    WF --> DASH
    DASH <--> COPILOT
    N5 <--> TELEGRAM
    DASH <--> OPTIMIZER
```

---

## 🚀 Quickstart & Verification

```bash
pip install -r requirements.txt
python evals/run_batch.py                       # 4-arm benchmark + exceptions.json
python scripts/verify_razorpay_testmode_race.py # Real Razorpay Test Mode race test
pytest tests -v                                 # Unit & stopping rule suite
```
