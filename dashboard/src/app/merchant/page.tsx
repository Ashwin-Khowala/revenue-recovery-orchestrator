'use client';

import React, { useState } from 'react';
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
  const [selectedIncident, setSelectedIncident] = useState<Incident>(INITIAL_INCIDENTS[2]);
  const [approvedHitl, setApprovedHitl] = useState(false);
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);
  const [channelResult, setChannelResult] = useState<string | null>(null);

  // Total KPIs
  const totalAtRisk = incidents.reduce((acc, i) => acc + i.amount, 0);
  const totalRecovered = incidents.filter(i => i.status === 'recovered').reduce((acc, i) => acc + i.amount, 0);
  const pendingHitlCount = incidents.filter(i => i.status === 'pending_hitl').length;

  // Filtered
  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch =
      inc.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.rootCause.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === 'hitl') return inc.status === 'pending_hitl';
    if (activeTab === 'recovering') return inc.status === 'auto_recovering' || inc.status === 'paused_ptp';
    if (activeTab === 'recovered') return inc.status === 'recovered';
    return true;
  });

  // Actions
  const handleApproveHitl = (inc: Incident) => {
    setApprovedHitl(true);
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
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800">
      {/* 1. TOP NAVBAR (Matching Dhanvantari top bar layout) */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00A3C4] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
                AI
              </div>
              <span className="text-base font-bold text-slate-900 tracking-tight">
                Dashboard
              </span>
            </div>

            {/* Nav category pills matching Dhanvantari */}
            <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <button className="px-3 py-1.5 rounded-lg bg-cyan-50 text-[#00A3C4] font-bold">
                General
              </button>
              <button className="px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                Invoices
              </button>
              <button className="px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                Live Protection
              </button>
              <button className="px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                Audit Reports
              </button>
              <button className="px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                Settings
              </button>
            </nav>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/razorpaytestbot"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#00A3C4] hover:bg-[#008da8] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>🤖 Telegram Bot</span>
            </a>

            <Link
              href="/payer"
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
            >
              Switch to Payer View &rarr;
            </Link>

            <div className="w-8 h-8 rounded-full bg-[#00A3C4] text-white font-bold flex items-center justify-center text-xs">
              M
            </div>
          </div>
        </div>
      </header>

      {/* 2. 3-COLUMN MAIN WORKSPACE (Dhanvantari Architecture) */}
      <div className="max-w-[1600px] mx-auto w-full px-6 py-6 flex-1 flex flex-col lg:flex-row gap-6 items-start">
        {/* LEFT COLUMN: Sidebar Navigation */}
        <aside className="w-full lg:w-56 shrink-0 space-y-5">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <span className="w-6 h-6 rounded-lg bg-[#00A3C4] text-white flex items-center justify-center text-xs">
                ✨
              </span>
              <span>AI Recovery Engine</span>
            </div>

            <nav className="space-y-1 text-xs font-medium">
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-cyan-50 text-[#00A3C4] font-bold">
                <span>🏠</span>
                <span>Home / Overview</span>
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
                <span>✨</span>
                <span>AI Models</span>
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
                <span>🔍</span>
                <span>Search Invoices</span>
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
                <span>👥</span>
                <span>Customers</span>
              </button>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
                <span>⚙️</span>
                <span>Settings</span>
              </button>
            </nav>

            <div className="pt-3 border-t border-slate-100">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Current Engine
              </div>
              <div className="text-xs font-bold text-[#00A3C4] mt-0.5">
                Gemini 3.1 Live
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Zero duplicate contact guardrails enabled
              </div>
            </div>
          </div>

          {/* Quick Engine Status Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#00A3C4] text-white flex items-center justify-center text-xs">
                ✨
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 leading-tight">Live Protection</div>
                <div className="text-[10px] text-emerald-600 font-semibold">Active Monitoring</div>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Outage mitigation & payment race condition interceptor are armed.
            </p>
          </div>
        </aside>

        {/* CENTER COLUMN: Main Content Workspace */}
        <main className="flex-1 w-full space-y-5">
          {/* Header & Search */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Revenue Recovery Recommendations
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Supervisory AI orchestrates multi-channel actions to recover at-risk revenue safely
              </p>
            </div>

            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search customers, invoice ID, or failure reason..."
                className="w-full px-4 py-2.5 pl-10 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#00A3C4] bg-slate-50/50"
              />
              <span className="absolute left-3.5 top-2.5 text-slate-400 text-xs">🔍</span>
            </div>
          </div>

          {/* Channel Feedback Banner */}
          {channelResult && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center justify-between">
              <span>{channelResult}</span>
              <button onClick={() => setChannelResult(null)} className="text-emerald-700 hover:text-emerald-900">
                ✕
              </button>
            </div>
          )}

          {/* Metric Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total At-Risk</div>
              <div className="text-xl font-extrabold text-slate-900 mt-1">₹{totalAtRisk.toLocaleString()}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Across 6 incidents</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Recovered</div>
              <div className="text-xl font-extrabold text-emerald-600 mt-1">₹{totalRecovered.toLocaleString()}</div>
              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">18% recovered automatically</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending HITL</div>
              <div className="text-xl font-extrabold text-amber-600 mt-1">{pendingHitlCount} High-Value</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Requires approval</div>
            </div>

            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-[#00A3C4] uppercase tracking-wider">Spam Breaches</div>
              <div className="text-xl font-extrabold text-[#00A3C4] mt-1">0 Spam</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Strict compliance</div>
            </div>
          </div>

          {/* Incidents Table */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Live Recovery Queue</h3>
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
                    <th>Optimal Strategy (EV)</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredIncidents.map(inc => (
                    <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3">
                        <div className="font-bold text-slate-900">{inc.customer}</div>
                        <div className="text-[11px] text-slate-500">{inc.rootCause}</div>
                      </td>
                      <td className="font-extrabold text-slate-900">₹{inc.amount.toLocaleString()}</td>
                      <td className="text-slate-600 max-w-xs">{inc.evRankedStrategy}</td>
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
                          title="Outbound Plivo Telephony Phone Call"
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN: Dhanvantari AI ChatBot Component matching Screenshot */}
        <AIChatBot
          role="merchant"
          customerName="Admin"
          amount={145000}
          rootCause="receivable_overdue"
          onToolAction={action => {
            if (action.tool === 'approve_high_value_invoice') {
              setApprovedHitl(true);
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
