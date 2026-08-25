---
name: revenue-recovery
description: Supervisory AI decision engine for detecting at-risk revenue, classifying payment failures, computing Expected Value (EV), enforcing financial compliance guardrails, and safely executing multi-channel recovery workflows for Razorpay.
---

# Revenue Recovery Skill

This skill provides comprehensive guidelines, operational schemas, and decision workflows for orchestrating automated revenue recovery across payment gateways, recurring mandates, B2B receivables, and checkout drop-offs.

## 6-Class Root Cause Schema

When diagnosing an at-risk transaction or payment failure, classify into exactly one of these 6 root causes:

1. `payment_degraded`: Bank route or gateway degradation (>30% failure rate).
   - **Action**: Silent secondary gateway reroute.
   - **Rule**: Customer is NEVER contacted (Zero friction).
2. `mandate_auth_failed`: RBI recurring mandate > ₹15,000 missing Additional Factor Authentication (AFA).
   - **Action**: 1-click mandate consent re-auth link via WhatsApp/Telegram.
3. `subscription_failed`: Recurring card/mandate soft decline or temporary balance limit.
   - **Action**: Dynamic Razorpay payment link with smart retry sequencer.
4. `checkout_abandoned`: High-intent cart drop-off (15-60 min window).
   - **Action**: Model on-time history. If customer has >=95% on-time record, choose `do_nothing`. Otherwise, attach dynamic 1-5% micro-discount.
5. `receivable_overdue`: B2B overdue invoice with net terms analysis.
   - **Action**: Progressive escalation. If amount >= ₹1,00,000, trigger mandatory HITL review.
6. `promise_to_pay`: Customer committed to pay on a specific date ($T_{promised}$).
   - **Action**: Suspend all outreach; schedule auto-recheck at $T_{promised} + 24\text{h}$.

## Mathematical Policy Formulation (EV)

$$EV(\text{action}) = P(\text{recovery} \mid \text{action}, \text{context}) \times \text{Amount} - \text{Cost}(\text{action}) - \text{FrictionPenalty} - \text{RiskPenalty}$$

- **`do_nothing`** is always scored as a first-class candidate.
- Intrusive messaging on highly-reliable customers yields negative EV through brand fatigue.

## Compliance Guardrail Invariants

- **Max Contact Rule**: Never exceed 2 customer outreach attempts per incident.
- **Dedup Rule**: Enforce a 24-hour quiet period across channels for identical `customer_id`.
- **Amount Authorization Cap**: Any action on amounts $\ge \text{₹1,00,000}$ triggers mandatory human approval (`ESCALATE`).
- **Zero Duplicate Contacts**: Hard operational invariant ($= 0$) enforced via active pending queue arbitration on out-of-order webhooks.
