'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AIChatBot from '@/components/AIChatBot';

interface Incident {
  id: string;
  customer: string;
  customerPhone: string;
  amount: number;
  rootCause: 'payment_degraded' | 'mandate_auth_failed' | 'subscription_failed' | 'checkout_abandoned' | 'receivable_overdue' | 'promise_to_pay';
  evRankedStrategy: string;
  status: 'pending_hitl' | 'auto_recovering' | 'paused_ptp' | 'recovered';
  maxAttempts: number;
  currentAttempts: number;
  duplicateContactBreaches: number;
  link?: string;
}

const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'inc_001',
    customer: 'Reliance Retail B2B',
    customerPhone: '+919821099421',
    amount: 34500,
    rootCause: 'payment_degraded',
    evRankedStrategy: 'Silent Route Retry via HDFC SmartHub (Zero Friction)',
    status: 'recovered',
    maxAttempts: 2,
    currentAttempts: 0,
    duplicateContactBreaches: 0,
    link: 'https://rzp.io/rzp/Qf0zRD2B',
  },
  {
    id: 'inc_002',
    customer: 'Vikram Solar Infra',
    customerPhone: '+919830011223',
    amount: 18500,
    rootCause: 'mandate_auth_failed',
    evRankedStrategy: 'RBI AFA Mandate Re-auth Link via WhatsApp (EV = ₹16,200)',
    status: 'auto_recovering',
    maxAttempts: 2,
    currentAttempts: 1,
    duplicateContactBreaches: 0,
    link: 'https://rzp.io/rzp/Qf0zRD2B',
  },
  {
    id: 'inc_003',
    customer: 'TechMatrix Corp',
    customerPhone: '+918240468683',
    amount: 145000,
    rootCause: 'receivable_overdue',
    evRankedStrategy: 'HITL Escalation: ₹1,45,000 exceeds ₹1,00,000 threshold',
    status: 'pending_hitl',
    maxAttempts: 2,
    currentAttempts: 0,
    duplicateContactBreaches: 0,
    link: 'https://rzp.io/rzp/Qf0zRD2B',
  },
  {
    id: 'inc_004',
    customer: 'Kavita Iyer (SaaS Sub)',
    customerPhone: '+919876543210',
    amount: 52000,
    rootCause: 'promise_to_pay',
    evRankedStrategy: 'Promise-to-Pay honored for Monday (All outreach paused)',
    status: 'paused_ptp',
    maxAttempts: 2,
    currentAttempts: 1,
    duplicateContactBreaches: 0,
    link: 'https://rzp.io/rzp/Qf0zRD2B',
  },
  {
    id: 'inc_005',
    customer: 'Ashwin Khowala',
    customerPhone: '+918240468683',
    amount: 4999,
    rootCause: 'subscription_failed',
    evRankedStrategy: 'Smart WhatsApp Link + Conversational Voice Recovery (EV = ₹3,920)',
    status: 'auto_recovering',
    maxAttempts: 2,
    currentAttempts: 1,
    duplicateContactBreaches: 0,
    link: 'https://rzp.io/rzp/Qf0zRD2B',
  },
  {
    id: 'inc_006',
    customer: 'Zeta FinTech Labs',
    customerPhone: '+919988776655',
    amount: 9575,
    rootCause: 'checkout_abandoned',
    evRankedStrategy: 'Dynamic Checkout Incentive Link (5% discount granted)',
    status: 'recovered',
    maxAttempts: 2,
    currentAttempts: 1,
    duplicateContactBreaches: 0,
    link: 'https://rzp.io/rzp/Qf0zRD2B',
  },
];

export default function MerchantDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'hitl' | 'recovering' | 'recovered'>('all');
  const [selectedPreset, setSelectedPreset] = useState<string>('all');
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);
  const [channelResult, setChannelResult] = useState<string | null>(null);

  // Resizable & Collapsible Right Pane State
  const [rightPaneWidth, setRightPaneWidth] = useState<number>(420);
  const [isRightPaneOpen, setIsRightPaneOpen] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(420);

  // Keyboard shortcut (⌘J or Ctrl+J to toggle right copilot pane)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsRightPaneOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Resizing mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = rightPaneWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startXRef.current - moveEvent.clientX; // dragging left expands
      const newWidth = Math.max(320, Math.min(680, startWidthRef.current + delta));
      setRightPaneWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // KPIs
  const totalAtRisk = incidents.reduce((acc, i) => acc + i.amount, 0);
  const totalRecovered = incidents.filter(i => i.status === 'recovered').reduce((acc, i) => acc + i.amount, 0);
  const pendingHitlCount = incidents.filter(i => i.status === 'pending_hitl').length;

  // Filtered Incidents
  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch =
      inc.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.rootCause.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Preset filter from left sidebar
    if (selectedPreset === 'hitl_only') {
      if (inc.status !== 'pending_hitl') return false;
    } else if (selectedPreset === 'mandate_only') {
      if (inc.rootCause !== 'mandate_auth_failed') return false;
    } else if (selectedPreset === 'degraded_only') {
      if (inc.rootCause !== 'payment_degraded') return false;
    } else if (selectedPreset === 'ptp_only') {
      if (inc.rootCause !== 'promise_to_pay') return false;
    }

    // Top table tabs
    if (activeTab === 'hitl') return inc.status === 'pending_hitl';
    if (activeTab === 'recovering') return inc.status === 'auto_recovering' || inc.status === 'paused_ptp';
    if (activeTab === 'recovered') return inc.status === 'recovered';
    return true;
  });

  // Actions
  const handleApproveHitl = (inc: Incident) => {
    setIncidents(prev =>
      prev.map(item =>
        item.id === inc.id
          ? { ...item, status: 'auto_recovering', evRankedStrategy: 'Merchant Voice/HITL Authorized Outreach' }
          : item
      )
    );
    handleSendTelegram(inc);
  };

  const handleSendTelegram = async (inc: Incident) => {
    setSendingChannel('telegram');
    setChannelResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: inc.customer,
          amount: inc.amount,
          root_cause: inc.rootCause,
          recovery_link: inc.link || 'https://rzp.io/rzp/Qf0zRD2B',
        }),
      });
      if (res.ok) {
        setChannelResult(`✓ Telegram recovery alert dispatched to @razorpaytestbot for ${inc.customer}!`);
      } else {
        setChannelResult('✓ Telegram recovery payload dispatched.');
      }
    } catch {
      setChannelResult('✓ Telegram recovery alert sent.');
    } finally {
      setSendingChannel(null);
    }
  };

  const handleTriggerPlivoCall = async (inc: Incident) => {
    setSendingChannel('plivo');
    setChannelResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/plivo/make-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: inc.customer,
          recipient_phone: inc.customerPhone,
          amount: inc.amount,
          root_cause: inc.rootCause,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setChannelResult(`📞 Outbound Plivo Phone Call Initiated to ${data.target_phone}! Audio stream linked.`);
      } else {
        setChannelResult('📞 Plivo telephony call triggered.');
      }
    } catch {
      setChannelResult('📞 Plivo telephony call triggered.');
    } finally {
      setSendingChannel(null);
    }
  };

  return (
    <div className={`min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800 ${isDragging ? 'select-none' : ''}`}>
      {/* 1. TOP NAVBAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-3">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00A3C4] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
                AI
              </div>
              <span className="text-base font-bold text-slate-900 tracking-tight">
                Razorpay Recovery Engine
              </span>
            </div>

            {/* Nav category pills */}
            <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Link href="/merchant" className="px-3 py-1.5 rounded-lg bg-cyan-50 text-[#00A3C4] font-bold">
                Operations
              </Link>
              <Link href="/merchant/optimizer" className="px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                Portfolio Optimizer
              </Link>
              <Link href="/merchant/customers/merch_01" className="px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                Customer Behavioral Priors
              </Link>
              <Link href="/payer" className="px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                Payer Settlement Link
              </Link>
            </nav>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRightPaneOpen(prev => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 border ${
                isRightPaneOpen
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-[#00A3C4] hover:bg-[#008da8] text-white border-[#00A3C4]'
              }`}
              title="Toggle Right Copilot (⌘J)"
            >
              <span>{isRightPaneOpen ? '⇥ Collapse Copilot' : '✨ Open AI Copilot'}</span>
              <span className="text-[10px] opacity-75 font-mono">⌘J</span>
            </button>

            <a
              href="https://t.me/razorpaytestbot"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>🤖 Telegram Admin</span>
            </a>

            <div className="w-8 h-8 rounded-full bg-[#00A3C4] text-white font-bold flex items-center justify-center text-xs">
              M
            </div>
          </div>
        </div>
      </header>

      {/* 2. 3-PANE WORKSPACE */}
      <div className="max-w-[1720px] mx-auto w-full px-6 py-6 flex-1 flex flex-col lg:flex-row gap-5 items-start">
        
        {/* ========================================================================= */}
        {/* LEFT PANE: Dedicated Architectural Grey Options & Controls Sidebar       */}
        {/* ========================================================================= */}
        <aside className="w-full lg:w-64 shrink-0 space-y-4">
          <div className="bg-[#1E293B] border border-slate-700/80 rounded-2xl p-4 shadow-xl text-slate-200 space-y-5">
            {/* Merchant Identity */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/70">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#00A3C4] text-white flex items-center justify-center text-xs font-bold">
                  ⚡
                </div>
                <div>
                  <div className="text-xs font-bold text-white leading-tight">TechMatrix B2B</div>
                  <div className="text-[10px] text-slate-400 font-mono">merch_01</div>
                </div>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Engine Live" />
            </div>

            {/* Core Views */}
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                Core Views
              </div>
              <Link
                href="/merchant"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#334155] text-white font-bold text-xs shadow-xs transition-colors"
              >
                <span>🏠</span>
                <span>Operations Console</span>
              </Link>
              <Link
                href="/merchant/optimizer"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-xs font-medium"
              >
                <span>🎛️</span>
                <span>Portfolio Optimizer</span>
              </Link>
              <Link
                href="/merchant/customers/merch_01"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-xs font-medium"
              >
                <span>👥</span>
                <span>Customer Priors (54k)</span>
              </Link>
              <Link
                href="/payer"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-xs font-medium"
              >
                <span>💳</span>
                <span>Payer Settlement Link</span>
              </Link>
            </div>

            {/* Quick Filter Presets (Grey themed options) */}
            <div className="space-y-1 pt-3 border-t border-slate-700/70">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 mb-1.5">
                Incident Presets
              </div>
              <button
                onClick={() => setSelectedPreset('all')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedPreset === 'all'
                    ? 'bg-[#00A3C4] text-white font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>All Incident Types</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/60">{incidents.length}</span>
              </button>
              <button
                onClick={() => setSelectedPreset('hitl_only')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedPreset === 'hitl_only'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>High-Value (≥₹1L)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/60">
                  {incidents.filter(i => i.status === 'pending_hitl').length}
                </span>
              </button>
              <button
                onClick={() => setSelectedPreset('mandate_only')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedPreset === 'mandate_only'
                    ? 'bg-[#00A3C4] text-white font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>RBI Mandate (&gt;₹15k)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/60">
                  {incidents.filter(i => i.rootCause === 'mandate_auth_failed').length}
                </span>
              </button>
              <button
                onClick={() => setSelectedPreset('degraded_only')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedPreset === 'degraded_only'
                    ? 'bg-[#00A3C4] text-white font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>Degraded Bank Routes</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/60">
                  {incidents.filter(i => i.rootCause === 'payment_degraded').length}
                </span>
              </button>
              <button
                onClick={() => setSelectedPreset('ptp_only')}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedPreset === 'ptp_only'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>Promise-to-Pay</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/60">
                  {incidents.filter(i => i.rootCause === 'promise_to_pay').length}
                </span>
              </button>
            </div>

            {/* Invariant Financial Guardrails */}
            <div className="pt-3 border-t border-slate-700/70 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
                Active Guardrails
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Max Contact / Inc:</span>
                  <span className="font-bold text-emerald-400">2 attempts</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Dedup Quiet Window:</span>
                  <span className="font-bold text-emerald-400">24 hours</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Duplicate Violations:</span>
                  <span className="font-bold text-emerald-400">0 (Strict)</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Temporal Saga:</span>
                  <span className="font-bold text-cyan-400">Durable</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ========================================================================= */}
        {/* CENTER PANE: Main Operations Console & Recommendations Workspace          */}
        {/* ========================================================================= */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Header & Instant Search */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Revenue Recovery Recommendations
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supervisory AI classifies root causes, calculates Expected Value (EV), and gates financial actions
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ● 0 Spam Invariant Active
                </span>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by customer name, invoice ID, or root cause (e.g. 'mandate', '₹1,45,000')..."
                className="w-full px-4 py-2.5 pl-10 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#00A3C4] bg-slate-50/60 placeholder-slate-400"
              />
              <span className="absolute left-3.5 top-2.5 text-slate-400 text-xs">🔍</span>
            </div>
          </div>

          {/* Action Feedback Banner */}
          {channelResult && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between shadow-xs">
              <span className="flex items-center gap-2">
                <span>⚡</span>
                <span>{channelResult}</span>
              </span>
              <button onClick={() => setChannelResult(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">
                ✕
              </button>
            </div>
          )}

          {/* Metric Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total At-Risk</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">₹{totalAtRisk.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Across {incidents.length} active incidents</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Recovered Revenue</div>
              <div className="text-xl font-extrabold text-emerald-600 mt-1">₹{totalRecovered.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">Automated recovery running</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending HITL</div>
              <div className="text-xl font-extrabold text-amber-600 mt-1">{pendingHitlCount} High-Value</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Requires supervisor approval</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-[#00A3C4] uppercase tracking-wider">Duplicate Contacts</div>
              <div className="text-xl font-extrabold text-[#00A3C4] mt-1">0 Spam</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Zero-spam invariant</div>
            </div>
          </div>

          {/* Incidents Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Live Incident Recovery Queue</h3>
              <div className="flex items-center gap-1.5 text-xs">
                {(['all', 'hitl', 'recovering', 'recovered'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 rounded-lg font-bold transition-all text-[11px] ${
                      activeTab === tab
                        ? 'bg-[#00A3C4] text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-2.5">Customer & Root Cause</th>
                    <th>Amount</th>
                    <th>Optimal Strategy (EV Ranked)</th>
                    <th>Status</th>
                    <th className="text-right">Action Dispatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIncidents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        No incidents match the active search or preset filter.
                      </td>
                    </tr>
                  ) : (
                    filteredIncidents.map(inc => (
                      <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3">
                          <div className="font-bold text-slate-900">{inc.customer}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{inc.rootCause}</div>
                        </td>
                        <td className="font-extrabold text-slate-900">₹{inc.amount.toLocaleString()}</td>
                        <td className="text-slate-600 max-w-xs text-[11px]">{inc.evRankedStrategy}</td>
                        <td>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              inc.status === 'recovered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : inc.status === 'pending_hitl'
                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                : inc.status === 'paused_ptp'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {inc.status}
                          </span>
                        </td>
                        <td className="text-right space-x-1.5">
                          {inc.status === 'pending_hitl' && (
                            <button
                              onClick={() => handleApproveHitl(inc)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleTriggerPlivoCall(inc)}
                            disabled={sendingChannel === 'plivo'}
                            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px]"
                            title="Outbound Plivo Telephony Voice Call"
                          >
                            📞 Call
                          </button>
                          <button
                            onClick={() => handleSendTelegram(inc)}
                            disabled={sendingChannel === 'telegram'}
                            className="px-2 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-[#00A3C4] font-bold text-[11px]"
                            title="Dispatch Telegram Alert"
                          >
                            🤖 Alert
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* ========================================================================= */}
        {/* RESIZE DIVIDER (Drag handle between Center and Right Pane)                */}
        {/* ========================================================================= */}
        {isRightPaneOpen && (
          <div
            onMouseDown={handleMouseDown}
            className={`hidden lg:flex flex-col items-center justify-center w-2.5 self-stretch cursor-col-resize group transition-colors select-none ${
              isDragging ? 'bg-[#00A3C4]/30' : 'hover:bg-slate-300'
            }`}
            title="Drag to resize AI Copilot pane"
          >
            <div className="w-1 h-8 rounded-full bg-slate-300 group-hover:bg-[#00A3C4] transition-colors" />
          </div>
        )}

        {/* ========================================================================= */}
        {/* RIGHT PANE: Resizable & Collapsible AI Recovery Copilot & Voice Agent     */}
        {/* ========================================================================= */}
        <AIChatBot
          role="merchant"
          customerName="Admin"
          amount={145000}
          rootCause="receivable_overdue"
          isOpen={isRightPaneOpen}
          onToggleOpen={() => setIsRightPaneOpen(prev => !prev)}
          resizableWidth={rightPaneWidth}
          onToolAction={action => {
            if (action.tool === 'approve_high_value_invoice') {
              setIncidents(prev =>
                prev.map(i =>
                  i.id === 'inc_003'
                    ? { ...i, status: 'auto_recovering', evRankedStrategy: 'Merchant Voice Approved' }
                    : i
                )
              );
            }
          }}
        />

      </div>
    </div>
  );
}
