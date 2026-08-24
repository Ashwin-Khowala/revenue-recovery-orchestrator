# Architecture — Revenue Recovery Orchestrator

## 1. System High-Level Topology

The **Revenue Recovery Orchestrator** is built as an intelligent supervisory layer above transactional payment systems. Rather than relying on rigid, one-size-fits-all retry cron jobs or spammy messaging bots, it treats revenue loss as a diagnostic and expected-value optimization problem.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   INGESTION & RISK DETECTION LAYER                     │
│  Razorpay Test Mode Webhooks (Real API) + Synthetic Batch Generator    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Event Object
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               LANGGRAPH SUPERVISOR-DISPATCHER PIPELINE                 │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ 1. ROOT-CAUSE CLASSIFIER (Hybrid Rule Engine + Azure OpenAI)   │   │
│   │    • Evaluates failure telemetry, historical payment reliability│   │
│   │    • Categorizes into 1 of 6 distinct root-cause taxonomies    │   │
│   │    • Emits: root_cause, confidence, candidate_actions          │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ 2. DETERMINISTIC POLICY ENGINE (Expected Value Ranking)        │   │
│   │    • Calculates Net EV = P(rec) × Amount - Cost - Friction - Risk│   │
│   │    • "do_nothing" is a first-class scored candidate            │   │
│   │    • Emits: ranked action list with mathematical justification │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ 3. DETERMINISTIC GUARDRAIL VALIDATION                          │   │
│   │    • Amount ceiling thresholds (> ₹1,00,000 -> Escalate)       │   │
│   │    • 2-contact maximum limit per incident                      │   │
│   │    • 24h anti-spam quiet window per customer                   │   │
│   │    • Payment degradation -> strict zero customer contact rule  │   │
│   │    • Emits: "ALLOW" | "ESCALATE" | "BLOCK"                     │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│                   ┌───────────────┴───────────────┐                    │
│                   │ "ALLOW"                       │ "ESCALATE"         │
│                   ▼                               ▼                    │
│   ┌───────────────────────────────┐ ┌──────────────────────────────┐   │
│   │ 4. EXECUTION DISPATCHER       │ │ 5. HITL ESCALATION NODE      │   │
│   │    • Primary: WhatsApp API    │ │    • LangGraph interrupt()   │   │
│   │    • Fallback: Resend Email   │ │    • Replay-safe pure state  │   │
│   │    • Infra: Route Reroute/AFA │ │    • Resumes on human Command│   │
│   └───────────────┬───────────────┘ └──────────────┬───────────────┘   │
│                   │                                │                   │
│                   └───────────────┬────────────────┘                   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ 6. OUTCOME TRACKER & RACE CONDITION ARBITRATOR                 │   │
│   │    • Listens for out-of-order Razorpay captured webhooks       │   │
│   │    • Cancels queued interventions if payment clears early      │   │
│   │    • Enforces exact 0 duplicate contacts                       │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ 7. AUDIT TRAIL & TRACING (Supabase + Langfuse)                 │   │
│   │    • Persists every node decision, rule match, and state diff  │   │
│   └────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               PRESENTATION & BENCHMARKING (Next.js Dashboard)          │
│   Overview • At-Risk Revenue • Recovery Runs • Audit Log • Evals       │
└────────────────────────────────────────────────────────────────────────┘
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
    
    # Customer behavioral context
    history: dict  # { prior_contacts, prior_payment_success_rate, customer_avg_days_late }
    metadata: dict # failure specifics (e.g. failure_bank, mandate_amount, cart_items)

    # Agent reasoning output
    root_cause: str | None
    confidence: float | None
    classification_reasoning: str | None
    candidate_actions: list[dict] | None
    
    # Deterministic policy output
    chosen_action: dict | None
    expected_value: float | None
    ev_breakdown: dict | None
    
    # Guardrails
    guardrail_result: Literal["ALLOW", "ESCALATE", "BLOCK"] | None
    guardrail_rule_fired: str | None
    
    # Execution & Channel results
    contact_count: int
    channel_used: Literal["whatsapp", "email", "reroute", "scheduled_check", "none"] | None
    execution_result: dict | None
    
    # Outcome tracking & Webhook reconciler
    payment_status: Literal["unresolved", "recovered", "cancelled_by_webhook", "failed"]
    recovered_amount: float
    recovered_at: str | None
    
    # Audit trail
    audit_trail: list[dict]
```

---

## 3. Mathematical Policy Formulation

For any event $E$ with amount $A$, and candidate action $a \in \mathcal{A}$:

$$\text{EV}(a) = P(\text{recovery} \mid a, E) \times A - C(a) - F(a, N_{\text{contacts}}) - R(a, A)$$

Where:
- $P(\text{recovery} \mid a, E) = \text{base\_prior}(a, \text{root\_cause}) \times f(\text{customer\_history})$
- $C(a)$: Direct execution cost (WhatsApp ₹0.80, Email ₹0.05, API Reroute ₹0.00, Human ₹50.00).
- $F(a, N_{\text{contacts}})$: Customer friction / annoyance penalty exponential in contact count ($F = \lambda \cdot N_{\text{contacts}}^2$).
- $R(a, A)$: Risk of churn/alienation on high amounts if contacted clumsily.

If $\text{EV}(\text{do\_nothing}) > \max_{a \neq \text{do\_nothing}} \text{EV}(a)$, the system intentionally remains silent.

---

## 4. Replay-Safe HITL Pattern with LangGraph

When `check_guardrails` outputs `"ESCALATE"`, the state transitions to `hitl_escalation`:

```python
def hitl_escalation(state: RecoveryState) -> dict:
    """
    Pure node: Pauses graph using LangGraph interrupt().
    On resumption via Command(resume=decision), the node re-executes.
    Zero side-effects occur here.
    """
    decision = interrupt({
        "event_id": state["event_id"],
        "amount": state["amount"],
        "root_cause": state["root_cause"],
        "chosen_action": state["chosen_action"],
        "reason": state["guardrail_rule_fired"]
    })
    return {"chosen_action": decision.get("approved_action", state["chosen_action"])}
```

---

## 5. Webhook Race-Condition Handler

1. Razorpay fires `payment.failed` $\to$ Orchestrator diagnoses and queues WhatsApp reminder for $T+60\text{s}$.
2. Customer re-attempts checkout on their own mobile device before $T+60\text{s}$ expires.
3. Razorpay fires `payment.captured`.
4. The Webhook Receiver updates the shared memory record in Supabase and signals the Outcome Tracker.
5. The pending WhatsApp job is cancelled safely before dispatch.
6. The audit log registers: `"Action cancelled: Payment captured proactively. Duplicate customer contact averted."`
