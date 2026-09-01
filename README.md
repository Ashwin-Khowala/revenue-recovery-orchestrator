# ⚡ Revenue Recovery Orchestrator

> **Razorpay AI Buildathon — Track 3: AI Revenue Recovery**  
> A supervisory decision engine that sits above individual recovery tools (cart abandonment, failed subscriptions, overdue B2B receivables, RBI >₹15,000 mandates) to prevent customer spam, enforce financial compliance, and maximize net recovered revenue.

---

## 🎯 Architectural Overview

1. **4-Tier Behavioral Memory**: Enriches failure events with customer reliability, 54k historical episodes, channel effectiveness, and merchant policies before reasoning.
2. **Hybrid Root-Cause Diagnosis**: Uses hard-coded decline taxonomy for technical gateway outages (silent reroute) and Azure OpenAI (`gpt-4o-mini`) for ambiguous intent/cart drop-offs.
3. **Deterministic EV Engine**: Computes Net Expected Value ($EV = P_{\text{recovery}} \times \text{amount} - \text{cost} - \text{friction} - \text{risk}$) and scores **"do nothing"** as a first-class candidate to protect natural payers.
4. **Hard-Coded Compliance Guardrails**: Enforces ₹1,00,000 Human-in-the-Loop (HITL) escalation cap, 2-contact max limit, and 24-hour quiet windows via `CrossTrackThrottler`.
5. **Webhook Race-Condition Arbitration**: Queues recovery actions with debounce; cancels pending outreach immediately if a customer pays before dispatch (0 duplicate contacts).
6. **Cryptographic SHA-256 Audit Trail**: Chained append-only audit log with tamper detection and Supabase persistence.

---

## 📊 Measured Benchmark Results

> [!NOTE]
> **Simulation Disclaimer**: Recovered ₹ in benchmark is based on the simulated conversion threshold heuristic ($P_{\text{recovery}} \ge 0.40$). Real settlement is strictly separated into Razorpay Test Mode checkout verification. Escalated incidents ($\ge \text{₹1,00,000}$) pause at HITL and are scored as `recovered = 0.0` until human resumption.

Evaluated on `evals/labeled_holdout.json` (150 held-out events, ₹97,50,738.00 at risk):

| Metric | Baseline A (Naive Blast) | Baseline B (Rule-Based) | AI Recovery Orchestrator |
|---|---|---|---|
| **At-Risk Target** | ₹97,50,738.00 | ₹97,50,738.00 | ₹97,50,738.00 |
| **Recovered (Simulated)** | ₹55,43,558.00 (56.85%) | ₹66,60,365.00 (68.31%) | **₹25,77,978.00 (26.44%)** |
| **Wasted Interventions (Spam)** | 18 cases | 14 cases | **0 cases (100% spam reduction)** |
| **Duplicate Contact Breaches** | 24 | 17 | **0 (Guaranteed 0 breaches)** |
| **Human Escalations (HITL)** | 0 (Unbounded) | 0 (Unbounded) | **29 cases (19.33%)** |
| **Outreach / API Cost** | ₹120.00 | ₹74.65 | **₹37.70** |

---

## 🚀 Live Verification Flow (Razorpay Test Mode)

1. **Trigger Incident**: Create a Razorpay payment link / cart drop-off event.
2. **Orchestrator Decision**: Evaluates memory, scores actions, enforces ₹1L cap & 24h quiet window.
3. **Payer Interaction**: Real payment in Razorpay Checkout test mode.
4. **Race-Condition Arbitration**: Incoming `payment.captured` webhook cancels queued outreach in real time.
5. **Audit Verification**: SHA-256 hash chained log verifies immutable compliance.

---

## 🛠️ Quickstart

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run test suite (75+ unit & failure injection tests)
pytest tests -v

# 3. Run full 150-event evaluation benchmark
python evals/run_batch.py

# 4. Start orchestrator webhook & API server
uvicorn orchestrator.webhook:app --port 8000 --reload
```
