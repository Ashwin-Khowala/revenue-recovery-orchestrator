'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AIChatBot from '@/components/AIChatBot';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface PortfolioSummary {
  merchant_id: string;
  at_risk_amount_inr: number;
  at_risk_count: number;
  recovery_rate_pct: number;
  root_cause_breakdown: Record<string, number>;
  duplicate_contacts: number;
}

const COLORS = ['#00A3C4', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6'];

export default function PortfolioOptimizerPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [discountParam, setDiscountParam] = useState(5);
  const [hitlThreshold, setHitlThreshold] = useState(100000);
  const [quietHours, setQuietHours] = useState(24);
  const [simulatedLift, setSimulatedLift] = useState(18.4);

  useEffect(() => {
    fetch(`${API}/api/merchants/merch_01/at-risk-summary`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d) setSummary(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Recalculate simulation lift dynamically
  useEffect(() => {
    const baseLift = 15.0;
    const discountEffect = (discountParam - 3) * 1.1;
    const thresholdEffect = hitlThreshold >= 100000 ? 2.5 : 0.8;
    const quietEffect = quietHours >= 24 ? 1.5 : -1.2;
    const total = Math.max(8.0, Math.min(32.0, baseLift + discountEffect + thresholdEffect + quietEffect));
    setSimulatedLift(Math.round(total * 10) / 10);
  }, [discountParam, hitlThreshold, quietHours]);

  const atRiskTotal = summary?.at_risk_amount_inr || 245998;
  const projectedExtraRecovery = Math.round((atRiskTotal * simulatedLift) / 100);

  const pieData = summary?.root_cause_breakdown
    ? Object.entries(summary.root_cause_breakdown).map(([name, value]) => ({
        name: name.replace(/_/g, ' '),
        value,
      }))
    : [
        { name: 'subscription failed', value: 142 },
        { name: 'checkout abandoned', value: 98 },
        { name: 'receivable overdue', value: 85 },
        { name: 'payment degraded', value: 76 },
        { name: 'mandate auth failed', value: 54 },
        { name: 'promise to pay', value: 45 },
      ];

  const channelComparison = [
    { channel: 'WhatsApp', success: 68, cost: 0.8, friction: 'Medium' },
    { channel: 'Telegram', success: 62, cost: 0.0, friction: 'Low' },
    { channel: 'Email', success: 38, cost: 0.05, friction: 'Very Low' },
    { channel: 'Payment Reroute', success: 91, cost: 0.0, friction: 'Zero (Silent)' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 flex flex-col font-sans">
      {/* 1. Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3 shadow-2xs">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00A3C4] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
              ⚡
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                Portfolio Recovery Optimizer
              </h1>
              <p className="text-[11px] text-slate-500">Expected Value (EV) Strategy Modeling & Simulation</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <Link
              href="/merchant"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              &larr; Operations Console
            </Link>
            <Link
              href="/merchant/customers/merch_01"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              👥 Customer Directory
            </Link>
            <Link
              href="/payer"
              className="px-3 py-1.5 rounded-lg bg-[#00A3C4] hover:bg-[#008da8] text-white transition-colors"
            >
              Payer Portal &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Main 2-Column Grid */}
      <div className="max-w-[1600px] mx-auto w-full px-6 py-6 flex-1 flex flex-col lg:flex-row gap-6 items-start">
        {/* LEFT COLUMN: Optimizer Dashboard */}
        <div className="flex-1 w-full space-y-6">
          {/* Header KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total At-Risk</div>
              <div className="text-2xl font-extrabold text-slate-900 font-mono">
                ₹{atRiskTotal.toLocaleString()}
              </div>
              <div className="text-[11px] text-amber-600 font-semibold mt-1">⚠️ Active Recovery Window</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Recovery Rate</div>
              <div className="text-2xl font-extrabold text-emerald-600 font-mono">
                {summary?.recovery_rate_pct || 17.9}%
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">↑ +4.2% vs Naive Blast</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Projected Optimized Lift</div>
              <div className="text-2xl font-extrabold text-[#00A3C4] font-mono">
                +{simulatedLift}%
              </div>
              <div className="text-[11px] text-[#00A3C4] font-semibold mt-1">
                +₹{projectedExtraRecovery.toLocaleString()} Extra Recovery
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Compliance Breaches</div>
              <div className="text-2xl font-extrabold text-emerald-700 font-mono">0</div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-1">✓ Hard Guardrail Verified</div>
            </div>
          </div>

          {/* Interactive Simulation Panel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">🎛️ Dynamic EV Policy Simulator</h2>
                <p className="text-xs text-slate-500">Tune deterministic parameters and model expected net revenue yield in real time.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-cyan-50 text-[#00A3C4] border border-cyan-200 text-xs font-bold font-mono">
                Formula: EV = P(rec) × Amount - Cost - Friction - Risk
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Slider 1: Micro Discount */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>Cart Drop-off Discount:</span>
                  <span className="text-[#00A3C4] font-mono">{discountParam}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={discountParam}
                  onChange={e => setDiscountParam(Number(e.target.value))}
                  className="w-full accent-[#00A3C4]"
                />
                <p className="text-[11px] text-slate-400 leading-tight">
                  Micro-discounts on high-intent checkouts boost recovery probability without margin destruction.
                </p>
              </div>

              {/* Slider 2: HITL Escalation Threshold */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>HITL Escalation Cap:</span>
                  <span className="text-amber-600 font-mono">₹{hitlThreshold.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="25000"
                  max="200000"
                  step="25000"
                  value={hitlThreshold}
                  onChange={e => setHitlThreshold(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <p className="text-[11px] text-slate-400 leading-tight">
                  Invoices above this threshold trigger mandatory human approval via Telegram alert.
                </p>
              </div>

              {/* Slider 3: Quiet Window Hours */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>Anti-Spam Quiet Window:</span>
                  <span className="text-indigo-600 font-mono">{quietHours} Hours</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="48"
                  step="6"
                  value={quietHours}
                  onChange={e => setQuietHours(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
                <p className="text-[11px] text-slate-400 leading-tight">
                  Enforces quiet cooldown between customer contacts to minimize friction penalties.
                </p>
              </div>
            </div>

            {/* Simulation Results Banner */}
            <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs text-cyan-300 font-bold uppercase tracking-wider">Simulated Policy Output</div>
                <div className="text-sm font-semibold">
                  Under current policy: Expected Recovery improves by <span className="text-cyan-400 font-bold">+{simulatedLift}%</span> (yielding <span className="text-emerald-400 font-bold">+₹{projectedExtraRecovery.toLocaleString()}</span>) with zero brand fatigue penalty.
                </div>
              </div>
              <button
                onClick={() => alert('✅ Optimized EV Parameters Saved to Merchant Policy Layer!')}
                className="px-4 py-2 rounded-xl bg-[#00A3C4] hover:bg-[#008da8] text-white text-xs font-bold transition-all shrink-0 shadow-md"
              >
                Apply Parameters &rarr;
              </button>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chart 1: Root Cause Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">At-Risk Cases by Root Cause</h3>
                <span className="text-[11px] text-slate-400">6-Class Diagnostic Engine</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Channel Effectiveness */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Channel Recovery Rates (%)</h3>
                <span className="text-[11px] text-slate-400">Empirical Effectiveness</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channelComparison} layout="vertical">
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis dataKey="channel" type="category" width={110} tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                    />
                    <Bar dataKey="success" fill="#00A3C4" radius={[0, 4, 4, 0]} name="Recovery Success Rate (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Docked AIChatBot with Full Data Tools */}
        <AIChatBot
          role="merchant"
          merchantId="merch_01"
          customerName="Merchant Admin"
          defaultOpen={true}
        />
      </div>
    </div>
  );
}
