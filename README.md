# ⚡ Razorpay Revenue Recovery Orchestrator

> **Track 3: AI Revenue Recovery** — Supervisory decision engine that governs cart drop-offs, subscription declines, B2B overdue receivables, and RBI >₹15,000 mandates.

---

## 📊 Measured Benchmark (`evals/labeled_holdout.json`, 150 events, ₹97,50,738.00 at risk)

*Recovered ₹ in benchmark reflects simulated conversion thresholds ($P \ge 0.40$). Real money movement is verified separately in Razorpay Test Mode.*

| Metric | Arm 0 (Organic) | Arm 1 (Naive) | Arm 2 (Rules) | Arm 3 (Orchestrator) |
|---|---|---|---|---|
| **Gross Simulated ₹** | ₹19,45,253.00 (19.95%) | ₹55,43,558.00 (56.85%) | ₹66,60,365.00 (68.31%) | **₹34,76,471.00 (35.65%)** |
| **Incremental vs Organic** | ₹0.00 (Baseline) | ₹35,98,305.00 | ₹47,15,112.00 | **+₹15,31,218.00** |
| **Outreach Contacts Sent** | 0 | 150 | 113 | **43 (62% Less Noise)** |
| **Duplicate Breaches** | 0 | 24 | 17 | **0 (Guaranteed 0)** |
| **Human Escalations (HITL)**| 0 (No Gates) | 0 (No Gates) | 0 (No Gates) | **29 (19.33%)** |
| **Channel / API Cost** | ₹0.00 | ₹120.00 | ₹74.65 | **₹38.45** |

*\*COUNTERFACTUAL (Human said yes to every pause): ₹72,46,091.00 (74.31%) | Incremental: +₹53,00,838.00*

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
