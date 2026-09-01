# PLAN.md — Revenue Recovery Orchestrator Engineering Plan & Truth Audit

**Commit Frozen at Start**: `e8013cadef0d0427e41f3ffc415194e446aa4fb4`  
**Role**: Staff Payments + ML Engineer  
**Objective**: Guarantee Track 3 Reviewer Excellence with verifiable benchmarks, bounded AI workflows, scarce HITL gates, and zero hallucinated metrics.

---

## Phase 0: Freeze & Map (Claim Truth Table)

| ID | Claim | Status | Source / Proof |
|---|---|---|---|
| **C1** | Holdout N = 150, At-Risk = ₹97,50,738 | **MEASURED** | `evals/labeled_holdout.json` (100 standard + 50 adversarial rows) |
| **C2** | Recovery % vs Naive (56.85%) & Rules (68.31%) | **MEASURED** | `evals/last_run.json` (dynamically computed via `run_batch.py`) |
| **C3** | Duplicate Contacts = 0 | **MEASURED** | `evals/run_batch.py` checking prior contacts $\ge 2$ and 24h quiet windows |
| **C4** | HITL Escalation Rate = 19.33% (29/150) | **MEASURED** | Exactly 29 events with $\text{amount} \ge \text{₹1,00,000}$ routed to `hitl_escalation` |
| **C5** | 24h Quiet Window Enforced | **IMPLEMENTED** | `orchestrator/nodes/guardrails.py` calls `CrossTrackThrottler` |
| **C6** | SHA-256 Audit Chain with Tamper Detection | **IMPLEMENTED** | `orchestrator/audit.py`, tested in `tests/test_audit_chain.py` |
| **C7** | Webhook Capture Cancels Queued Outreach | **IMPLEMENTED** | `orchestrator/webhook.py`, tested in `tests/failure_injection/test_webhook_race.py` |
| **C8** | Clear Simulated ($P \ge 0.40$) vs Real Settlement | **DOCUMENTED** | Explicit disclaimers in `README.md` and `evals/EVALS.md` |
| **C9** | Real Model Identifiers Only (`gpt-4o-mini`, `gpt-4o`) | **IMPLEMENTED** | Zero references to fictitious model names |
| **C10** | Dashboard / Copilot numbers loaded dynamically | **TO REFINE** | Load live stats from `/api/incidents` and `evals/last_run.json` |

---

## Phased Work Breakdown & File Level Tasks

### Phase 1 — Stop the Bleed (Docs, Naming & Copilot Grounding) [Effort: 1.5h]
- [x] Delete all references to `GPT-5.4 Mini` and `gpt-54-mini`.
- [x] Strip old brochure metrics (75.8%, ₹5,84,200).
- [ ] Refactor Copilot prompt in `orchestrator/webhook.py` to load dynamic summary stats from `_get_live_merchant_stats()` rather than hardcoded string templates.
- [ ] Ensure root `README.md` stays under 50 lines with exact empirical metrics from `evals/last_run.json`.

### Phase 2 — Robust Evaluation Suite & Verification Assertions [Effort: 2h]
- [x] Implement `evals/run_batch.py` to evaluate across all 4 arms: `organic_do_nothing`, `naive_baseline`, `rules_baseline`, `orchestrator`.
- [ ] Generate both `evals/last_run.json` and `evals/exceptions.json` (recording every non-recovered incident with root cause, decline code, and reason).
- [ ] Add `tests/test_benchmark_docs_consistency.py` to fail if any markdown file quotes a rupee figure not present in `last_run.json`.

### Phase 3 — Guardrails with Persistent Sidecar Storage [Effort: 1.5h]
- [ ] Extend `CrossTrackThrottler` in `orchestrator/governance.py` to persist `last_contact_at` to `data/customer_contact_history.json` and Supabase.
- [ ] In `orchestrator/nodes/guardrails.py`, convert throttler denials into explicit `do_nothing` decisions with audit reasons.

### Phase 4 — Audit Persistence & Tamper Detection [Effort: 1h]
- [x] `log_audit_entry` computes `entry_hash` and `prev_entry_hash`.
- [x] `verify_audit_chain` reads from Supabase DB or fallback JSON ledger `data/audit_ledger.json`.
- [x] `tests/test_audit_chain.py` validates chain integrity and tamper detection.

### Phase 5 — Real Razorpay Webhook Race Arbitration & Transcript [Effort: 2h]
- [ ] Standardize `PENDING_RECOVERY_QUEUE` with bidirectional lookup `event_id <-> order_id <-> payment_id`.
- [ ] Create `scripts/verify_razorpay_testmode_race.py` to run live Razorpay test-mode order creation, recovery enqueue, and HMAC-verified `payment.captured` cancellation.
- [ ] Output redacted transcript to `evals/testmode_captured_cancel.json`.

### Phase 6 — Documented & Tested Stopping Rules [Effort: 1.5h]
- [ ] Create `tests/test_stopping_rules.py` covering all 8 concrete stopping rules:
  `resolved_captured`, `opt_out`, `max_contacts`, `quiet_window`, `hitl_pending`, `kill_switch`, `promise_pause`, `commercial_dispute`.

### Phase 7 — Dashboard Truth & 3-Block Case File [Effort: 2h]
- [ ] Redesign Drawer into clean **3-Block Case File**:
  1. **Customer Memory**: Reliability score, past outcomes, preferred channel.
  2. **Recommended Action & EV**: Exact EV breakdown vs `do_nothing`.
  3. **Approval Execution Receipt**: Live Razorpay link, template preview, and SHA-256 hash.
- [ ] Add toggle for **Reviewer / Engine Mode** to inspect graph node path and cryptographic certificate.

### Phase 8 — Video Script & Reviewer Guide [Effort: 1h]
- [ ] Create `VIDEO.md`: 5-minute, 4-scene video walkthrough.
- [ ] Create `DIFF.md`: "What a Reviewer Should Click".
