# Master Video Presentation Guide: Razorpay AI Revenue Recovery Orchestrator

This document is your **complete video recording script, slide guide, and talking points** for the Razorpay AI Buildathon pitch. It breaks down the system into clear, compelling stories that prove why this supervisory decision engine is light-years ahead of naive dunning bots.

---

## 🎬 3-Minute Video Structure & Timestamps

| Section | Duration | Screen Visual | Core Message & Punchline |
| :--- | :---: | :--- | :--- |
| **1. The Problem** | `0:00 - 0:40` | Slide or dashboard showing generic coupon spam & spam complaints | Traditional recovery tools blindly spam customers and cannibalize margins. We built a supervisory decision engine that **diagnoses before acting**. |
| **2. Pipeline Architecture** | `0:40 - 1:15` | StateGraph architecture diagram | 4-tier memory + deterministic rules + Azure GPT-5.4 Mini reasoning + mathematical Expected Value + SHA-256 audit chaining. |
| **3. Demo Contrast 1: Checkout Intelligence** | `1:15 - 1:55` | Running `tests/test_checkout_funnel.py` or Live UI | Mobile form glitch gets a **1-click fix link** (0% discount). Window shopper gets **Strict Margin Shield** (0% discount, zero coupon harvesting). |
| **4. Demo Contrast 2: Involuntary vs Voluntary Churn** | `1:55 - 2:35` | Running `tests/test_subscription_recovery.py` or Live UI | Two users with the **identical decline code**: Engaged user gets smart pay-cycle retry; 60-day dormant user gets **Dunning Kill Switch** & graceful off-ramp. |
| **5. Financial Impact & Wrap-up** | `2:35 - 3:00` | Summary metrics table / Confident AI report | 100% Guardrail compliance, zero duplicate contacts ($Invariant=0$), ₹10M+ margin saved. |

---

## 🎙️ Word-for-Word Pitch Script

### Part 1: The Problem (0:00 - 0:40)
> *"Revenue recovery today is broken. Most tools operate on brute force:  
> When a payment fails or a cart is abandoned, they immediately blast generic emails with 10% discount codes.  
> This causes three massive problems:  
> First, it spams customers when the fault was actually an infrastructure timeout.  
> Second, it destroys merchant profit margins by training buyers to abandon carts for coupons.  
> And third, it harasses disengaged subscribers who mentally cancelled two months ago, triggering chargebacks and dispute penalties.  
>  
> For the Razorpay AI Buildathon, we built the **Revenue Recovery Orchestrator**—a supervisory decision engine that enforces strict separation between AI reasoning and deterministic financial control."*

---

### Part 2: Architecture & Decision Topology (0:40 - 1:15)
> *"Our architecture is built on a LangGraph state machine backed by a 4-tier behavioral memory layer across 54,000 historical episodes.  
> Every incident passes through three deterministic compliance gates:  
> 1. A 30+ code Decline Taxonomy Matrix that separates merchant-side infrastructure outages from payer-side issues.  
> 2. Mathematical Expected Value calculation: $EV = P(\text{recovery}) \times \text{Amount} - \text{Cost} - \text{Friction} - \text{Risk}$. If contacting a customer adds brand fatigue, **'Do Nothing' mathematically wins the score**.  
> 3. Replay-safe Human-in-the-Loop escalation via Telegram for high-value transactions, with every state transition sealed by SHA-256 cryptographic audit chaining."*

---

### Part 3: Demo Beat 1 — Checkout Drop-Off & Margin Shield (1:15 - 1:55)
> *(Action: Run `python -m pytest tests/test_checkout_funnel.py -v`)*  
>  
> *"Let's look at checkout drop-offs. Unlike payment failures, there's no decline code here—so we analyze step-level funnel telemetry:  
> In **Scenario A**, a shopper on mobile hits a payment form glitch. Our agent diagnoses `technical_form_friction`, does NOT send marketing spam, and dispatches a 1-click Razorpay Smart Resume link bypassing the broken step.  
> In **Scenario B**, a window shopper visited the cart 4 times for 10 seconds. Naive tools give away 15% margin here. Our agent diagnoses `comparison_window_shopping` and activates the **Strict Margin Shield**—enforcing zero percent discount and saving the merchant's gross margin."*

---

### Part 4: Demo Beat 2 — Involuntary vs. Voluntary Churn (1:55 - 2:35)
> *(Action: Run `python -m pytest tests/test_subscription_recovery.py -v`)*  
>  
> *"Now look at subscription billing. This is where our 'diagnose before acting' philosophy shines:  
> Here are two customers with the **exact same decline code**: `insufficient_funds`.  
> - **Customer 1** is active and logged in yesterday. The agent diagnoses `involuntary_churn`, grants a 14-day grace period, and schedules a smart retry aligned with their Friday payroll cycle.  
> - **Customer 2** hasn't logged in for 65 days. Continuing to dunning-spam them only creates chargebacks and anger. The agent activates the **Dunning Kill Switch**, stops automated retries, and offers a graceful pause or free-tier downgrade off-ramp."*

---

### Part 5: Closing Statement & Verification (2:35 - 3:00)
> *"We benchmarked our reasoning engine against Azure OpenAI GPT-5.4 Mini, achieving 100% accuracy and 100% guardrail compliance across 18 DeepEval test cases synced live to Confident AI cloud.  
>  
> By pairing deep behavioral diagnosis with strict financial controls, our Orchestrator recovers revenue without sacrificing customer trust or merchant margin. Thank you!"*

---

## 📊 Summary Comparison Cheat-Sheet

| Pipeline Track | Detection Signal | Naive Tool Behavior | Razorpay Orchestrator Intelligent Move |
| :--- | :--- | :--- | :--- |
| **Payment Route Degradation** | >35% route failure rate / gateway timeout | Blames customer / sends failed email | **Silent Self-Healing Reroute** (0 customer contact, 0 friction) |
| **Checkout Drop-Off** | Cart visited 4x, <15s duration | Blasts 10–15% discount coupon | **Strict Margin Shield** (0% discount, prevent coupon harvesting) |
| **Checkout Form Error** | Dropped at payment input + mobile error | Sends marketing email 24h later | **Direct 1-Click Fix Link** bypassing broken step |
| **Active Subscription** | Failed renewal, active 24h ago | Immediate repeated charge attempts | **Smart Pay-Cycle Retry** (72h wait for salary window) + 14d grace |
| **Dormant Subscription** | Failed renewal, inactive 65 days | Aggressive multi-week dunning loop | **Dunning Kill Switch** + Graceful Pause/Downgrade off-ramp |
| **High-Value Renewal** | Enterprise plan $\ge \text{₹25,000}$ | Automated transactional SMS | **Human-in-the-Loop Telegram Alert** to Account Manager |
