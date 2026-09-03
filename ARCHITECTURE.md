# Architecture — Revenue Recovery Intelligence Platform

## 1. System High-Level Topology: Durable Outer Loop + Reasoning Engine

The **Revenue Recovery Intelligence Platform** is architected around a fundamental separation of concerns:
1. **Durable Outer Workflow Engine (Temporal & Inngest)**: Owns the multi-day process lifecycle, durable timers (24h quiet windows, 3-day PTP pauses), retry backoff, webhook race-condition arbitration (`payment.captured` signals), and crash recovery across process restarts.
2. **Deterministic Reasoning Sub-Step (LangGraph + EV Engine)**: Owns failure root-cause classification (rules-first + LLM fallback), deterministic Expected Value (EV) calculation, and hard financial guardrails.
3. **Exact Structured Relational Memory (PostgreSQL via Prisma)**: Manages customer priors (54,779 historical episodes) and merchant contact policies using exact relational queries rather than fuzzy semantic vector recall.

### Figure 1: End-to-End Recovery Platform Pipeline

```mermaid
flowchart TD
    %% ─────────────────────────────────────────────────────────────
    %% STAGE 1: INGESTION
    %% ─────────────────────────────────────────────────────────────
    subgraph S1["⚡ 1. Multi-Source Ingestion & Telemetry"]
        direction LR
        I1["Razorpay Webhooks<br/>(payment.failed, captured)"]
        I2["Checkout Drop-Off<br/>(15–60 min cart latency)"]
        I3["Subscriptions & Mandates<br/>(RBI >₹15k AFA declines)"]
        I4["B2B Overdue Invoices<br/>(Net-30/60 terms)"]
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 2: 4-TIER MEMORY LAYER
    %% ─────────────────────────────────────────────────────────────
    subgraph S2["🧠 2. 4-Tier Stateful Memory Layer (PostgreSQL + Sidecars)"]
        direction LR
        M1["Tier 1: Customer Profile<br/>(Reliability, Risk Score, Language)"]
        M2["Tier 2: 54,779 Episodes<br/>(Past Recovery Outcomes)"]
        M3["Tier 3: Merchant Policy<br/>(HITL Caps, Allowed Channels)"]
        M4["Tier 4: Omnichannel Consent<br/>(Global Opt-Outs, 7d Spacing)"]
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 3: DECISION ENGINE (LANGGRAPH)
    %% ─────────────────────────────────────────────────────────────
    subgraph S3["🤖 3. Supervisory Decision Engine (LangGraph 7-Node StateGraph)"]
        N0["Node 0: memory_enrichment<br/>(Pulls behavioral priors & policy)"]
        N1["Node 1: classify_root_cause<br/>(Hybrid: 30+ Error Rules + Azure OpenAI)"]
        N2["Node 2: score_policy_options<br/>(Deterministic EV Engine + 'Do Nothing' Scored)"]
        N3{"Node 3: check_guardrails<br/>(₹1L Ceiling • 2-Contact Max • 24h Cooldown)"}
        
        N5["Node 5: hitl_escalation<br/>(Telegram Alert -> LangGraph interrupt())"]
        N4["Node 4: execute_action<br/>(Pre-Send Race Check -> Dispatch Link)"]
        N6["Node 6: outcome_tracker<br/>(Razorpay Webhook Reconciler & Dedup Arbitrator)"]

        N0 --> N1 --> N2 --> N3
        N3 -- "ALLOW" --> N4
        N3 -- "ESCALATE (≥ ₹1,00,000)" --> N5
        N3 -- "BLOCK" --> N4
        N5 -. "Admin Approve / Reject<br/>Command(resume=True)" .-> N4
        N4 --> N6
    end

    %% ─────────────────────────────────────────────────────────────
    %% STAGE 4: EXECUTION & CONTROL SURFACES
    %% ─────────────────────────────────────────────────────────────
    subgraph S4["🚀 4. Multi-Channel Execution & Control Surfaces"]
        direction LR
        CH_WA["💬 WhatsApp Utility<br/>(1-Click Checkout Link)"]
        CH_EM["📧 Resend Email API<br/>(Transactional Invoice)"]
        CH_VOICE["📞 Plivo AI Telephony<br/>(Hinglish Recovery Call)"]
        CH_REROUTE["🔀 Silent Gateway Reroute<br/>(Zero Customer Contact)"]
    end

    subgraph S5["🔐 5. Cryptographic Audit & Merchant Surfaces"]
        direction LR
        AUDIT["🔐 SHA-256 Chained Ledger<br/>(entry_hash = SHA256(prev + data))"]
        DASH["🖥️ Next.js Merchant Dashboard<br/>(Live Case Files • Policy Optimizer)"]
        VOICE_COPILOT["🎙️ Gemini Live Copilot<br/>(Multilingual Voice Supervisor)"]
    end

    %% Pipeline Flow
    S1 ==> S2
    S2 ==> N0
    N4 ==> S4
    N6 ==> S5

    classDef stageStyle fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef nodeStyle fill:#1e293b,stroke:#38bdf8,stroke-width:1.5px,color:#f8fafc;
    classDef gateStyle fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#f8fafc;
    classDef hitlStyle fill:#451a03,stroke:#f97316,stroke-width:2px,color:#fed7aa;
    classDef execStyle fill:#064e3b,stroke:#10b981,stroke-width:1.5px,color:#ecfdf5;
    classDef auditStyle fill:#2e1065,stroke:#a855f7,stroke-width:1.5px,color:#f3e8ff;

    class S1,S2,S3,S4,S5 stageStyle;
    class N0,N1,N2,N6 nodeStyle;
    class N3 gateStyle;
    class N5 hitlStyle;
    class N4,CH_WA,CH_EM,CH_VOICE,CH_REROUTE execStyle;
    class AUDIT,DASH,VOICE_COPILOT auditStyle;
```

### Figure 2: Webhook Race-Condition Arbitration Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Customer as 👤 Customer
    participant Gateway as 🏦 Razorpay Gateway
    participant Ingestion as ⚡ Event Ingestion
    participant Queue as 🛡️ Active Recovery Queue
    participant Engine as 🤖 LangGraph Engine
    participant Channel as 💬 WhatsApp / Email
    participant Ledger as 🔐 SHA-256 Ledger

    Note over Ingestion,Engine: T0: Payment Fails
    Gateway->>Ingestion: webhook: payment.failed (evt_001)
    Ingestion->>Queue: Register pending recovery action (evt_001)
    Ingestion->>Engine: Run recovery graph (classify -> score EV -> guardrails)
    
    rect rgb(30, 41, 59)
        Note over Customer,Gateway: RACE CONDITION: Customer self-serves or retries organically
        Customer->>Gateway: Successful Payment Checkout (order_synth_001)
        Gateway->>Ingestion: webhook: payment.captured (order_synth_001)
        Ingestion->>Queue: cancel_pending_action(order_synth_001)
        Queue-->>Ingestion: Status: CANCELLED (0 duplicate contacts)
    end

    Note over Engine,Channel: Pre-Send Race Check
    Engine->>Queue: is_action_still_pending(evt_001)?
    Queue-->>Engine: False (Captured prior to outreach)
    Engine->>Ledger: log_audit_entry("PRE_SEND_RACE_CANCELLED", duplicate_count=0)
    Note over Engine,Channel: Outreach aborted; customer never spammed
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
