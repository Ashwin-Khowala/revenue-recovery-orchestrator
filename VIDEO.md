# 🎬 Razorpay AI Revenue Recovery Orchestrator — Demo Script

> **Track 3: AI Revenue Recovery**  
> **Total Duration:** 3 minutes (4 tight scenes, zero fluff, real code and commands)

---

## 🎯 Scene 1: At-Risk Detection & 4-Tier Memory Reasoning (0:00 – 0:45)

### Visual
- Open Merchant Dashboard (`http://localhost:3000/merchant`).
- Show live incident queue displaying distinct recovery archetypes: Bank Route Degradation, Cart Abandonment with Margin Shield, RBI Mandate >₹15,000, and B2B Overdue Invoices.
- Click on an incident to inspect the **Behavioral Memory Drawer**: 54,000-episode history prior, payment reliability, and channel responsiveness.

### Voiceover
> "Most recovery tools treat every failed transaction as a marketing blast. We built a supervisory decision engine that sits above individual tools.
> 
> When a failure occurs, Node 0 pulls behavioral priors from a 4-tier memory layer. Instead of blasting immediately, the deterministic EV engine scores candidate actions—including 'Do Nothing' as a first-class choice. For reliable customers with high payment priors, doing nothing often yields the highest net expected value by preventing customer friction."

---

## 🛡️ Scene 2: High-Value Human-in-the-Loop Safety Gate (0:45 – 1:30)

### Visual
- Select the **₹1,45,000 TechMatrix Corp** overdue B2B invoice.
- Point out the status: `PENDING_HITL` with guardrail badge: `RULE_HIGH_VALUE_THRESHOLD_ESCALATION (Amount >= ₹1,00,000)`.
- Switch to Telegram / Operations Center showing the interactive alert dispatched to the merchant with **Approve** and **Reject** buttons.
- Click **Approve** in the dashboard / Telegram; show LangGraph state resumption and real-time execution.

### Voiceover
> "Automating collection messages on ₹1.45 lakh invoices without human oversight creates severe commercial risk. 
> 
> Our deterministic guardrails enforce an absolute ₹1,00,000 threshold. Any action above this amount pauses the LangGraph workflow via `interrupt()`, dispatches an interactive Telegram alert with full EV context to the merchant admin, and only dispatches the tailored communication once explicitly approved."

---

## ⚡ Scene 3: Real Razorpay Test Mode Order & Webhook Race Arbitration (1:30 – 2:15)

### Visual
- Terminal split screen: Run `python scripts/verify_razorpay_testmode_race.py`.
- Show the live Razorpay API response: real test-mode payment link created (`https://rzp.io/rzp/...`).
- Show the recovery action registered in the persistent queue (`pending_send`).
- Customer pays before message dispatch: incoming HMAC-SHA256 `payment.captured` webhook arrives.
- Show the terminal and dashboard output: `Outreach Aborted Pre-Send: Payment Captured Early` with **0 duplicate contacts**.

### Voiceover
> "In real-world payments, out-of-order webhooks are common: a payment fails, but the customer quickly retries and pays before outreach is dispatched.
> 
> The Orchestrator maintains a persistent arbitration queue. When a real Razorpay Test Mode capture arrives, it arbitrates the race, immediately cancels the pending outreach pre-send, and guarantees zero duplicate contacts."

---

## 📊 Scene 4: Cryptographic Audit Trail & 4-Arm Benchmark (2:15 – 3:00)

### Visual
- Navigate to the **Audit Log** tab. Show SHA-256 hash chaining (`prev_entry_hash` -> `entry_hash`) with cryptographic tamper verification.
- Terminal: Run `python evals/run_batch.py` and display the 4-arm benchmark table on 150 held-out events (₹97.5L at risk).
- Highlight the key metrics:
  - Incremental recovered vs organic baseline: **+₹15,31,218.00**
  - Duplicate contact breaches: **0**
  - Counterfactual (Human approved every pause): **₹72,46,091.00 (74.31%)**
  - Show `evals/exceptions.json` detailing exact reasons for every paused/non-recovered account.

### Voiceover
> "Every decision, LLM classification, and guardrail check is chained into an immutable SHA-256 audit ledger.
> 
> Evaluated on 150 held-out events representing ₹97.5 lakhs at risk, naive blasting claims higher numbers on paper only because it spams customers without consent and books unauthorized debt. Our orchestrator delivers ₹15.3 lakhs of true incremental recovery over the organic baseline, cuts wasted touches by 62%, and guarantees exactly zero duplicate contact breaches."
