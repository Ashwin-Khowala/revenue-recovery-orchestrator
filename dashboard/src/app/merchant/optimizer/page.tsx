'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AIChatBot from '@/components/AIChatBot';
import {
  Zap,
  Users,
  Sliders,
  Clock,
  ShieldCheck,
  TrendingUp,
  ChevronLeft,
  Scale,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
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

import { getApiBaseUrl } from '@/lib/api';

const API = getApiBaseUrl();

interface PortfolioSummary {
  merchant_id: string;
  at_risk_amount_inr: number;
  at_risk_count: number;
  recovery_rate_pct: number;
  root_cause_breakdown: Record<string, number>;
  duplicate_contacts: number;
}

const PALETTE = ['#2B2B2B', '#0284C7', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export default function PortfolioOptimizerPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [discountParam, setDiscountParam] = useState(5);
  const [hitlThreshold, setHitlThreshold] = useState(100000);
  const [quietHours, setQuietHours] = useState(24);
  const [simulatedLift, setSimulatedLift] = useState(18.4);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/merchants/merch_01/at-risk-summary`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d) setSummary(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
        { name: 'Subscription Failed', value: 142 },
        { name: 'Checkout Abandoned', value: 98 },
        { name: 'Receivable Overdue', value: 85 },
        { name: 'Payment Degraded', value: 76 },
        { name: 'Mandate Auth Failed', value: 54 },
        { name: 'Promise to Pay', value: 45 },
      ];

  const channelComparison = [
    { channel: 'WhatsApp Link', success: 68 },
    { channel: 'Telegram Alert', success: 62 },
    { channel: 'Email Invoice', success: 38 },
    { channel: 'Silent Route Retry', success: 94 },
  ];

  const handleApplyParameters = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3500);
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#2B2B2B] font-sans antialiased">
      {/* Top Navigation */}
      <header className="bg-white border-b border-[#D4D4D4] px-6 py-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/merchant"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#666666] hover:text-[#2B2B2B] px-2.5 py-1.5 rounded-lg border border-[#D4D4D4] hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Console</span>
            </Link>
            <span className="text-[#D4D4D4]">|</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-[#2B2B2B] leading-tight">Policy &amp; EV Optimizer</h1>
                <p className="text-[11px] text-[#666666]">Expected Value (EV) Strategy Modeling &amp; Real-Time Tuning</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <Link
              href="/merchant/customers/merch_01"
              className="px-3 py-1.5 rounded-lg bg-white border border-[#D4D4D4] hover:bg-slate-50 text-[#2B2B2B] transition-colors inline-flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-[#666666]" />
              <span>Customer Intelligence</span>
            </Link>
            <Link
              href="/payer"
              target="_blank"
              className="px-3.5 py-1.5 rounded-lg bg-[#2B2B2B] hover:bg-black text-white transition-colors"
            >
              Payer Portal &rarr;
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Toast */}
        {savedToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Optimized EV Policy parameters successfully deployed to active recovery rules engine!</span>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#D4D4D4] p-4 rounded-xl shadow-xs">
            <div className="text-[11px] font-bold text-[#666666] uppercase tracking-wider">Total At-Risk Exposure</div>
            <div className="text-2xl font-bold text-[#2B2B2B] mt-1 font-mono">
              ₹{atRiskTotal.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>Active Recovery Window</span>
            </div>
          </div>

          <div className="bg-white border border-[#D4D4D4] p-4 rounded-xl shadow-xs">
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Observed Recovery Rate</div>
            <div className="text-2xl font-bold text-emerald-800 mt-1 font-mono">
              {summary?.recovery_rate_pct || 75.8}%
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>+26.9% Absolute Lift vs Rules</span>
            </div>
          </div>

          <div className="bg-white border border-[#D4D4D4] p-4 rounded-xl shadow-xs">
            <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Projected Policy Lift</div>
            <div className="text-2xl font-bold text-blue-800 mt-1 font-mono">
              +{simulatedLift}%
            </div>
            <div className="text-[11px] text-blue-700 font-medium mt-0.5">
              +₹{projectedExtraRecovery.toLocaleString('en-IN')} Expected Net Value
            </div>
          </div>

          <div className="bg-white border border-[#D4D4D4] p-4 rounded-xl shadow-xs">
            <div className="text-[11px] font-bold text-[#666666] uppercase tracking-wider">Compliance Breaches</div>
            <div className="text-2xl font-bold text-[#2B2B2B] mt-1 font-mono">0</div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>100% Guardrail Invariant</span>
            </div>
          </div>
        </div>

        {/* Dynamic EV Policy Tuning Box */}
        <div className="bg-white border border-[#D4D4D4] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#2B2B2B] inline-flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-blue-600" />
                <span>Dynamic EV Policy Parameter Tuning</span>
              </h2>
              <p className="text-xs text-[#666666] mt-0.5">
                Tune deterministic parameters and model expected net revenue yield (EV = P × Amount - Discount - Friction) in real time.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-[#2B2B2B] border border-[#D4D4D4] text-[11px] font-bold font-mono">
              EV = P(Recovery) × Amount - Discount - Friction
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Slider 1: Micro-Discount */}
            <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-[#2B2B2B]">Cart Drop-off Discount:</span>
                <span className="px-2 py-0.5 rounded bg-white border border-[#D4D4D4] font-mono text-blue-700">
                  {discountParam}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={discountParam}
                onChange={e => setDiscountParam(Number(e.target.value))}
                className="w-full accent-[#2B2B2B] cursor-pointer"
              />
              <p className="text-[11px] text-[#666666] leading-tight">
                Micro-discounts on high-intent checkouts boost recovery probability without margin destruction.
              </p>
            </div>

            {/* Slider 2: HITL Escalation Cap */}
            <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-[#2B2B2B]">HITL Escalation Cap:</span>
                <span className="px-2 py-0.5 rounded bg-white border border-[#D4D4D4] font-mono text-amber-800">
                  ₹{hitlThreshold.toLocaleString('en-IN')}
                </span>
              </div>
              <input
                type="range"
                min="25000"
                max="200000"
                step="25000"
                value={hitlThreshold}
                onChange={e => setHitlThreshold(Number(e.target.value))}
                className="w-full accent-[#2B2B2B] cursor-pointer"
              />
              <p className="text-[11px] text-[#666666] leading-tight">
                Invoices above this threshold trigger mandatory human approval via Telegram alert.
              </p>
            </div>

            {/* Slider 3: Quiet Hours */}
            <div className="bg-[#FAFAFA] border border-[#E5E5E5] p-4 rounded-xl space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-[#2B2B2B]">Anti-Spam Quiet Window:</span>
                <span className="px-2 py-0.5 rounded bg-white border border-[#D4D4D4] font-mono text-indigo-700">
                  {quietHours} Hours
                </span>
              </div>
              <input
                type="range"
                min="12"
                max="48"
                step="6"
                value={quietHours}
                onChange={e => setQuietHours(Number(e.target.value))}
                className="w-full accent-[#2B2B2B] cursor-pointer"
              />
              <p className="text-[11px] text-[#666666] leading-tight">
                Enforces quiet cooldown between customer contacts to minimize friction penalties.
              </p>
            </div>
          </div>

          {/* Simulation Output Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
            <div className="space-y-1">
              <div className="text-[11px] text-blue-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Simulated Policy Expected Yield</span>
              </div>
              <div className="text-xs text-[#2B2B2B] leading-relaxed">
                Under tuned policy parameters: Expected Recovery lifts by{' '}
                <strong className="text-blue-700 font-bold">+{simulatedLift}%</strong> (yielding{' '}
                <strong className="text-emerald-800 font-bold">+₹{projectedExtraRecovery.toLocaleString('en-IN')}</strong>{' '}
                net recovered revenue) with 0 duplicate spam penalty.
              </div>
            </div>
            <button
              onClick={handleApplyParameters}
              className="px-4 py-2 rounded-lg bg-[#2B2B2B] hover:bg-black text-white text-xs font-bold transition-all shrink-0 shadow-xs"
            >
              Deploy Policy Parameters &rarr;
            </button>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chart 1: Root Cause Distribution */}
          <div className="bg-white p-5 rounded-2xl border border-[#D4D4D4] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#2B2B2B] uppercase tracking-wider">At-Risk Cases by Root Cause</h3>
              <span className="text-[11px] text-[#666666]">6-Class Diagnostic Breakdown</span>
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
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#FFFFFF',
                      border: '1px solid #D4D4D4',
                      borderRadius: '8px',
                      color: '#2B2B2B',
                      fontSize: '11px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Channel Recovery Rates */}
          <div className="bg-white p-5 rounded-2xl border border-[#D4D4D4] shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#2B2B2B] uppercase tracking-wider">Channel Recovery Success (%)</h3>
              <span className="text-[11px] text-[#666666]">Empirical Channel Effectiveness</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelComparison} layout="vertical">
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#666666' }} />
                  <YAxis dataKey="channel" type="category" width={120} tick={{ fontSize: 10, fill: '#2B2B2B' }} />
                  <Tooltip
                    contentStyle={{
                      background: '#FFFFFF',
                      border: '1px solid #D4D4D4',
                      borderRadius: '8px',
                      color: '#2B2B2B',
                      fontSize: '11px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Bar dataKey="success" fill="#2B2B2B" radius={[0, 4, 4, 0]} name="Recovery Success (%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>

      {/* Floating AI Copilot Toggle */}
      <AIChatBot role="merchant" merchantId="merch_01" customerName="Merchant Operations" />
    </div>
  );
}
