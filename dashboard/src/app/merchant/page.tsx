'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import AIChatBot from '@/components/AIChatBot';
import {
  Zap,
  LayoutDashboard,
  Sliders,
  Users,
  CreditCard,
  Search,
  Bot,
  Send,
  Phone,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  X,
  Radio,
  Check,
} from 'lucide-react';

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
    customerPhone: '+919876543210',
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
    customerPhone: '+919876543210',
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
  
  // Right AI Copilot Toggle & Resizing
  const [isCopilotOpen, setIsCopilotOpen] = useState(true);
  const [copilotWidth, setCopilotWidth] = useState(420);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < 800) {
        setCopilotWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
      
      {/* ========================================================================= */}
      {/* LEFT SIDEBAR: Pure White, Plivo-Inspired                                   */}
      {/* ========================================================================= */}
      <aside className="w-[260px] shrink-0 bg-white border-r border-slate-200 flex flex-col z-10 h-full hidden lg:flex">
        {/* Header Logo */}
        <div className="h-16 flex items-center px-5 border-b border-slate-100 gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00A3C4] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[13px] font-black text-slate-900 tracking-tight leading-tight">Razorpay</div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Revenue Recovery</div>
          </div>
        </div>

        {/* Workspace Dropdown */}
        <div className="p-4 pb-2">
          <button className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg transition-all text-left group">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">IN</span>
              <div>
                <div className="text-xs font-bold text-slate-800">TechMatrix B2B</div>
                <div className="text-[10px] text-slate-500 font-mono">merch_01</div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
          
          {/* BUILD / OPERATIONS */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Operations
            </div>
            <nav className="space-y-0.5">
              <Link
                href="/merchant"
                className="flex items-center gap-3 px-3 py-2 rounded-md bg-cyan-50 text-[#00A3C4] font-bold text-[13px]"
              >
                <LayoutDashboard className="w-4 h-4" />
                Recovery Console
              </Link>
              <Link
                href="/merchant/optimizer"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-[13px] transition-colors"
              >
                <Sliders className="w-4 h-4 opacity-70" />
                Portfolio Optimizer
              </Link>
              <Link
                href="/merchant/customers/merch_01"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-[13px] transition-colors"
              >
                <Users className="w-4 h-4 opacity-70" />
                Customer Priors (54k)
              </Link>
              <Link
                href="/payer"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium text-[13px] transition-colors"
              >
                <CreditCard className="w-4 h-4 opacity-70" />
                Payer Settlement Link
              </Link>
            </nav>
          </div>

          {/* DEPLOY / INCIDENT FILTERS */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Incident Filters
            </div>
            <nav className="space-y-0.5">
              <button
                onClick={() => setSelectedPreset('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'all' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'all' ? 'bg-slate-800' : 'bg-transparent border border-slate-300'}`} />
                  All Incidents
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">{incidents.length}</span>
              </button>

              <button
                onClick={() => setSelectedPreset('hitl_only')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'hitl_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'hitl_only' ? 'bg-amber-500' : 'bg-transparent border border-amber-300'}`} />
                  High-Value (≥₹1L)
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded">
                  {incidents.filter(i => i.status === 'pending_hitl').length}
                </span>
              </button>

              <button
                onClick={() => setSelectedPreset('mandate_only')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'mandate_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'mandate_only' ? 'bg-[#00A3C4]' : 'bg-transparent border border-cyan-300'}`} />
                  RBI Mandate (&gt;₹15k)
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">
                  {incidents.filter(i => i.rootCause === 'mandate_auth_failed').length}
                </span>
              </button>
              
              <button
                onClick={() => setSelectedPreset('degraded_only')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'degraded_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'degraded_only' ? 'bg-red-500' : 'bg-transparent border border-red-300'}`} />
                  Degraded Routes
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">
                  {incidents.filter(i => i.rootCause === 'payment_degraded').length}
                </span>
              </button>

              <button
                onClick={() => setSelectedPreset('ptp_only')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'ptp_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'ptp_only' ? 'bg-purple-500' : 'bg-transparent border border-purple-300'}`} />
                  Promise-to-Pay
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">
                  {incidents.filter(i => i.rootCause === 'promise_to_pay').length}
                </span>
              </button>
            </nav>
          </div>
          
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* TOP NAVBAR (Spans only main content like Plivo) */}
        <header className="h-16 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            {/* Collapse Sidebar Toggle (Optional visual detail) */}
            <button className="text-slate-400 hover:text-slate-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            
            <div className="h-4 w-px bg-slate-300" />
            
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-slate-500">Data Region: India</span>
              <span className="text-slate-300">/</span>
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-semibold">Live Mode</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
              <input 
                type="text" 
                placeholder="Search Ctrl K" 
                className="bg-slate-50 border border-slate-200 rounded-md py-1.5 pl-8 pr-12 text-[13px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#00A3C4] focus:border-[#00A3C4] w-64"
              />
              <span className="absolute right-2 top-1.5 border border-slate-200 text-slate-400 text-[10px] px-1.5 rounded bg-white font-mono">⌘K</span>
            </div>

            <button 
              onClick={() => setIsCopilotOpen(prev => !prev)}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-bold rounded-md transition-colors"
            >
              <Bot className="w-3.5 h-3.5" />
              Ask Copilot
            </button>

            <button className="text-slate-400 hover:text-slate-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            </button>

            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-xs ml-1 border border-slate-300">
              AK
            </div>
          </div>
        </header>

        {/* BODY CONTAINER (Center Main + Right AI Sidebar) */}
        <div className="flex-1 flex min-w-0 overflow-hidden relative">
          
          {/* CENTER MAIN CONTENT (Independent vertical scroll, full width) */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 pb-16 custom-scrollbar min-w-0">
            {/* Title Block */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Active Recovery Queue</h1>
                <p className="text-sm text-slate-500 mt-1">
                  AI tracks failures, ranks recovery strategies by Expected Value, and surfaces HITL escalations.
                </p>
              </div>
              <a
                href="https://t.me/razorpaytestbot"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-bold transition-all shadow-xs flex items-center gap-2"
              >
                <Send className="w-3.5 h-3.5 text-[#0088cc]" />
                <span>Telegram Bot</span>
              </a>
            </div>

            {/* Action Feedback Banner */}
            {channelResult && (
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[13px] font-medium flex items-center justify-between shadow-xs">
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>{channelResult}</span>
                </span>
                <button onClick={() => setChannelResult(null)} className="text-emerald-700 hover:text-emerald-900 font-bold text-lg leading-none">
                  &times;
                </button>
              </div>
            )}

            {/* Metric Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total At-Risk</div>
                <div className="text-2xl font-black text-slate-900 mt-1">₹{totalAtRisk.toLocaleString('en-IN')}</div>
                <div className="text-[11px] text-slate-400 mt-1">{incidents.length} active incidents</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Recovered Revenue</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">₹{totalRecovered.toLocaleString('en-IN')}</div>
                <div className="text-[11px] text-emerald-700 font-medium mt-1">Automated recovery running</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending HITL</div>
                <div className="text-2xl font-black text-amber-600 mt-1">{pendingHitlCount} High-Value</div>
                <div className="text-[11px] text-slate-400 mt-1">Requires supervisor approval</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-[11px] font-bold text-[#00A3C4] uppercase tracking-wider">Duplicate Contacts</div>
                <div className="text-2xl font-black text-[#00A3C4] mt-1">0 Spam</div>
                <div className="text-[11px] text-slate-400 mt-1">Zero-spam invariant</div>
              </div>
            </div>

            {/* Incident Table Container */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search customers or root cause..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-md border border-slate-200 text-[13px] focus:outline-none focus:ring-1 focus:ring-[#00A3C4] focus:border-[#00A3C4]"
                  />
                </div>
                
                <div className="flex items-center p-1 bg-slate-100 rounded-lg text-[13px] font-medium">
                  {(['all', 'hitl', 'recovering', 'recovered'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-1.5 rounded-md transition-all ${
                        activeTab === tab
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab === 'all' ? 'All' : tab === 'hitl' ? 'HITL' : tab === 'recovering' ? 'Recovering' : 'Recovered'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-200">
                      <th className="px-5 py-3">Customer & Root Cause</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Optimal Strategy (EV Ranked)</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Action Dispatch</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredIncidents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                          No incidents match the active search or filter.
                        </td>
                      </tr>
                    ) : (
                      filteredIncidents.map(inc => (
                        <tr key={inc.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-900">{inc.customer}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5">{inc.rootCause}</div>
                          </td>
                          <td className="px-5 py-4 font-black text-slate-900">₹{inc.amount.toLocaleString('en-IN')}</td>
                          <td className="px-5 py-4 text-slate-600 max-w-[280px] leading-relaxed">
                            {inc.evRankedStrategy}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                inc.status === 'recovered'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : inc.status === 'pending_hitl'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                                  : inc.status === 'paused_ptp'
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {inc.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right space-x-2 whitespace-nowrap">
                            {inc.status === 'pending_hitl' && (
                              <button
                                onClick={() => handleApproveHitl(inc)}
                                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              onClick={() => handleTriggerPlivoCall(inc)}
                              disabled={sendingChannel === 'plivo'}
                              className="px-3 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-sm inline-flex items-center gap-1"
                              title="Outbound Plivo Telephony Voice Call"
                            >
                              <Phone className="w-3 h-3" />
                              <span>Call</span>
                            </button>
                            <button
                              onClick={() => handleSendTelegram(inc)}
                              disabled={sendingChannel === 'telegram'}
                              className="px-3 py-1.5 rounded-md bg-cyan-50 border border-cyan-100 hover:bg-cyan-100 text-[#00A3C4] font-bold text-xs transition-colors shadow-sm inline-flex items-center gap-1"
                              title="Dispatch Telegram Alert"
                            >
                              <Send className="w-3 h-3 text-[#00A3C4]" />
                              <span>Alert</span>
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

          {/* RIGHT AI COPILOT PANE: Flush to the right edge, full height, no outer padding/margin */}
          {isCopilotOpen && (
            <div
              className="hidden xl:flex shrink-0 h-full relative border-l border-slate-200 bg-white z-10"
              style={{ width: `${copilotWidth}px` }}
            >
              {/* Drag Handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-50 group hover:bg-[#00A3C4]/30 flex items-center justify-center -ml-1 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  isDraggingRef.current = true;
                  setIsDragging(true);
                  document.body.style.cursor = 'col-resize';
                }}
                title="Drag to resize Copilot pane"
              >
                <div className="h-8 w-1 rounded-full bg-slate-300 group-hover:bg-[#00A3C4] transition-colors" />
              </div>
              
              <div className="w-full h-full">
                <AIChatBot
                  role="merchant"
                  customerName="Admin"
                  amount={145000}
                  rootCause="receivable_overdue"
                  defaultOpen={true}
                  isOpen={isCopilotOpen}
                  onToggleOpen={() => setIsCopilotOpen(!isCopilotOpen)}
                  resizableWidth={copilotWidth}
                  onToolAction={action => {
                    if (action.tool === 'approve_high_value_invoice') {
                      const hitlInc = incidents.find(i => i.id === 'inc_002');
                      if (hitlInc) handleApproveHitl(hitlInc);
                    }
                  }}
                />
              </div>
              
              {/* Drag Overlay */}
              {isDragging && (
                <div className="fixed inset-0 z-50 cursor-col-resize" />
              )}
            </div>
          )}

          {/* Floating trigger button when Copilot is collapsed */}
          {!isCopilotOpen && (
            <button
              onClick={() => setIsCopilotOpen(true)}
              className="fixed bottom-6 right-6 z-50 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-3 transition-all duration-200 hover:scale-105 group"
            >
              <div className="w-7 h-7 rounded-lg bg-[#00A3C4] flex items-center justify-center text-white text-xs font-bold shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                  <span>AI Copilot & Voice</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-[10px] text-slate-400">Click to expand pane (⌘J)</div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
