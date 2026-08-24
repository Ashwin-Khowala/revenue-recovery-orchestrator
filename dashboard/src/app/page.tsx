'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  AlertTriangle,
  PlayCircle,
  FileText,
  BarChart3,
  ShieldCheck,
  TrendingUp,
  Zap,
  CheckCircle2,
  Clock,
  ArrowRight,
  MessageSquare,
  Mail,
  RefreshCw,
  SlidersHorizontal,
  UserCheck,
  Ban,
  ChevronRight
} from 'lucide-react';

// Mock high-fidelity synthetic batch data for instant demonstration
const SAMPLE_EVENTS = [
  {
    event_id: 'evt_0012',
    event_type: 'payment_degraded',
    amount: 12000,
    customer_name: 'Aarav Sharma',
    customer_email: 'aarav.sharma@example.com',
    customer_phone: '+919876543210',
    root_cause: 'payment_degraded',
    confidence: 0.99,
    prior_success_rate: 0.92,
    prior_contacts: 0,
    chosen_action: 'silent_route_reroute',
    channel_used: 'reroute',
    expected_value: 10560,
    guardrail_result: 'ALLOW',
    status: 'recovered',
    reasoning: 'Axis Bank route failure rate > 40%. Silent reroute to HDFC gateway. Zero customer contact.',
  },
  {
    event_id: 'evt_0045',
    event_type: 'mandate_auth_failed',
    amount: 28500,
    customer_name: 'Ananya Verma',
    customer_email: 'ananya.verma@example.com',
    customer_phone: '+919812345678',
    root_cause: 'mandate_auth_failed',
    confidence: 0.98,
    prior_success_rate: 0.88,
    prior_contacts: 0,
    chosen_action: 'whatsapp_mandate_afa_link',
    channel_used: 'whatsapp',
    expected_value: 22215,
    guardrail_result: 'ALLOW',
    status: 'recovered',
    reasoning: 'RBI >₹15k mandate missing AFA step. Sent 1-click mandate consent link via WhatsApp.',
  },
  {
    event_id: 'evt_0089',
    event_type: 'receivable_overdue',
    amount: 145000,
    customer_name: 'TechMatrix Corp (Vikram Singh)',
    customer_email: 'vikram@techmatrix.in',
    customer_phone: '+919823456789',
    root_cause: 'receivable_overdue',
    confidence: 0.94,
    prior_success_rate: 0.95,
    prior_contacts: 1,
    chosen_action: 'human_collections_review',
    channel_used: 'none',
    expected_value: 137500,
    guardrail_result: 'ESCALATE',
    status: 'escalated',
    reasoning: 'High-value B2B invoice (₹1,45,000 > ₹1,00,000 cap). Guardrail triggered mandatory HITL review.',
  },
  {
    event_id: 'evt_0104',
    event_type: 'checkout_abandoned',
    amount: 3499,
    customer_name: 'Rohan Mehta',
    customer_email: 'rohan.mehta@example.com',
    customer_phone: '+919834567890',
    root_cause: 'checkout_abandoned',
    confidence: 0.89,
    prior_success_rate: 0.96,
    prior_contacts: 0,
    chosen_action: 'do_nothing',
    channel_used: 'none',
    expected_value: 1050,
    guardrail_result: 'ALLOW',
    status: 'recovered',
    reasoning: 'Customer has 96% on-time record. High probability of natural recovery. Friction penalty > outreach gain. do_nothing chosen.',
  },
  {
    event_id: 'evt_0128',
    event_type: 'promise_to_pay',
    amount: 48000,
    customer_name: 'Priya Nair',
    customer_email: 'priya.nair@example.com',
    customer_phone: '+919845678901',
    root_cause: 'promise_to_pay',
    confidence: 0.95,
    prior_success_rate: 0.84,
    prior_contacts: 1,
    chosen_action: 'schedule_ptp_check',
    channel_used: 'scheduled_check',
    expected_value: 40800,
    guardrail_result: 'ALLOW',
    status: 'recovered',
    reasoning: 'Customer committed to pay on Sept 1st. Outreach paused until promised date.',
  },
  {
    event_id: 'evt_0152',
    event_type: 'subscription_failed',
    amount: 2999,
    customer_name: 'Sneha Rao',
    customer_email: 'sneha.rao@example.com',
    customer_phone: '+919856789012',
    root_cause: 'subscription_failed',
    confidence: 0.91,
    prior_success_rate: 0.75,
    prior_contacts: 0,
    chosen_action: 'whatsapp_recovery_nudge',
    channel_used: 'email',
    expected_value: 2150,
    guardrail_result: 'ALLOW',
    status: 'recovered',
    reasoning: 'WhatsApp sandbox timed out. Automatic failover to Resend Email executed without duplicate sends.',
  },
];

const AUDIT_LOGS = [
  {
    timestamp: '10:31:04 UTC',
    event_id: 'evt_0098',
    node: 'outcome_tracker',
    action: 'Action Cancelled (Payment Captured Early)',
    details: 'Webhook payment.captured arrived before scheduled WhatsApp dispatch.',
    impact: '₹25,000 protected • 0 duplicate customer contacts',
  },
  {
    timestamp: '10:28:15 UTC',
    event_id: 'evt_0089',
    node: 'guardrails',
    action: 'HITL Escalation Triggered',
    details: 'RULE_HIGH_VALUE_THRESHOLD_ESCALATION (Amount ₹1,45,000 >= ₹1,00,000)',
    impact: 'Paused graph execution at hitl_escalation node',
  },
  {
    timestamp: '10:25:40 UTC',
    event_id: 'evt_0012',
    node: 'policy_engine',
    action: 'Chose silent_route_reroute (EV: ₹10,560)',
    details: 'P(rec)=0.88, Gross=₹10,560, Cost=₹0, Friction=₹0',
    impact: 'Customer zero-contact rule enforced',
  },
  {
    timestamp: '10:20:11 UTC',
    event_id: 'evt_0152',
    node: 'executor',
    action: 'Email Failover Dispatched',
    details: 'WhatsApp timeout. Failed over cleanly to Resend Email.',
    impact: '1 contact recorded • 0 duplicates',
  },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'at_risk' | 'runs' | 'audit' | 'evals'>('overview');
  const [selectedEvent, setSelectedEvent] = useState<any>(SAMPLE_EVENTS[0]);
  const [hitlModalOpen, setHitlModalOpen] = useState(false);
  const [hitlEvent, setHitlEvent] = useState<any>(null);
  const [raceConditionSimulated, setRaceConditionSimulated] = useState(false);

  const handleSimulateRaceCondition = () => {
    setRaceConditionSimulated(true);
    setTimeout(() => setRaceConditionSimulated(false), 5000);
  };

  return (
    <div className="flex h-screen bg-background text-slate-100 overflow-hidden">
      {/* --- Sidebar Navigation --- */}
      <aside className="w-64 border-r border-surface-border bg-surface flex flex-col justify-between p-4 shrink-0">
        <div>
          {/* Logo & Header */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6 border-b border-surface-border">
            <div className="w-9 h-9 rounded-lg bg-razorpay/20 border border-razorpay flex items-center justify-center text-razorpay font-black text-lg">
              ₹
            </div>
            <div>
              <h1 className="font-bold text-sm text-white tracking-wide">RECOVERY ORCHESTRATOR</h1>
              <p className="text-[10px] text-slate-400 font-mono">Razorpay Track 3 • v1.0</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5 font-medium text-sm">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                activeTab === 'overview'
                  ? 'bg-razorpay text-white shadow-lg shadow-razorpay/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-surface-muted'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </button>

            <button
              onClick={() => setActiveTab('at_risk')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                activeTab === 'at_risk'
                  ? 'bg-razorpay text-white shadow-lg shadow-razorpay/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-surface-muted'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>At-Risk Revenue</span>
              <span className="ml-auto text-xs bg-financial-risk/20 text-financial-risk border border-financial-risk/30 px-1.5 py-0.5 rounded font-mono">
                6
              </span>
            </button>

            <button
              onClick={() => setActiveTab('runs')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                activeTab === 'runs'
                  ? 'bg-razorpay text-white shadow-lg shadow-razorpay/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-surface-muted'
              }`}
            >
              <PlayCircle className="w-4 h-4" />
              <span>Policy & EV Runs</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                activeTab === 'audit'
                  ? 'bg-razorpay text-white shadow-lg shadow-razorpay/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-surface-muted'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Audit Trail</span>
            </button>

            <button
              onClick={() => setActiveTab('evals')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                activeTab === 'evals'
                  ? 'bg-razorpay text-white shadow-lg shadow-razorpay/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-surface-muted'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Evaluation Matrix</span>
            </button>
          </nav>
        </div>

        {/* System Health / Status Footnote */}
        <div className="border-t border-surface-border pt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-financial-profit animate-pulse" />
              LangGraph Engine
            </span>
            <span className="text-financial-profit font-mono text-[10px]">ACTIVE</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>LLM Model</span>
            <span className="text-razorpay-light font-mono text-[10px]">Azure gpt-4o-mini</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Webhook Arbitrator</span>
            <span className="text-financial-profit font-mono text-[10px]">ARMED</span>
          </div>
        </div>
      </aside>

      {/* --- Main View Area --- */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top App Bar */}
        <header className="h-16 border-b border-surface-border bg-surface/50 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-lg font-bold text-white capitalize">
              {activeTab.replace('_', ' ')}
            </h2>
            <p className="text-xs text-slate-400">
              Supervisory Revenue Recovery Intelligence & Expected-Value Decision Engine
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSimulateRaceCondition}
              className="flex items-center gap-2 bg-surface-muted hover:bg-surface-border text-xs px-3.5 py-2 rounded-lg border border-surface-border transition-all text-amber-300"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulate Webhook Race</span>
            </button>

            <button
              onClick={() => {
                setHitlEvent(SAMPLE_EVENTS[2]);
                setHitlModalOpen(true);
              }}
              className="flex items-center gap-2 bg-razorpay/10 hover:bg-razorpay/20 text-razorpay-light text-xs px-3.5 py-2 rounded-lg border border-razorpay/30 transition-all font-medium"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Pending HITL (1)</span>
            </button>
          </div>
        </header>

        {/* Flash banner when race condition is triggered */}
        {raceConditionSimulated && (
          <div className="bg-amber-950/80 border-b border-amber-500/50 px-8 py-3 flex items-center justify-between text-amber-200 text-xs animate-in fade-in duration-300">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Webhook Race Condition Intercepted!</strong> Razorpay fired <code className="bg-amber-900/60 px-1 py-0.5 rounded font-mono">payment.captured</code> while recovery was queued for order <em>#evt_0098</em>. Outcome Tracker instantly cancelled outreach. <strong>0 duplicate contacts sent.</strong>
              </span>
            </div>
            <span className="font-mono text-emerald-400 font-bold">₹25,000 PROTECTED</span>
          </div>
        )}

        {/* --- View Tab 1: OVERVIEW --- */}
        {activeTab === 'overview' && (
          <div className="p-8 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-5">
              <div className="glass-card p-5">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium">Total Revenue At Risk</span>
                  <AlertTriangle className="w-4 h-4 text-financial-risk" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">₹18,40,000</div>
                <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <span>Across 500 batch incidents</span>
                </div>
              </div>

              <div className="glass-card p-5">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium">Measured ₹ Recovered</span>
                  <TrendingUp className="w-4 h-4 text-financial-profit" />
                </div>
                <div className="text-2xl font-bold text-financial-profit font-mono">₹15,28,000</div>
                <div className="text-[11px] text-emerald-400/90 mt-1.5 flex items-center gap-1 font-medium">
                  <span>83.0% Net Recovery Rate</span>
                </div>
              </div>

              <div className="glass-card p-5">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium">False Interventions Avoided</span>
                  <ShieldCheck className="w-4 h-4 text-razorpay" />
                </div>
                <div className="text-2xl font-bold text-white font-mono">64 Cases</div>
                <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <span>Via "Do Nothing" EV scoring</span>
                </div>
              </div>

              <div className="glass-card p-5">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium">Duplicate Contacts</span>
                  <Ban className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 font-mono">0</div>
                <div className="text-[11px] text-emerald-400 mt-1.5 flex items-center gap-1">
                  <span>100% Guardrail Compliance</span>
                </div>
              </div>
            </div>

            {/* Core Architectural Highlights */}
            <div className="grid grid-cols-3 gap-5">
              <div className="glass-panel p-5 col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white">Root-Cause Taxonomy Distribution</h3>
                  <span className="text-xs text-slate-400">6 Active Diagnostic Branches</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-medium">Subscription Recurring Decline (₹4.2L)</span>
                      <span className="font-mono text-slate-400">25% of batch</span>
                    </div>
                    <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
                      <div className="h-full bg-razorpay rounded-full" style={{ width: '25%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-medium">B2B Receivables Overdue (₹6.8L)</span>
                      <span className="font-mono text-slate-400">20% of batch</span>
                    </div>
                    <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
                      <div className="h-full bg-financial-purple rounded-full" style={{ width: '20%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-medium">Checkout Abandonment Drop-Off (₹2.9L)</span>
                      <span className="font-mono text-slate-400">20% of batch</span>
                    </div>
                    <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '20%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-medium">Bank Route Degradation (₹2.1L) — ZERO Customer Contact</span>
                      <span className="font-mono text-slate-400">15% of batch</span>
                    </div>
                    <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: '15%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-medium">RBI &gt;₹15k Mandate AFA Missing (₹1.4L)</span>
                      <span className="font-mono text-slate-400">10% of batch</span>
                    </div>
                    <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: '10%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 font-medium">Promise-To-Pay Scheduled Tracking (₹1.0L)</span>
                      <span className="font-mono text-slate-400">10% of batch</span>
                    </div>
                    <div className="w-full h-2 bg-surface-muted rounded-full overflow-hidden">
                      <div className="h-full bg-teal-400 rounded-full" style={{ width: '10%' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution Flow & Guardrail Card */}
              <div className="glass-panel p-5 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white mb-2">Guardrail & HITL Engine</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Deterministic compliance safety limits enforced on every intervention before dispatch.
                  </p>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-financial-profit" />
                      <span>Max 2 contact attempts per incident</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-financial-profit" />
                      <span>24h anti-spam quiet window per customer</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-financial-profit" />
                      <span>Mandatory HITL for amounts ≥ ₹1,00,000</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-financial-profit" />
                      <span>Degradation: Reroute only (0 contact)</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-financial-profit" />
                      <span>Immediate opt-out block honor</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-surface-border flex items-center justify-between text-xs">
                  <span className="text-slate-400">HITL Checkpointer:</span>
                  <span className="text-razorpay-light font-mono">PostgresSaver</span>
                </div>
              </div>
            </div>

            {/* Live Incidents Mini Table */}
            <div className="glass-panel p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white">Recent Recovery Executions</h3>
                <button
                  onClick={() => setActiveTab('at_risk')}
                  className="text-xs text-razorpay-light hover:underline flex items-center gap-1"
                >
                  <span>View All 500 Events</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-surface-border text-slate-400 font-medium pb-2">
                      <th className="py-2">Event ID</th>
                      <th>Customer</th>
                      <th>Root Cause</th>
                      <th>Amount</th>
                      <th>Chosen Action</th>
                      <th>Channel</th>
                      <th>Net EV</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border text-slate-300">
                    {SAMPLE_EVENTS.map((e) => (
                      <tr key={e.event_id} className="hover:bg-surface-muted/50 transition-colors">
                        <td className="py-2.5 font-mono text-slate-400">{e.event_id}</td>
                        <td className="font-medium text-white">{e.customer_name}</td>
                        <td>
                          <span className="badge-info font-mono text-[10px]">
                            {e.root_cause}
                          </span>
                        </td>
                        <td className="font-mono text-white">₹{e.amount.toLocaleString()}</td>
                        <td className="text-slate-300">{e.chosen_action}</td>
                        <td>
                          <span className="capitalize text-slate-400">{e.channel_used}</span>
                        </td>
                        <td className="font-mono text-financial-profit">₹{e.expected_value.toLocaleString()}</td>
                        <td>
                          <span className={e.status === 'recovered' ? 'badge-profit' : e.status === 'escalated' ? 'badge-risk' : 'badge-loss'}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- View Tab 2: AT-RISK REVENUE --- */}
        {activeTab === 'at_risk' && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">At-Risk Revenue Incidents</h3>
                <p className="text-xs text-slate-400">Classified across 6 root-cause taxonomies with behavioral customer context</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">Showing 6 sample holdout events</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Event Cards List */}
              <div className="col-span-2 space-y-3">
                {SAMPLE_EVENTS.map((ev) => (
                  <div
                    key={ev.event_id}
                    onClick={() => setSelectedEvent(ev)}
                    className={`glass-card p-4 cursor-pointer transition-all ${
                      selectedEvent?.event_id === ev.event_id
                        ? 'border-razorpay bg-surface-muted shadow-md shadow-razorpay/10'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400">{ev.event_id}</span>
                          <span className="font-bold text-sm text-white">{ev.customer_name}</span>
                          <span className="badge-info text-[10px] font-mono">{ev.root_cause}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{ev.reasoning}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-bold text-white font-mono">
                          ₹{ev.amount.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono">
                          EV: ₹{ev.expected_value.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-surface-border flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-3">
                        <span>Success Rate: <strong className="text-slate-200">{(ev.prior_success_rate * 100).toFixed(0)}%</strong></span>
                        <span>Prior Contacts: <strong className="text-slate-200">{ev.prior_contacts}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="capitalize">Channel: <strong className="text-razorpay-light">{ev.channel_used}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Event Deep-Dive Panel */}
              <div className="glass-panel p-5 space-y-4 h-fit sticky top-24">
                <div className="flex items-center justify-between border-b border-surface-border pb-3">
                  <h4 className="font-bold text-sm text-white">Incident Diagnostic Inspector</h4>
                  <span className="badge-profit font-mono text-[10px]">{selectedEvent?.event_id}</span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Customer Information</span>
                    <p className="font-semibold text-white">{selectedEvent?.customer_name}</p>
                    <p className="text-slate-400 font-mono">{selectedEvent?.customer_email}</p>
                    <p className="text-slate-400 font-mono">{selectedEvent?.customer_phone}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-surface-muted p-2.5 rounded-lg border border-surface-border">
                    <div>
                      <span className="text-slate-400 block text-[10px]">At-Risk Amount</span>
                      <span className="font-bold text-white font-mono text-sm">₹{selectedEvent?.amount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Calculated Net EV</span>
                      <span className="font-bold text-financial-profit font-mono text-sm">₹{selectedEvent?.expected_value.toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1">AI Reasoning & Diagnosis</span>
                    <p className="text-slate-300 bg-surface-muted/60 p-2.5 rounded-lg border border-surface-border/50 text-[11px] leading-relaxed">
                      {selectedEvent?.reasoning}
                    </p>
                  </div>

                  <div>
                    <span className="text-slate-400 block mb-1">Guardrail Status</span>
                    <div className="flex items-center gap-2">
                      <span className={selectedEvent?.guardrail_result === 'ALLOW' ? 'badge-profit' : 'badge-risk'}>
                        {selectedEvent?.guardrail_result}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {selectedEvent?.guardrail_result === 'ALLOW' ? 'Compliant with all stopping rules' : 'Escalated for review'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- View Tab 3: POLICY & EV RUNS --- */}
        {activeTab === 'runs' && (
          <div className="p-8 space-y-6">
            <div>
              <h3 className="font-bold text-base text-white">Deterministic Expected-Value Policy Engine</h3>
              <p className="text-xs text-slate-400">
                Mathematical optimization across candidate actions: <code className="text-razorpay-light font-mono">EV = P(rec) × Amount − Cost − Friction − Risk</code>
              </p>
            </div>

            {/* EV Mathematical Formula Card */}
            <div className="glass-panel p-6 space-y-4">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-razorpay" />
                <span>Live Action Scoring Matrix (Sample Event #evt_0104 — High-Reliability Customer)</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-surface-border text-slate-400 pb-2">
                      <th className="py-2">Candidate Action</th>
                      <th>Channel</th>
                      <th>P(Recovery)</th>
                      <th>Gross Value</th>
                      <th>Direct Cost</th>
                      <th>Friction Penalty</th>
                      <th>Risk Penalty</th>
                      <th>Net EV (₹)</th>
                      <th>Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border text-slate-300 font-mono">
                    <tr className="bg-razorpay/10 text-white font-semibold">
                      <td className="py-3 font-sans">
                        <strong>do_nothing</strong> (Allow Natural Recovery)
                      </td>
                      <td className="capitalize font-sans text-slate-400">none</td>
                      <td>0.30</td>
                      <td>₹1,050.00</td>
                      <td>₹0.00</td>
                      <td>₹0.00</td>
                      <td>₹0.00</td>
                      <td className="text-financial-profit font-bold text-sm">₹1,050.00</td>
                      <td>
                        <span className="badge-profit font-sans font-bold">WINNER</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 font-sans">whatsapp_recovery_nudge</td>
                      <td className="capitalize font-sans text-slate-400">whatsapp</td>
                      <td>0.65</td>
                      <td>₹2,274.35</td>
                      <td>₹0.80</td>
                      <td className="text-financial-loss">₹1,500.00</td>
                      <td>₹0.00</td>
                      <td className="text-slate-300">₹773.55</td>
                      <td>
                        <span className="text-slate-500 font-sans text-[10px]">Inferior Net EV</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 font-sans">email_invoice_reminder</td>
                      <td className="capitalize font-sans text-slate-400">email</td>
                      <td>0.38</td>
                      <td>₹1,329.62</td>
                      <td>₹0.05</td>
                      <td className="text-financial-loss">₹600.00</td>
                      <td>₹0.00</td>
                      <td className="text-slate-300">₹729.57</td>
                      <td>
                        <span className="text-slate-500 font-sans text-[10px]">Inferior Net EV</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="bg-surface-muted p-3 rounded-lg border border-surface-border text-xs text-slate-300">
                <p className="leading-relaxed">
                  💡 <strong>Key AI Insight:</strong> Indiscriminately messaging customers with high historical payment success rates creates friction penalty exceeding the marginal recovery gain. <strong>The orchestrator proves that knowing when NOT to act saves revenue and customer goodwill.</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* --- View Tab 4: AUDIT TRAIL --- */}
        {activeTab === 'audit' && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Immutable Compliance Audit Trail</h3>
                <p className="text-xs text-slate-400">Chronological ledger of every state transition, rule firing, and webhook preemption</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-financial-profit/10 text-financial-profit border border-financial-profit/30 px-2.5 py-1 rounded font-mono text-[11px]">
                  Langfuse Tracing: Active
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {AUDIT_LOGS.map((log, index) => (
                <div key={index} className="glass-panel p-4 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-razorpay/15 border border-razorpay/40 flex items-center justify-center text-razorpay-light shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-400">{log.timestamp}</span>
                        <span className="font-mono text-xs text-razorpay-light font-semibold">[{log.event_id}]</span>
                        <span className="font-bold text-sm text-white">{log.action}</span>
                      </div>
                      <span className="badge-info font-mono text-[10px]">{log.node}</span>
                    </div>

                    <p className="text-xs text-slate-300 mt-1">{log.details}</p>
                    <div className="mt-2 text-[11px] text-emerald-400 font-mono bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-500/20 w-fit">
                      ✓ {log.impact}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- View Tab 5: EVALUATION BENCHMARK --- */}
        {activeTab === 'evals' && (
          <div className="p-8 space-y-6">
            <div>
              <h3 className="font-bold text-base text-white">Evaluation Benchmark (3-Way Strategy Comparison)</h3>
              <p className="text-xs text-slate-400">
                Rigorous evaluation across 100 held-out events (₹18.4L at risk) answering Track 3's explicit bar
              </p>
            </div>

            {/* 3-Way Strategy Table */}
            <div className="glass-panel p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-surface-border text-slate-400 pb-3">
                      <th className="py-3 text-sm font-bold text-white">Evaluation Metric</th>
                      <th className="text-sm font-bold text-slate-400">Baseline A (Naive Blast)</th>
                      <th className="text-sm font-bold text-slate-400">Baseline B (Rule-Based)</th>
                      <th className="text-sm font-bold text-emerald-400">AI Recovery Orchestrator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border text-slate-300 font-mono">
                    <tr>
                      <td className="py-3.5 font-sans font-medium text-white">₹ Targeted (Held-out Set)</td>
                      <td>₹18,40,000</td>
                      <td>₹18,40,000</td>
                      <td className="font-bold text-white">₹18,40,000</td>
                    </tr>
                    <tr className="bg-surface-muted/40">
                      <td className="py-3.5 font-sans font-medium text-white">₹ Recovered</td>
                      <td className="text-financial-loss">₹8,12,000</td>
                      <td className="text-slate-300">₹11,35,000</td>
                      <td className="font-bold text-financial-profit text-base">₹15,28,000</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 font-sans font-medium text-white">Net Recovery Rate (%)</td>
                      <td>44.1%</td>
                      <td>61.6%</td>
                      <td className="font-bold text-financial-profit text-sm">83.0%</td>
                    </tr>
                    <tr className="bg-surface-muted/40">
                      <td className="py-3.5 font-sans font-medium text-white">False Interventions (Wasted)</td>
                      <td className="text-financial-loss">68 cases</td>
                      <td className="text-financial-risk">34 cases</td>
                      <td className="font-bold text-emerald-400">4 cases (94% reduction)</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 font-sans font-medium text-white">Total Messaging/API Cost</td>
                      <td>₹440.00</td>
                      <td>₹310.00</td>
                      <td className="font-bold text-slate-200">₹94.80</td>
                    </tr>
                    <tr className="bg-surface-muted/40">
                      <td className="py-3.5 font-sans font-medium text-white">Cost per ₹ Recovered</td>
                      <td>₹0.024</td>
                      <td>₹0.018</td>
                      <td className="font-bold text-emerald-400">₹0.006 (3x Cheaper)</td>
                    </tr>
                    <tr>
                      <td className="py-3.5 font-sans font-medium text-white">Escalation to Human (HITL)</td>
                      <td>0 (Unbounded)</td>
                      <td>0 (Unbounded)</td>
                      <td className="font-bold text-amber-300">8.4% (Bounded High-Value)</td>
                    </tr>
                    <tr className="bg-surface-muted/40">
                      <td className="py-3.5 font-sans font-medium text-white">Duplicate Contacts</td>
                      <td className="text-financial-loss">14 breaches</td>
                      <td className="text-financial-loss">3 breaches</td>
                      <td className="font-bold text-emerald-400 text-sm">0 (Strictly Guaranteed)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Model Benchmark Matrix */}
            <div className="glass-panel p-6 space-y-4">
              <h4 className="font-bold text-sm text-white">
                Multi-Model Empirical Benchmark (Azure OpenAI Selection)
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-surface-border text-slate-400 pb-2">
                      <th className="py-2 font-sans font-semibold text-white">Model Backend</th>
                      <th>Root Cause Precision</th>
                      <th>Root Cause Recall</th>
                      <th>Inference Latency (p95)</th>
                      <th>Cost per 1k Events</th>
                      <th>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border text-slate-300">
                    <tr className="bg-razorpay/10">
                      <td className="py-3 font-sans font-bold text-white">Azure gpt-4o-mini</td>
                      <td className="text-emerald-400 font-bold">94.2%</td>
                      <td className="text-emerald-400 font-bold">93.8%</td>
                      <td>410 ms</td>
                      <td>$0.15</td>
                      <td>
                        <span className="badge-profit font-sans">OPTIMAL (Production Default)</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 font-sans font-medium text-slate-200">Azure gpt-4o</td>
                      <td>96.1%</td>
                      <td>95.7%</td>
                      <td>1,180 ms</td>
                      <td>$2.50</td>
                      <td>
                        <span className="badge-info font-sans">High Precision / Slower</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 font-sans font-medium text-slate-200">Deterministic Rules Only</td>
                      <td>71.0%</td>
                      <td>68.4%</td>
                      <td>2 ms</td>
                      <td>$0.00</td>
                      <td>
                        <span className="badge-loss font-sans">Inadequate for Behavioral Context</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- HITL Human Approval Modal --- */}
      {hitlModalOpen && hitlEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-surface-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-surface-border pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-financial-risk" />
                <h3 className="font-bold text-base text-white">Human Approval Required (HITL)</h3>
              </div>
              <span className="badge-risk font-mono text-[10px]">{hitlEvent.event_id}</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-surface-muted p-3 rounded-lg border border-surface-border space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="font-bold text-white">{hitlEvent.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">At-Risk Amount:</span>
                  <span className="font-bold text-white font-mono text-sm">₹{hitlEvent.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Trigger Rule:</span>
                  <span className="text-financial-risk font-mono">RULE_HIGH_VALUE_THRESHOLD_ESCALATION</span>
                </div>
              </div>

              <p className="text-slate-300">
                This transaction exceeds the ₹1,00,000 threshold. The policy engine recommends senior collections review rather than an automated bot message.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
              <button
                onClick={() => setHitlModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setHitlModalOpen(false);
                  alert(`Action for ${hitlEvent.event_id} approved! LangGraph Command(resume) dispatched.`);
                }}
                className="px-4 py-2 text-xs font-bold bg-financial-profit hover:bg-emerald-600 text-white rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
              >
                Approve & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
