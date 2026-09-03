# Architecture — Revenue Recovery Intelligence Platform

## 1. System High-Level Topology: Durable Outer Loop + Reasoning Engine

The **Revenue Recovery Intelligence Platform** is architected around a fundamental separation of concerns:
1. **Durable Outer Workflow Engine (Temporal & Inngest)**: Owns the multi-day process lifecycle, durable timers (24h quiet windows, 3-day PTP pauses), retry backoff, webhook race-condition arbitration (`payment.captured` signals), and crash recovery across process restarts.
2. **Deterministic Reasoning Sub-Step (LangGraph + EV Engine)**: Owns failure root-cause classification (rules-first + LLM fallback), deterministic Expected Value (EV) calculation, and hard financial guardrails.
3. **Exact Structured Relational Memory (PostgreSQL via Prisma)**: Manages customer priors (54,779 historical episodes) and merchant contact policies using exact relational queries rather than fuzzy semantic vector recall.

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

## 2. State Schema (`RecoveryState`)

```python
class RecoveryState(TypedDict):
    event_id: str
    event_type: Literal[
        "subscription_failed",
        "checkout_abandoned",
        "receivable_overdue",
        "payment_degraded",
        "mandate_auth_failed",
        "promise_to_pay"
    ]
    amount: float
    currency: str
    merchant_id: str
    customer_id: str
    customer_name: str
    customer_email: str
    customer_phone: str
    created_at: str
    razorpay_ref: str | None
    
    # Customer context
    history: dict
    metadata: dict

    # 4-Tier Memory Layer (Node 0 output)
    customer_profile: dict | None        # Full profile from customer_profiles
    episodic_history: list[dict] | None  # Last N historical episodes
    merchant_policy: dict | None         # Merchant contact & escalation policy
    channel_capacity: dict | None        # Remaining daily slots per channel
    memory_context: str | None           # Plain-text narrative for LLM injection

    # Step 1: Root-Cause Classification Output
    root_cause: str | None
    confidence: float | None
    classification_reasoning: str | None
    candidate_actions: list[dict] | None
    
    # Step 2: Policy Engine (EV Calculation) Output
    chosen_action: dict | None
    expected_value: float | None
    ev_breakdown: dict | None
    
    # Step 3: Guardrail Validation
    guardrail_result: Literal["ALLOW", "ESCALATE", "BLOCK"] | None
    guardrail_rule_fired: str | None
    
    # Step 4: Execution & Channel Dispatches
    contact_count: int
    channel_used: Literal["whatsapp", "email", "telegram", "reroute", "scheduled_check", "none"] | None
    execution_result: dict | None
    
    # Step 6: Outcome Tracking & Webhook Reconciler
    payment_status: Literal["unresolved", "recovered", "cancelled_by_webhook", "failed"]
    recovered_amount: float
    recovered_at: str | None
    
    # Step 7: Audit Trail
    audit_trail: list[dict]
```

---

## 3. Mathematical Policy Formulation

For any event $E$ with amount $A$, and candidate action $a \in \mathcal{A}$:

$$\text{EV}(a) = P(\text{recovery} \mid a, E, \text{history}) \times A - C(a) - F(a, N_{\text{contacts}}) - R(a, A)$$

Where:
- $P(\text{recovery} \mid a, E, \text{history}) = \text{base\_prior}(a, \text{root\_cause}) \times f(\text{customer\_reliability}, \text{channel\_effectiveness})$
- $C(a)$: Direct execution cost (WhatsApp ₹0.80, Telegram ₹0.00, Email ₹0.05, API Reroute ₹0.00, Human review ₹50.00).
- $F(a, N_{\text{contacts}})$: Customer friction / annoyance penalty exponential in contact count ($F = \lambda \cdot N_{\text{contacts}}^2$).
- $R(a, A)$: Risk of churn/alienation on high amounts if contacted clumsily.

If $\text{EV}(\text{do\_nothing}) > \max_{a \neq \text{do\_nothing}} \text{EV}(a)$, the system intentionally remains silent.

---

## 4. API Endpoints

- `POST /api/orchestrator/process-event`: Trigger full recovery graph on a single event.
- `POST /api/orchestrator/resume-hitl`: Resume paused graph from human decision.
- `POST /api/webhooks/razorpay`: Razorpay webhook ingestion endpoint.
- `GET /api/customers/{customer_id}`: Full customer intelligence profile, episodic history, and AI behavioral overview.
- `GET /api/merchants/{merchant_id}/customers`: Paginated, risk-ranked customer directory.
- `GET /api/merchants/{merchant_id}/at-risk-summary`: Aggregated portfolio revenue risk summary.
- `POST /api/customers/{customer_id}/link-telegram`: Connect customer ID to Telegram `chat_id`.
- `WS /ws/gemini-live`: Real-time voice interaction WebSocket endpoint.
