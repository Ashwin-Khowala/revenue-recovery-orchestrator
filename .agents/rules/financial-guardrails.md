# Financial Guardrails & Execution Invariants

These rules are ALWAYS ON for any AI agent interacting with this repository or dispatching financial transactions.

## Non-Negotiable Invariants

1. **Separation of Reasoning & Financial Control**:
   - LLMs are used solely for classification disambiguation and natural language synthesis.
   - Money movement, financial caps, and execution triggers must pass deterministic code gates.

2. **Amount Cap Enforcement**:
   - Automated outreach or payout actions on amounts $\ge \text{₹1,00,000}$ MUST trigger LangGraph `interrupt()` for human supervisory review.

3. **Max Contact Rule**:
   - No customer may be contacted more than 2 times per failure incident.
   - Enforce a 24-hour quiet period across channels (WhatsApp, Telegram, Email, SMS).

4. **Zero Duplicate Contacts Guarantee**:
   - If an incoming `payment.captured` webhook arrives while a recovery action is in-flight, the action must be cancelled immediately.

5. **Customer Privacy & Safe Mode**:
   - In non-production environments, override all recipient phone numbers with `SAFE_MODE_PHONE_OVERRIDE` (+918240468683).
