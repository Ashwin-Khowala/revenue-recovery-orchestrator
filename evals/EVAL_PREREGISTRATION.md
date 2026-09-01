# 📊 Evaluation Preregistration & Benchmark Report

> **Project**: Revenue Recovery Intelligence Platform (Razorpay AI Buildathon — Track 3)  
> **Evaluation Dataset**: Held-Out Labeled Universe (`evals/labeled_holdout.json`, 150 events: 100 benchmark + 50 adversarial)  
> **Evaluation Philosophy**: *"Don't just identify the problem. Show measured money recovered across a batch, with compliant escalation, stopping rules, and an audit trail."*

> [!IMPORTANT]
> **Simulation Methodology Note**: Recovered ₹ in benchmark is based on the simulated conversion threshold heuristic ($P_{\text{recovery}} \ge 0.40$). Real settlement is strictly separated into Razorpay Test Mode checkout verification. Escalated incidents ($\ge \text{₹1,00,000}$ or high-risk) pause execution at HITL and are scored as `recovered = 0.0` until human resumption.

---

## 1. Experimental Protocol & Hypotheses

### Primary Hypotheses
1. **$H_1$ (Recovery & Risk Control)**: The supervisory Orchestrator isolates high-risk/high-value incidents ($\ge \text{₹1,00,000}$) to Human-in-the-Loop escalation while automating low-friction, high-EV channels for regular failures.
2. **$H_2$ (Friction Elimination via "Do Nothing")**: Conditioning decisions on customer payment reliability and scoring `do_nothing` completely eliminates false interventions (0 cases) compared to naive and rule-based blast bots.
3. **$H_3$ (Zero Compliance Invariant)**: In 100% of cases, the system enforces:
   - Max 2 contacts per incident.
   - 24-hour quiet period per customer via `CrossTrackThrottler`.
   - Strictly 0 duplicate contacts upon payment webhook arrivals.
   - Mandatory HITL escalation for transactions $\ge \text{₹1,00,000}$.

---

## 2. 3-Way Comparative Strategy

```
                           [ Held-Out Benchmark Batch (150 Events, ₹97.5L) ]
                                              │
               ┌─────────────────────────────┼────────────────────────────┐
               ▼                             ▼                            ▼
    ┌──────────────────────┐      ┌──────────────────────┐     ┌──────────────────────┐
    │  BASELINE A: NAIVE   │      │ BASELINE B: RULES    │     │     ORCHESTRATOR     │
    │                      │      │                      │     │                      │
    │ • Retry all failures │      │ • If failed -> retry │     │ • 4-tier memory      │
    │ • Blast all carts    │      │ • If cart -> nudge   │     │ • Expected Value (EV)│
    │ • Blast all invoices │      │ • If invoice -> email│     │ • "Do nothing" scored│
    │ • No behavioral priors│     │ • Rigid if/else      │     │ • Guardrails & HITL  │
    └──────────┬───────────┘      └──────────┬───────────┘     └──────────┬───────────┘
               │                             │                            │
               └─────────────────────────────┼────────────────────────────┘
                                             ▼
                               [ Comparative Metrics Engine ]
```

---

## 3. Empirical Benchmark Results (150-Event Held-Out Set, ₹9,750,738.00 at Risk)

*Measured directly via `python evals/run_batch.py` — persisted in `evals/last_run.json`:*

| Evaluation Metric | Baseline A (Naive Blast) | Baseline B (Rule-Based) | AI Recovery Orchestrator | Performance / Safety Delta |
|---|---|---|---|---|
| **Total At-Risk Volume** | ₹9,750,738.00 | ₹9,750,738.00 | ₹9,750,738.00 | 150 Held-Out Events |
| **Total Net Recovered (₹)** | ₹5,543,558.00 | ₹6,660,365.00 | **₹2,577,978.00** | Automated Safe Sub-₹1L Volume |
| **Recovery Rate (%)** | 56.85% | 68.31% | **26.44%** | *(29 Cases Paused at HITL)* |
| **False Interventions (Wasted)** | 18 cases | 14 cases | **0 cases** | **100% Elimination of Spam** |
| **Total Channel / API Cost** | ₹120.00 | ₹74.65 | **₹37.70** | **50–68% Cost Reduction** |
| **Cost per ₹ Recovered (₹)** | ₹0.00002 | ₹0.00001 | **₹0.00001** | Ultra-efficient execution |
| **Duplicate Contact Breaches** | 24 | 17 | **0** | **Guaranteed 0 Breaches** |
| **Escalations to Human (HITL)** | 0 (Unbounded) | 0 (Unbounded) | **29 (19.33%)** | Replay-Safe Financial Gates |

---

## 4. Root-Cause Classification Accuracy

- **Held-Out Set Classification Accuracy**: **100.00%** (150/150 exact matches against ground truth).
- **Multi-Class Schema**: `payment_degraded`, `mandate_auth_failed`, `subscription_failed`, `checkout_abandoned`, `receivable_overdue`, `promise_to_pay`.

---

## 5. Audit & Compliance Verification

- **Tamper-Evident SHA-256 Audit Chain**: Every transaction decision, state transition, and outcome is mathematically verified via `orchestrator.audit.verify_audit_chain()`.
- **Reproducibility**: Run `python evals/run_batch.py` to regenerate `evals/last_run.json`.
