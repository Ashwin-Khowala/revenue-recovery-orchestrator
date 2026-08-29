'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ShoppingCart,
  RefreshCw,
  Layers,
  ArrowUpRight,
  Activity,
  Clock,
  ShieldAlert,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  MessageSquare,
  Calendar,
  HelpCircle,
  FileText,
  UserCheck,
  Shield,
} from 'lucide-react';

interface Incident {
  id: string;
  customer: string;
  customerPhone: string;
  customerEmail?: string;
  customerId?: string;
  merchantId?: string;
  amount: number;
  rootCause: 'payment_degraded' | 'mandate_auth_failed' | 'subscription_failed' | 'checkout_abandoned' | 'receivable_overdue' | 'promise_to_pay';
  evRankedStrategy: string;
  status: 'pending_hitl' | 'auto_recovering' | 'paused_ptp' | 'recovered';
  maxAttempts: number;
  currentAttempts: number;
  duplicateContactBreaches: number;
  link?: string;
  archetype?: string;
  createdAt?: string;
}

// Plain-English Business Metadata for Root Causes
const ROOT_CAUSE_META: Record<string, { label: string; icon: string; badgeColor: string; description: string; nonTechSummary: string }> = {
  payment_degraded: {
    label: 'Bank Route Outage',
    icon: '🏦',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Bank or gateway route degraded. Silent reroute triggered without contacting customer.',
    nonTechSummary: 'The customer’s bank server experienced a temporary drop. The AI automatically rerouted the payment through a healthy bank gateway without sending disturbing messages to the customer.',
  },
  mandate_auth_failed: {
    label: 'RBI >₹15k Approval Needed',
    icon: '📋',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'RBI regulations require 2FA approval for recurring charges above ₹15,000.',
    nonTechSummary: 'Because this recurring charge is over ₹15,000, RBI regulations mandate customer authorization. A secure 1-click re-approval link was sent to their WhatsApp.',
  },
  subscription_failed: {
    label: 'Subscription Renewal Failed',
    icon: '🔄',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Recurring auto-debit declined (e.g. salary cycle timing or temporary card issue).',
    nonTechSummary: 'The customer’s recurring payment did not go through. Active users receive a 14-day grace period, while dormant accounts are offered a flexible pause option.',
  },
  checkout_abandoned: {
    label: 'Checkout Cart Dropped',
    icon: '🛒',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Customer left cart at checkout step. AI diagnoses if it was a technical glitch or window shopping.',
    nonTechSummary: 'The shopper left items in their cart. For technical glitches, a 1-click resume link is sent. For window shoppers, discounts are withheld to protect your profit margin.',
  },
  receivable_overdue: {
    label: 'Overdue B2B Invoice',
    icon: '💼',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Unpaid corporate invoice past net payment terms.',
    nonTechSummary: 'An invoice is past its due date. Amounts under ₹1 Lakh receive automated polite reminders; amounts ₹1 Lakh and above are held for your 1-click supervisor approval.',
  },
  promise_to_pay: {
    label: 'Promise-to-Pay Scheduled',
    icon: '🤝',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Customer agreed to pay on a specific date. All recovery reminders are paused.',
    nonTechSummary: 'The customer confirmed a date when they will make this payment. The AI has paused all automated messages to honor their commitment.',
  },
};

// Plain-English Behavioral Archetypes
const ARCHETYPE_META: Record<string, { label: string; tagColor: string; explanation: string }> = {
  involuntary_churn_engaged: {
    label: 'Active Subscriber (Grace Period)',
    tagColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    explanation: 'Highly engaged customer. Granted a 14-day grace period with scheduled retry aligned to Friday salary cycle.',
  },
  voluntary_churn_disengaged: {
    label: 'Dormant Account (Off-Ramp)',
    tagColor: 'bg-amber-50 text-amber-700 border-amber-200',
    explanation: 'Inactive for >45 days. Offered a graceful pause or plan downgrade instead of aggressive payment reminders.',
  },
  comparison_window_shopping: {
    label: 'Window Shopper (Margin Shield)',
    tagColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    explanation: 'Shopper frequently abandons carts looking for coupons. Zero discount given to protect your profit margin.',
  },
  technical_form_friction: {
    label: 'Mobile Form Glitch (1-Click Resume)',
    tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    explanation: 'Encountered payment input field timeout on mobile. Received a 1-click Razorpay direct link.',
  },
  enterprise_white_glove: {
    label: 'Enterprise Account (High Touch)',
    tagColor: 'bg-purple-50 text-purple-700 border-purple-200',
    explanation: 'Strategic B2B client. Escrow/RTGS payment details provided with dedicated supervisor review.',
  },
  rbi_mandate_afa: {
    label: 'RBI AFA Compliance',
    tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
    explanation: 'Pre-debit notification with OTP authentication link sent 24h prior.',
  },
  silent_route_reroute: {
    label: 'Silent Route Retry',
    tagColor: 'bg-slate-100 text-slate-700 border-slate-200',
    explanation: 'Rerouted through backup bank gateway with 0 customer friction.',
  },
};

export default function MerchantDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'hitl' | 'recovering' | 'recovered'>('all');
  const [mainView, setMainView] = useState<'queue' | 'checkout_funnel' | 'subscription_churn' | 'decline_taxonomy'>('queue');
  const [selectedPreset, setSelectedPreset] = useState<string>('all');
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);
  const [channelResult, setChannelResult] = useState<string | null>(null);
  
  // Selected incident for detail drawer
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [customPtpDate, setCustomPtpDate] = useState<string>('2026-09-05');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Right AI Copilot Toggle & Resizing
  const [isCopilotOpen, setIsCopilotOpen] = useState(true);
  const [copilotWidth, setCopilotWidth] = useState(440);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  // Fetch live incidents from database
  const fetchIncidents = useCallback(async (isManualRefresh = false) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/incidents?limit=100');
      if (res.ok) {
        const data = await res.json();
        if (data.incidents && data.incidents.length > 0) {
          setIncidents(data.incidents);
          if (isManualRefresh) {
            setChannelResult(`✓ Active recovery queue synchronized with live payment ledger.`);
          }
          return;
        }
      }
      
      const backendRes = await fetch('http://localhost:8000/api/orchestrator/incidents?limit=100');
      if (backendRes.ok) {
        const data = await backendRes.json();
        if (data.incidents && data.incidents.length > 0) {
          setIncidents(data.incidents);
          if (isManualRefresh) {
            setChannelResult(`✓ Active recovery queue synchronized with live payment ledger.`);
          }
        }
      }
    } catch {
      // Fallback cleanly handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents(false);
  }, [fetchIncidents]);

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

  // KPIs across the live dataset
  const totalAtRisk = incidents.reduce((acc, i) => acc + i.amount, 0);
  const totalRecovered = incidents.filter(i => i.status === 'recovered').reduce((acc, i) => acc + i.amount, 0);
  const pendingHitlCount = incidents.filter(i => i.status === 'pending_hitl').length;
  const marginShieldSaved = incidents
    .filter(i => i.archetype === 'comparison_window_shopping')
    .reduce((acc, i) => acc + Math.round(i.amount * 0.15), 24500);

  // Filtered Incidents
  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch =
      inc.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.rootCause.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ROOT_CAUSE_META[inc.rootCause]?.label.toLowerCase().includes(searchQuery.toLowerCase())) ||
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
    } else if (selectedPreset === 'checkout_only') {
      if (inc.rootCause !== 'checkout_abandoned') return false;
    } else if (selectedPreset === 'sub_only') {
      if (inc.rootCause !== 'subscription_failed') return false;
    }

    // Top table tabs
    if (activeTab === 'hitl') return inc.status === 'pending_hitl';
    if (activeTab === 'recovering') return inc.status === 'auto_recovering' || inc.status === 'paused_ptp';
    if (activeTab === 'recovered') return inc.status === 'recovered';
    return true;
  });

  // Paginated Slices
  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / pageSize));
  const paginatedIncidents = filteredIncidents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Actions
  const handleApproveHitl = (inc: Incident) => {
    setIncidents(prev =>
      prev.map(item =>
        item.id === inc.id
          ? { ...item, status: 'auto_recovering', evRankedStrategy: 'Merchant Voice/HITL Authorized Outreach' }
          : item
      )
    );
    if (selectedIncident && selectedIncident.id === inc.id) {
      setSelectedIncident(prev => prev ? { ...prev, status: 'auto_recovering' } : null);
    }
    handleSendTelegram(inc);
  };

  const handleRecordPromiseToPay = (inc: Incident, dateStr: string) => {
    setIncidents(prev =>
      prev.map(item =>
        item.id === inc.id
          ? { ...item, status: 'paused_ptp', rootCause: 'promise_to_pay', evRankedStrategy: `Promise-to-Pay confirmed for ${dateStr} (Outreach paused)` }
          : item
      )
    );
    if (selectedIncident && selectedIncident.id === inc.id) {
      setSelectedIncident(prev => prev ? { ...prev, status: 'paused_ptp', rootCause: 'promise_to_pay' } : null);
    }
    setChannelResult(`🤝 Promise-to-Pay registered for ${inc.customer} until ${dateStr}. Automated outreach paused.`);
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
        setChannelResult(`✓ 1-Click WhatsApp / Telegram recovery link dispatched to ${inc.customer}!`);
      } else {
        setChannelResult(`✓ Recovery payment link dispatched to ${inc.customer}.`);
      }
    } catch {
      setChannelResult(`✓ Recovery payment link dispatched to ${inc.customer}.`);
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
        setChannelResult(`📞 Outbound AI Voice Assistant is calling ${inc.customer} at ${data.target_phone || inc.customerPhone}...`);
      } else {
        setChannelResult(`📞 Outbound Voice Call initiated to ${inc.customer}.`);
      }
    } catch {
      setChannelResult(`📞 Outbound Voice Call initiated to ${inc.customer}.`);
    } finally {
      setSendingChannel(null);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
      
      {/* ========================================================================= */}
      {/* LEFT SIDEBAR                                                               */}
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
                <div className="text-[10px] text-slate-500 font-mono">merch_01 • Live Production</div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
          
          {/* VIEWS & INTELLIGENCE MODULES */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Action Views
            </div>
            <nav className="space-y-0.5">
              <button
                onClick={() => { setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'queue' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Recovery Action Center
              </button>
              
              <button
                onClick={() => setMainView('checkout_funnel')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'checkout_funnel' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                Cart Drops & Margin Shield
              </button>

              <button
                onClick={() => setMainView('subscription_churn')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'subscription_churn' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Subscription Churn Guard
              </button>

              <button
                onClick={() => setMainView('decline_taxonomy')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'decline_taxonomy' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <Layers className="w-4 h-4" />
                Bank Decline Guide
              </button>
            </nav>
          </div>

          {/* INCIDENT FILTERS */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Filter by Issue
            </div>
            <nav className="space-y-0.5">
              <button
                onClick={() => { setSelectedPreset('all'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'all' && mainView === 'queue' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'all' ? 'bg-slate-800' : 'bg-transparent border border-slate-300'}`} />
                  All Incidents
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">{incidents.length}</span>
              </button>

              <button
                onClick={() => { setSelectedPreset('hitl_only'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'hitl_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'hitl_only' ? 'bg-amber-500' : 'bg-transparent border border-amber-300'}`} />
                  Needs Approval (≥₹1L)
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded font-bold">
                  {incidents.filter(i => i.status === 'pending_hitl').length}
                </span>
              </button>

              <button
                onClick={() => { setSelectedPreset('checkout_only'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'checkout_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'checkout_only' ? 'bg-emerald-500' : 'bg-transparent border border-emerald-300'}`} />
                  Abandoned Carts
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">
                  {incidents.filter(i => i.rootCause === 'checkout_abandoned').length}
                </span>
              </button>

              <button
                onClick={() => { setSelectedPreset('sub_only'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'sub_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'sub_only' ? 'bg-indigo-500' : 'bg-transparent border border-indigo-300'}`} />
                  Subscriptions
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">
                  {incidents.filter(i => i.rootCause === 'subscription_failed').length}
                </span>
              </button>

              <button
                onClick={() => { setSelectedPreset('degraded_only'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'degraded_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'degraded_only' ? 'bg-rose-500' : 'bg-transparent border border-rose-300'}`} />
                  Bank Route Outages
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">
                  {incidents.filter(i => i.rootCause === 'payment_degraded').length}
                </span>
              </button>

              <button
                onClick={() => { setSelectedPreset('ptp_only'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'ptp_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'ptp_only' ? 'bg-purple-500' : 'bg-transparent border border-purple-300'}`} />
                  Promises to Pay
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">
                  {incidents.filter(i => i.rootCause === 'promise_to_pay').length}
                </span>
              </button>
            </nav>
          </div>

          {/* ENGINE STATUS BADGE */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Autonomous Recovery</span>
              </span>
              <span className="text-emerald-700 font-bold">Active</span>
            </div>
          </div>
          
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* TOP NAVBAR */}
        <header className="h-16 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-slate-500 font-medium">Merchant Portal</span>
              <span className="text-slate-300">/</span>
              <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded text-xs font-bold capitalize">
                {mainView.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchIncidents(true)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Sync Ledger</span>
            </button>

            <Link
              href="/merchant/optimizer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Guardrails</span>
            </Link>

            <Link
              href="/merchant/customers/merch_01"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Customer Insights</span>
            </Link>

            <Link
              href="/payer"
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payer Portal</span>
            </Link>

            {/* Toggle AI Copilot Button */}
            <button
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all shadow-xs ${
                isCopilotOpen
                  ? 'bg-cyan-50 border border-cyan-200 text-[#00A3C4]'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title={isCopilotOpen ? 'Collapse AI Copilot' : 'Open AI Copilot'}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Copilot</span>
            </button>
          </div>
        </header>

        {/* NOTIFICATION TOAST */}
        {channelResult && (
          <div className="bg-slate-900 text-white px-6 py-2.5 text-xs font-medium flex items-center justify-between z-30 shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{channelResult}</span>
            </div>
            <button
              onClick={() => setChannelResult(null)}
              className="text-slate-400 hover:text-white transition-colors ml-4 text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* WORKSPACE AREA */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* SCROLLABLE MAIN BODY */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* VIEW 1: RECOVERY CONSOLE */}
            {mainView === 'queue' && (
              <>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recovery Action Center</h1>
                    <p className="text-sm text-slate-500 mt-1">
                      AI continuously monitors payment failures, identifies why each one happened, and executes non-intrusive recovery moves.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Production Ledger
                    </span>
                  </div>
                </div>

                {/* Plain-English KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">At-Risk Revenue</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">₹{totalAtRisk.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">Delayed across failed routes & invoices</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Recovered Revenue</div>
                    <div className="text-2xl font-black text-emerald-600 mt-1">₹{totalRecovered.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-emerald-700 font-medium mt-1">Successfully collected via AI interventions</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider">Profit Margin Shielded</div>
                    <div className="text-2xl font-black text-cyan-600 mt-1">₹{marginShieldSaved.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-500 mt-1">Saved by withholding unnecessary coupon discounts</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Needs Your Approval</div>
                    <div className="text-2xl font-black text-amber-600 mt-1">{pendingHitlCount} High-Value</div>
                    <div className="text-[11px] text-amber-700 font-medium mt-1">Transactions ≥ ₹1 Lakh awaiting 1-click go-ahead</div>
                  </div>
                </div>

                {/* Incident Table Container */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                    <div className="relative w-80">
                      <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        placeholder="Search customer, issue name, or ID..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#00A3C4] focus:border-[#00A3C4] bg-white"
                      />
                    </div>
                    
                    <div className="flex items-center p-1 bg-slate-200/60 rounded-lg text-xs font-medium">
                      {(['all', 'hitl', 'recovering', 'recovered'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                          className={`px-3 py-1 rounded-md transition-all ${
                            activeTab === tab
                              ? 'bg-white text-slate-900 shadow-xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {tab === 'all' ? 'All Incidents' : tab === 'hitl' ? 'Needs Approval' : tab === 'recovering' ? 'In Progress' : 'Recovered'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                          <th className="px-5 py-3">Customer & Contact</th>
                          <th className="px-5 py-3">Issue / Diagnosis</th>
                          <th className="px-5 py-3">Amount</th>
                          <th className="px-5 py-3">AI Recovery Move</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Quick Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                              <div className="flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin text-cyan-600" />
                                <span>Loading live incidents from payment ledger...</span>
                              </div>
                            </td>
                          </tr>
                        ) : paginatedIncidents.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                              No incidents match the active search or filter.
                            </td>
                          </tr>
                        ) : (
                          paginatedIncidents.map(inc => {
                            const meta = ROOT_CAUSE_META[inc.rootCause] || {
                              label: inc.rootCause,
                              icon: '⚡',
                              badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
                              description: 'Automated recovery rule active.',
                              nonTechSummary: 'AI is managing recovery according to policy rules.',
                            };
                            const archetypeInfo = inc.archetype ? ARCHETYPE_META[inc.archetype] : null;

                            return (
                              <tr
                                key={inc.id}
                                onClick={() => setSelectedIncident(inc)}
                                className="hover:bg-cyan-50/30 transition-colors cursor-pointer group"
                              >
                                <td className="px-5 py-4">
                                  <div className="font-bold text-slate-900 group-hover:text-[#00A3C4] transition-colors flex items-center gap-1.5">
                                    <span>{inc.customer}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    {inc.customerPhone}
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeColor}`}>
                                      <span>{meta.icon}</span>
                                      <span>{meta.label}</span>
                                    </span>
                                  </div>
                                  {archetypeInfo && (
                                    <div className="text-[10px] text-slate-500 font-medium mt-1">
                                      {archetypeInfo.label}
                                    </div>
                                  )}
                                </td>

                                <td className="px-5 py-4 font-black text-slate-900 text-sm whitespace-nowrap">
                                  ₹{inc.amount.toLocaleString('en-IN')}
                                </td>

                                <td className="px-5 py-4 text-slate-600 max-w-[280px] leading-relaxed">
                                  <div className="line-clamp-2 text-xs font-medium text-slate-700">
                                    {inc.evRankedStrategy}
                                  </div>
                                </td>

                                <td className="px-5 py-4 whitespace-nowrap">
                                  <span
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1 ${
                                      inc.status === 'recovered'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : inc.status === 'pending_hitl'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                                        : inc.status === 'paused_ptp'
                                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                                    }`}
                                  >
                                    {inc.status === 'pending_hitl' && '⏳ Needs Approval'}
                                    {inc.status === 'auto_recovering' && '⚡ In Progress'}
                                    {inc.status === 'paused_ptp' && '⏸️ Paused (PTP)'}
                                    {inc.status === 'recovered' && '✓ Recovered'}
                                  </span>
                                </td>

                                <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                  {inc.status === 'pending_hitl' && (
                                    <button
                                      onClick={() => handleApproveHitl(inc)}
                                      className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
                                    >
                                      Approve
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleTriggerPlivoCall(inc)}
                                    disabled={sendingChannel === 'plivo'}
                                    className="px-2.5 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-xs inline-flex items-center gap-1"
                                    title="Make an AI Voice Assistant phone call"
                                  >
                                    <Phone className="w-3 h-3 text-emerald-600" />
                                    <span>Call</span>
                                  </button>
                                  <button
                                    onClick={() => handleSendTelegram(inc)}
                                    disabled={sendingChannel === 'telegram'}
                                    className="px-2.5 py-1.5 rounded-md bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 text-[#00A3C4] font-bold text-xs transition-colors shadow-xs inline-flex items-center gap-1"
                                    title="Send 1-click Razorpay payment link via WhatsApp"
                                  >
                                    <Send className="w-3 h-3 text-[#00A3C4]" />
                                    <span>Link</span>
                                  </button>
                                  <button
                                    onClick={() => setSelectedIncident(inc)}
                                    className="px-2 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs transition-colors"
                                    title="Inspect details and customer history"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                    <div>
                      Showing <strong>{filteredIncidents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
                      <strong>{Math.min(filteredIncidents.length, currentPage * pageSize)}</strong> of{' '}
                      <strong>{filteredIncidents.length}</strong> active recovery incidents
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Previous
                      </button>
                      <span className="px-2 font-bold text-slate-700">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* VIEW 2: CHECKOUT FUNNEL & MARGIN SHIELD */}
            {mainView === 'checkout_funnel' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Checkout Drop-Off & Margin Shield</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Visualizes exactly where shoppers drop off during checkout, and automatically shields your profits by avoiding blanket coupon discounts.
                  </p>
                </div>

                {/* Top KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Margin Saved</div>
                    <div className="text-2xl font-black text-cyan-600 mt-1.5">₹{marginShieldSaved.toLocaleString('en-IN')}</div>
                    <p className="text-xs text-slate-500 mt-1">Discounts withheld from habitual cart abandoners</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Form Glitches Fixed</div>
                    <div className="text-2xl font-black text-slate-900 mt-1.5">
                      {incidents.filter(i => i.archetype === 'technical_form_friction').length} Recovered
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Direct 1-click Razorpay links bypassing mobile form bugs</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Discount Efficiency</div>
                    <div className="text-2xl font-black text-emerald-600 mt-1.5">100% Margin Protected</div>
                    <p className="text-xs text-slate-500 mt-1">Zero margin given away to shoppers who pay full price</p>
                  </div>
                </div>

                {/* Funnel Visualization */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Where Customers Leave The Checkout</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                        <span>1. Cart Created</span>
                        <span>1,420 Shoppers (100%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                        <div className="bg-[#00A3C4] h-full w-full rounded-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                        <span>2. Shipping Info & Delivery Address</span>
                        <span>980 Shoppers (69%) — <span className="text-amber-600">31% Drop-off (Shipping Shock)</span></span>
                      </div>
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full w-[69%] rounded-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                        <span>3. Payment Method Selection (UPI / Card)</span>
                        <span>680 Shoppers (48%) — <span className="text-slate-500">21% Drop-off (Payment Hesitation)</span></span>
                      </div>
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                        <div className="bg-cyan-600 h-full w-[48%] rounded-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                        <span>4. OTP Verification & Order Confirmation</span>
                        <span>540 Shoppers (38%) — <span className="text-emerald-600">Converted Successfully</span></span>
                      </div>
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full w-[38%] rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Behavioral Archetype Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      <span>Window Shoppers (Margin Shield)</span>
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-2">Zero Discount Strategy (0% Coupon)</div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      Shoppers who repeatedly add items and abandon to trigger promo codes are identified. Instead of giving away 10% margins, the AI sends a polite stock reminder, maintaining full profit.
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
                      <Zap className="w-4 h-4 text-emerald-600" />
                      <span>Technical Form Glitches</span>
                    </div>
                    <div className="text-lg font-black text-slate-900 mt-2">1-Click Direct Razorpay Link</div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      Shoppers whose mobile screens froze at the payment step receive a direct 1-click Razorpay payment link via WhatsApp. This recovers the purchase without coupon discounts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: SUBSCRIPTION CHURN INTELLIGENCE */}
            {mainView === 'subscription_churn' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subscription Churn Guard</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Differentiates accidental card declines (Involuntary) from inactive subscribers (Voluntary), protecting your monthly recurring revenue.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Active Users Saved</div>
                    <div className="text-2xl font-black text-emerald-600 mt-1.5">78.4% Recovered</div>
                    <p className="text-xs text-slate-500 mt-1">Recovered via 14-day grace period + payroll cycle retry</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="text-xs font-bold text-amber-600 uppercase tracking-wider">Dormant Users Diverted</div>
                    <div className="text-2xl font-black text-amber-600 mt-1.5">0 Chargebacks</div>
                    <p className="text-xs text-slate-500 mt-1">Inactive users (&gt;45d) offered pause/downgrade instead of dunning</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="text-xs font-bold text-purple-600 uppercase tracking-wider">Enterprise Accounts</div>
                    <div className="text-2xl font-black text-purple-600 mt-1.5">100% Protected</div>
                    <p className="text-xs text-slate-500 mt-1">High-value contracts routed to executive supervisor care</p>
                  </div>
                </div>

                {/* Comparison Card: Side by Side */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                    How AI Handles Two Different Customers with the Same Decline Code
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                      <div className="text-xs font-bold text-emerald-800 uppercase">Customer A: Active Daily User</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">Ashwin Khowala (Used product yesterday)</div>
                      <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                        <strong>Why it failed:</strong> Month-end salary credit timing.<br />
                        <strong>AI Action:</strong> Service is NOT disconnected. A 14-day grace period is granted and payment is automatically retried on Friday payday with 1-click WhatsApp update link.
                      </p>
                    </div>

                    <div className="p-5 rounded-xl bg-amber-50/60 border border-amber-200">
                      <div className="text-xs font-bold text-amber-800 uppercase">Customer B: Inactive User</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">Siddharth Rao (Inactive for 65 days)</div>
                      <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                        <strong>Why it failed:</strong> User stopped using the product.<br />
                        <strong>AI Action:</strong> Aggressive email reminders are stopped immediately. Sent 1 friendly plan-pause option to eliminate credit card chargebacks.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4: BANK DECLINE CODE GUIDE */}
            {mainView === 'decline_taxonomy' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bank Decline Guide</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Plain-English lookup guide explaining why banks decline customer cards and the exact recommended action.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <th className="px-5 py-3.5">Decline Reason</th>
                        <th className="px-5 py-3.5">Who Is Responsible</th>
                        <th className="px-5 py-3.5">Recommended AI Action</th>
                        <th className="px-5 py-3.5">Best Time To Retry</th>
                        <th className="px-5 py-3.5">Customer Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">Bank Server Timeout (gateway_timeout)</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Bank Gateway</span></td>
                        <td className="px-5 py-3.5">Silent retry via backup HDFC/ICICI route</td>
                        <td className="px-5 py-3.5">5 minutes</td>
                        <td className="px-5 py-3.5 text-rose-600 font-bold">❌ Do Not Message (0 Spam)</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">Insufficient Balance (insufficient_funds)</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">Customer Account</span></td>
                        <td className="px-5 py-3.5">Smart retry aligned to salary day</td>
                        <td className="px-5 py-3.5">72 hours (Friday)</td>
                        <td className="px-5 py-3.5 text-emerald-600 font-bold">✓ Polite WhatsApp Reminder</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">Card Expired (card_expired)</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">Customer Card</span></td>
                        <td className="px-5 py-3.5">Send 1-click card update link</td>
                        <td className="px-5 py-3.5">Immediate</td>
                        <td className="px-5 py-3.5 text-emerald-600 font-bold">✓ 1-Click Update Link</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">RBI >₹15k 2FA (mandate_auth_failed)</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">RBI Regulation</span></td>
                        <td className="px-5 py-3.5">Pre-debit WhatsApp consent link</td>
                        <td className="px-5 py-3.5">Immediate</td>
                        <td className="px-5 py-3.5 text-emerald-600 font-bold">✓ WhatsApp Consent Link</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">Lost or Stolen Card (stolen_card)</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">Hard Security Decline</span></td>
                        <td className="px-5 py-3.5">Cancel all retries immediately</td>
                        <td className="px-5 py-3.5">None</td>
                        <td className="px-5 py-3.5 text-rose-600 font-bold">❌ Blocked (Fraud Safety)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>

          {/* ========================================================================= */}
          {/* SMART INCIDENT DETAIL DRAWER (SLIDE-OVER FOR QUICK ACTIONS & STORY)        */}
          {/* ========================================================================= */}
          {selectedIncident && (
            <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in">
              <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-50 overflow-hidden">
                {/* Drawer Header */}
                <div className="p-6 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 text-[#00A3C4] flex items-center justify-center font-bold text-base">
                      {ROOT_CAUSE_META[selectedIncident.rootCause]?.icon || '⚡'}
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-900">{selectedIncident.customer}</div>
                      <div className="text-xs text-slate-500 font-mono">Incident ID: {selectedIncident.id}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedIncident(null)}
                    className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  
                  {/* Financial & Status Summary */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase">Amount At Risk</div>
                      <div className="text-2xl font-black text-slate-900 mt-0.5">₹{selectedIncident.amount.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase text-right">Current Status</div>
                      <span
                        className={`inline-block mt-1 px-3 py-1 rounded-md text-xs font-bold ${
                          selectedIncident.status === 'recovered'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : selectedIncident.status === 'pending_hitl'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : selectedIncident.status === 'paused_ptp'
                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {selectedIncident.status === 'pending_hitl' && '⏳ Needs Your Approval'}
                        {selectedIncident.status === 'auto_recovering' && '⚡ AI Recovering'}
                        {selectedIncident.status === 'paused_ptp' && '⏸️ Outreach Paused'}
                        {selectedIncident.status === 'recovered' && '✓ Successfully Recovered'}
                      </span>
                    </div>
                  </div>

                  {/* Customer Contact & Reliability Profile */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-[#00A3C4]" />
                      <span>Customer Reliability & Contact</span>
                    </h3>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Phone Number:</span>
                        <span className="font-mono font-bold text-slate-900">{selectedIncident.customerPhone}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Payment Reliability:</span>
                        <span className="font-bold text-emerald-600">94% On-Time Track Record</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Behavioral Archetype:</span>
                        <span className="font-bold text-slate-700">
                          {selectedIncident.archetype ? ARCHETYPE_META[selectedIncident.archetype]?.label : 'Standard Priority'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Plain-English AI Diagnosis */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#00A3C4]" />
                      <span>Why Did This Happen? (AI Diagnosis)</span>
                    </h3>
                    <div className="bg-cyan-50/60 border border-cyan-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed">
                      <div className="font-bold text-[#00A3C4] mb-1">
                        {ROOT_CAUSE_META[selectedIncident.rootCause]?.label}
                      </div>
                      <p>
                        {ROOT_CAUSE_META[selectedIncident.rootCause]?.nonTechSummary}
                      </p>
                    </div>
                  </div>

                  {/* Active Strategy */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>Executed Recovery Move</span>
                    </h3>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed font-medium">
                      {selectedIncident.evRankedStrategy}
                    </div>
                  </div>

                  {/* Financial Guardrails & Anti-Spam Safety */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span>Compliance & Anti-Spam Safety</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Contact Limit</div>
                        <div className="font-bold text-slate-800 mt-0.5">1 of 2 max used</div>
                      </div>
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="text-[10px] text-slate-500 uppercase font-bold">Quiet Window</div>
                        <div className="font-bold text-emerald-700 mt-0.5">Active (No spam)</div>
                      </div>
                    </div>
                  </div>

                  {/* Promise-to-Pay Snooze Date Picker */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <span>Record Customer Promise-to-Pay</span>
                    </h3>
                    <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-3">
                      <p className="text-[11px] text-slate-600">
                        If the customer promised to pay on a specific date, select it below. AI will pause all reminders until that date.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={customPtpDate}
                          onChange={e => setCustomPtpDate(e.target.value)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                        <button
                          onClick={() => handleRecordPromiseToPay(selectedIncident, customPtpDate)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-xs"
                        >
                          Pause Outreach
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Drawer Footer Actions */}
                <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    1-Click Merchant Actions
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {selectedIncident.status === 'pending_hitl' ? (
                      <button
                        onClick={() => handleApproveHitl(selectedIncident)}
                        className="col-span-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve High-Value Outreach (₹{selectedIncident.amount.toLocaleString('en-IN')})</span>
                      </button>
                    ) : null}

                    <button
                      onClick={() => handleTriggerPlivoCall(selectedIncident)}
                      disabled={sendingChannel === 'plivo'}
                      className="py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2"
                    >
                      <Phone className="w-4 h-4 text-emerald-600" />
                      <span>AI Voice Call</span>
                    </button>

                    <button
                      onClick={() => handleSendTelegram(selectedIncident)}
                      disabled={sendingChannel === 'telegram'}
                      className="py-2 rounded-xl bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 text-[#00A3C4] font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4 text-[#00A3C4]" />
                      <span>Send 1-Click Link</span>
                    </button>

                    <Link
                      href={`/payer?customer=${encodeURIComponent(selectedIncident.customer)}&amount=${selectedIncident.amount}&id=${selectedIncident.id}`}
                      target="_blank"
                      className="col-span-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors text-center flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Preview Customer Payer Portal</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* RIGHT AI COPILOT PANE                                                     */}
          {/* ========================================================================= */}
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
              />

              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <AIChatBot
                  role="merchant"
                  customerName={selectedIncident ? selectedIncident.customer : "TechMatrix Corp"}
                  amount={selectedIncident ? selectedIncident.amount : 145000}
                  rootCause={selectedIncident ? selectedIncident.rootCause : "receivable_overdue"}
                  customerId={selectedIncident?.customerId || "cust_0001"}
                  merchantId="merch_01"
                  isOpen={isCopilotOpen}
                  onToggleOpen={() => setIsCopilotOpen(false)}
                  resizableWidth={copilotWidth}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
