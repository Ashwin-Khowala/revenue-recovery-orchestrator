# ⚡ Razorpay Revenue Recovery Orchestrator

> **Track 3: AI Revenue Recovery** — Supervisory decision engine that governs cart drop-offs, subscription declines, B2B overdue receivables, and RBI >₹15,000 mandates.

---

## 📊 Measured Benchmark (`evals/labeled_holdout.json`, 150 events, ₹97,50,738.00 at risk)

*Recovered ₹ in benchmark reflects simulated conversion thresholds ($P \ge 0.40$). Real money movement is verified separately in Razorpay Test Mode checkout verification.*

| Metric | Arm 0 (Organic) | Arm 1 (Naive Blast) | Arm 2 (Rule-Based Engine) | Arm 3 (AI Orchestrator) |
|---|---|---|---|---|
| **Gross Simulated ₹** | ₹19,45,253.00 (19.95%) | ₹55,43,558.00 (56.85%) | ₹66,60,365.00 (68.31%) | **₹31,23,587.00 (32.03%)** |
| **Incremental vs Organic** | ₹0.00 (Baseline) | ₹35,98,305.00 | ₹47,15,112.00 | **+₹11,78,334.00** |
| **Outreach Contacts Sent** | 0 (Zero Contact) | 150 | 113 | **35 (69% Less Spam)** |
| **Duplicate Breaches** | 0 | 24 | 17 | **0 (Guaranteed 0)** |
| **Human Escalations (HITL)**| 0 (No Gates) | 0 (No Gates) | 0 (No Gates) | **26 (17.33% Paused)** |
| **Channel / API Cost** | ₹0.00 | ₹120.00 | ₹74.65 | **₹32.05** |

> 💡 **Why Rule-Based Engines Show Higher Gross ₹ (and why that's deceptive):**
> Dumb rule engines recover more gross ₹ simply because they have **zero safety gates**: they blast every high-value enterprise customer without authorization and rack up **17 duplicate contact breaches** violating the 24h quiet window.
> The AI Orchestrator is **compliance-gated**: it achieves **+₹11.78L incremental recovery** with **69% less customer noise (35 contacts vs 113)**, **guarantees 0 duplicate contacts**, and safely holds 26 high-value accounts ($\ge \text{₹1,00,000}$) for human review.
> When human admins sign off on high-value escalations, the **counterfactual recovery rises to ₹66,03,207.00 (67.72%)** with **zero compliance risk**.

---

## 🛡️ Core Invariants

1. **Deterministic EV Engine**: Computes Net Expected Value ($EV = P \cdot A - C - F - R$); scores *do nothing* as a first-class candidate.
2. **Hard Guardrails**: ₹1,00,000 HITL cap, 2-contact maximum, and 24-hour quiet window via persistent sidecar throttler.
3. **Webhook Race Arbitration**: Active queue cancels pending outreach immediately upon receiving `payment.captured` (0 duplicate spam).
4. **Cryptographic SHA-256 Audit**: Append-only hash-chained ledger verifying every decision.

---

## 🚀 Quickstart & Verification

```bash
pip install -r requirements.txt
python evals/run_batch.py                       # 4-arm benchmark + exceptions.json
python scripts/verify_razorpay_testmode_race.py # Real Razorpay Test Mode race test
pytest tests -v                                 # Unit & stopping rule suite
```
