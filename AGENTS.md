# AGENTS.md — Revenue Recovery Orchestrator Agent System Guidelines

## System Overview

The **Revenue Recovery Orchestrator** is an enterprise-grade, supervisory
decision engine designed for Razorpay AI Buildathon (Track 3: AI Revenue
Recovery). It proactively detects at-risk revenue (degraded payment routes,
checkout drop-offs, failed subscriptions, overdue B2B receivables, RBI >₹15,000
mandate failures, and promise-to-pay commitments), computes Expected Value (EV)
across candidate recovery interventions, enforces deterministic financial
guardrails, and safely executes multi-channel actions with Human-in-the-Loop
(HITL) escalation.

---

## Architectural Principles & Agent Philosophy

1. **Separation of Reasoning & Financial Control**
   - LLMs are used exclusively for **classification disambiguation, intent
     reasoning, and candidate intervention synthesis**.
   - Money movement, ranking, and execution gates are strictly controlled by
     **deterministic EV calculation** and **hard-coded compliance guardrails**.
   - An LLM never directly dispatches an unverified financial transaction or
     un-gated customer message.

2. **"Do Nothing" as a First-Class Scored Decision**
   - Many recovery tools spam customers indiscriminately, causing brand fatigue
     and high friction penalties.
   - The policy engine models customer behavioral priors: if a customer with a
     95% on-time payment track record is 2 days late, `do_nothing` frequently
     yields the highest net expected value
     ($EV = P(\text{recovery}) \times \text{amount} - \text{friction}$).

3. **Replay-Safe Human-in-the-Loop (HITL)**
   - LangGraph `interrupt()` pauses execution when an action exceeds
     authorization boundaries (e.g. amount > ₹1,00,000 or high risk).
   - Because LangGraph re-executes the interrupted node from the beginning on
     resumption via `Command(resume=...)`, the interrupt node must remain purely
     functional (no external DB writes, API calls, or side effects). All
     real-world actions are strictly isolated to the downstream `Executor` node.

4. **Race-Condition-Resilient Outcome Tracking**
   - Real-world payment systems experience out-of-order webhooks:
     `payment.failed` followed immediately by `payment.captured`.
   - The Orchestrator registers pending recovery actions in an active queue. If
     a `payment.captured` webhook or customer self-service payment arrives
     before execution, the outcome tracker instantly cancels the pending
     intervention and marks zero duplicate contacts in the audit log.

5. **Model-Agnostic Empirical Benchmark**
   - The evaluation framework benchmarks multiple Azure OpenAI deployments
     (`gpt-4o-mini`, `gpt-4o`, etc.) per node against Naive and Rule-based
     baselines.

---

## Graph Topology & Node Responsibilities

```
[Event Ingestion] 
       │
       ▼
[classify_root_cause] ─── (Hybrid: Hard rules + Azure OpenAI)
       │
       ▼
[score_policy_options] ─── (Deterministic EV Calculation)
       │
       ▼
[check_guardrails] ───── (Enforces frequency, caps, consent)
       │
   ┌───┴───┐
   │       │
[ALLOW] [ESCALATE]
   │       │
   │       ▼
   │   [hitl_escalation] ─── (LangGraph interrupt() pause)
   │       │ (resume)
   └───┬───┘
       │
       ▼
[execute_action] ──────── (WhatsApp -> Resend Email -> Reroute)
       │
       ▼
[outcome_tracker] ────── (Razorpay webhook reconciler & dedup)
       │
       ▼
[write_audit_entry] ──── (Supabase DB + Langfuse Cloud Tracing)
```

---

## Root-Cause Categories (6-Class Schema)

1. `payment_degraded`: Bank route or gateway degradation. Never contact
   customer; trigger silent payment reroute / backoff retry.
2. `mandate_auth_failed`: RBI recurring mandate > ₹15,000 missing Additional
   Factor Authentication (AFA). Send mandate re-auth consent link.
3. `subscription_failed`: Recurring card/mandate failure (expired card,
   temporary insufficient balance, soft decline).
4. `checkout_abandoned`: High-intent cart drop-off within 15–60 min window.
   Dynamic payment link + light incentive if high EV.
5. `receivable_overdue`: B2B overdue invoice with net terms analysis.
   Progressive escalation based on customer payment history.
6. `promise_to_pay`: Customer agreed to pay on a specific date ($T_{promised}$).
   Pause outreach; schedule re-check at $T_{promised} + \Delta$.

---

## Guardrail Invariants

- **Max Contact Rule**: Never exceed 2 customer outreach attempts per incident.
- **Dedup Rule**: Enforce a 24-hour quiet period across channels for identical
  `customer_id`.
- **Amount Authorization**: Any automated intervention on amounts
  $\ge \text{₹1,00,000}$ triggers mandatory human approval (`ESCALATE`).
- **Opt-Out Compliance**: Immediate permanent block upon receiving opt-out /
  stop keywords.
- **Zero Duplicate Contacts**: Hard operational metric ($= 0$).

---

## Conventions for AI Pair Programmers

- Keep Python code typed (`TypedDict`, `pydantic`,
  `Annotated[..., add_messages]`).
- Do not log or commit real credentials. Always load from `.env` or system
  environment.
- Use structured JSON outputs from Azure OpenAI.
- Maintain test coverage across failure injection modes in
  `tests/failure_injection/`.
