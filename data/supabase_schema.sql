-- ==============================================================================
-- REVENUE RECOVERY ORCHESTRATOR — SUPABASE (POSTGRESQL) SCHEMA
-- ==============================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Ingested Events (Synthetic Batch & Real Razorpay Test-Mode Invocations)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    event_id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL, -- 'subscription_failed', 'checkout_abandoned', 'receivable_overdue', 'payment_degraded', 'mandate_auth_failed', 'promise_to_pay'
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(8) DEFAULT 'INR',
    merchant_id VARCHAR(64) NOT NULL,
    customer_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(128),
    customer_email VARCHAR(128),
    customer_phone VARCHAR(32),
    razorpay_ref VARCHAR(128), -- e.g. 'order_xxx' or 'pay_xxx'
    status VARCHAR(32) DEFAULT 'pending', -- 'pending', 'processing', 'recovered', 'escalated', 'blocked', 'cancelled'
    history JSONB DEFAULT '{}'::jsonb, -- { prior_contacts, prior_payment_success_rate, customer_avg_days_late }
    metadata JSONB DEFAULT '{}'::jsonb, -- { failure_bank, failure_route, cart_items, mandate_amount, afa_step }
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. Recovery Actions & Interventions (EV Rankings & Executions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recovery_actions (
    action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(64) REFERENCES events(event_id) ON DELETE CASCADE,
    root_cause VARCHAR(64) NOT NULL,
    confidence NUMERIC(5, 4),
    candidate_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    chosen_action VARCHAR(64) NOT NULL,
    expected_value NUMERIC(12, 2),
    ev_breakdown JSONB DEFAULT '{}'::jsonb,
    guardrail_result VARCHAR(16) NOT NULL, -- 'ALLOW', 'ESCALATE', 'BLOCK'
    guardrail_rule_fired VARCHAR(128),
    channel_used VARCHAR(32), -- 'whatsapp', 'email', 'reroute', 'scheduled_check', 'none'
    execution_status VARCHAR(32) DEFAULT 'queued', -- 'queued', 'dispatched', 'delivered', 'cancelled_by_webhook', 'failed'
    execution_result JSONB DEFAULT '{}'::jsonb,
    cost NUMERIC(8, 4) DEFAULT 0.00,
    dispatched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. Promise-To-Pay Ledger (First-Class Commitment Memory)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promise_to_pay (
    ptp_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(64) REFERENCES events(event_id) ON DELETE CASCADE,
    customer_id VARCHAR(64) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    promised_date DATE NOT NULL,
    recheck_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) DEFAULT 'active', -- 'active', 'honored', 'breached', 'cancelled'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. Audit Log (Immutable Chronological System Ledger)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(64) REFERENCES events(event_id) ON DELETE CASCADE,
    node_name VARCHAR(64) NOT NULL,
    action_taken VARCHAR(128) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. Evaluation Runs & Benchmark Results
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evaluation_runs (
    run_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy VARCHAR(64) NOT NULL, -- 'baseline_naive', 'baseline_rules', 'orchestrator_gpt4o_mini', 'orchestrator_gpt4o'
    dataset_name VARCHAR(64) NOT NULL,
    total_events INT NOT NULL,
    total_at_risk NUMERIC(14, 2) NOT NULL,
    total_recovered NUMERIC(14, 2) NOT NULL,
    recovery_rate NUMERIC(6, 3) NOT NULL,
    false_interventions INT NOT NULL,
    cost_per_recovered_rupee NUMERIC(8, 5) NOT NULL,
    escalation_rate NUMERIC(6, 3) NOT NULL,
    duplicate_contacts INT NOT NULL DEFAULT 0,
    metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- Performance Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_customer ON events(customer_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_event ON recovery_actions(event_id);
CREATE INDEX IF NOT EXISTS idx_ptp_recheck ON promise_to_pay(recheck_at);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event_id, created_at DESC);
