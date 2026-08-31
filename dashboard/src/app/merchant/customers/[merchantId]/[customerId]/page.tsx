'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import {
  MessageSquare,
  Mail,
  Phone,
  Send,
  Smartphone,
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileText,
  ChevronLeft,
  ShieldCheck,
  Clock,
  ExternalLink,
} from 'lucide-react';

import { getApiBaseUrl } from '@/lib/api';

const API = getApiBaseUrl();

interface RiskIndicator {
  type: string;
  severity: 'high' | 'medium' | 'low';
  detail: string;
}

interface Episode {
  episode_type: string;
  channel: string;
  outcome: string;
  amount?: number;
  notes?: string;
  response_hours?: number;
  created_at: string;
}

interface CustomerDetail {
  profile: {
    customer_id: string;
    merchant_id: string;
    name: string;
    email: string;
    phone: string;
    whatsapp_number?: string;
    language: string;
    customer_type: string;
    city: string;
    payment_reliability: number;
    risk_score: number;
    preferred_channel: string;
    telegram_chat_id?: string;
    total_failures: number;
    total_recoveries: number;
    total_revenue_at_risk: number;
    total_revenue_recovered: number;
    ltv_inr?: number;
    typical_payment_delay_days?: number;
    historical_promise_accuracy?: number;
  };
  channel_effectiveness: Record<string, number>;
  episodic_history: Episode[];
  active_events: any[];
  ai_overview: string;
  risk_indicators: RiskIndicator[];
}

const SEVERITY_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  high: { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  low: { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
};

function renderChannelIcon(channel: string) {
  switch (channel) {
    case 'whatsapp':
      return <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />;
    case 'email':
      return <Mail className="w-3.5 h-3.5 text-blue-600" />;
    case 'voice':
      return <Phone className="w-3.5 h-3.5 text-purple-600" />;
    case 'telegram':
      return <Send className="w-3.5 h-3.5 text-sky-600" />;
    case 'sms':
      return <Smartphone className="w-3.5 h-3.5 text-amber-600" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-slate-500" />;
  }
}

function StatCard({ label, value, sub, colorClass }: { label: string; value: string | number; sub?: string; colorClass?: string }) {
  return (
    <div className="bg-white border border-[#D4D4D4] rounded-xl p-3.5 shadow-xs">
      <div className="text-[11px] font-bold text-[#666666] uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold mt-1 ${colorClass || 'text-[#2B2B2B]'}`}>{value}</div>
      {sub && <div className="text-[10px] text-[#888888] mt-0.5">{sub}</div>}
    </div>
  );
}

function ChannelBar({ channel, rate }: { channel: string; rate: number }) {
  const pct = Math.round(rate * 100);
  const colorClass = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-rose-500';
  const textClass = pct >= 70 ? 'text-emerald-800' : pct >= 40 ? 'text-amber-800' : 'text-rose-800';

  return (
    <div className="flex items-center gap-2.5 py-1.5 border-b border-slate-100 last:border-0 text-xs">
      <div className="w-24 flex items-center gap-1.5 font-medium text-[#2B2B2B] capitalize">
        {renderChannelIcon(channel)}
        <span>{channel}</span>
      </div>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-10 text-right font-mono font-bold ${textClass}`}>{pct}%</span>
    </div>
  );
}

export default function CustomerDetailPage({ params }: { params: { customerId: string } }) {
  const { customerId } = params;
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/api/customers/${customerId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(`Failed to load customer: ${e}`);
        setLoading(false);
      });
  }, [customerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center text-xs font-semibold text-[#666666]">
        Loading customer behavioral profile...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center text-xs font-bold text-rose-700">
        {error || 'Customer profile not found'}
      </div>
    );
  }

  const { profile, channel_effectiveness, episodic_history, active_events, ai_overview, risk_indicators } = data;
  const reliability = profile.payment_reliability || 0;
  const reliabilityPct = Math.round(reliability * 100);
  const reliabilityColor = reliabilityPct >= 80 ? 'text-emerald-800' : reliabilityPct >= 60 ? 'text-amber-800' : 'text-rose-800';

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#2B2B2B] font-sans antialiased">
      {/* Top Header */}
      <header className="bg-white border-b border-[#D4D4D4] px-6 py-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/merchant/customers/${profile.merchant_id || 'merch_01'}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#666666] hover:text-[#2B2B2B] px-2.5 py-1.5 rounded-lg border border-[#D4D4D4] hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>All Customers</span>
            </Link>
            <span className="text-[#D4D4D4]">|</span>
            <div>
              <h1 className="text-base font-bold text-[#2B2B2B] leading-tight flex items-center gap-2">
                <span>{profile.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase font-mono">
                  {customerId}
                </span>
              </h1>
              <p className="text-[11px] text-[#666666] capitalize">
                {profile.language} · {profile.city || 'India'} · {profile.customer_type || 'Standard Subscriber'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {profile.telegram_chat_id ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200">
                <Send className="w-3 h-3 text-sky-600" />
                <span>Telegram Connected</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                Telegram Unlinked
              </span>
            )}
            <Link
              href={`/payer?customer=${encodeURIComponent(profile.name)}&amount=4999`}
              target="_blank"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#2B2B2B] hover:bg-black text-white text-xs font-semibold transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Simulate Payer Portal</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Behavioral Overview */}
          <div className="bg-white border border-[#D4D4D4] rounded-2xl p-5 shadow-xs space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-700 uppercase tracking-wider">
              <Bot className="w-4 h-4 text-blue-600" />
              <span>AI Behavioral Diagnosis &amp; Payment Prior</span>
            </div>
            <div className="text-xs text-slate-700 leading-relaxed bg-[#FAFAFA] p-3.5 rounded-xl border border-slate-200">
              <MarkdownRenderer content={ai_overview} isDark={false} />
            </div>
          </div>

          {/* Primary Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <StatCard label="On-Time Reliability" value={`${reliabilityPct}%`} colorClass={reliabilityColor} />
            <StatCard
              label="Risk Index"
              value={Math.round((profile.risk_score || 0) * 100)}
              sub="Scale 0-100"
              colorClass={profile.risk_score > 0.6 ? 'text-rose-700' : 'text-amber-700'}
            />
            <StatCard
              label="Total Failures"
              value={profile.total_failures || 0}
              colorClass={profile.total_failures > 3 ? 'text-rose-700 font-bold' : 'text-[#2B2B2B]'}
            />
            <StatCard label="Total Recoveries" value={profile.total_recoveries || 0} colorClass="text-emerald-800 font-bold" />
          </div>

          {/* Secondary Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <StatCard label="Customer Lifetime Value" value={`₹${Math.round(profile.ltv_inr || 0).toLocaleString('en-IN')}`} />
            <StatCard label="Typical Payment Delay" value={`${(profile.typical_payment_delay_days || 0).toFixed(1)} Days`} />
            <StatCard
              label="Promise-to-Pay Accuracy"
              value={`${Math.round((profile.historical_promise_accuracy || 0) * 100)}%`}
              colorClass={(profile.historical_promise_accuracy || 0) < 0.65 ? 'text-rose-700' : 'text-emerald-800'}
            />
          </div>

          {/* Risk Indicators */}
          {risk_indicators.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-[#2B2B2B] uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Behavioral Risk Signals</span>
              </h3>
              <div className="space-y-2">
                {risk_indicators.map((r, i) => {
                  const s = SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.low;
                  return (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs shadow-xs ${s.bg} ${s.border}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-current" />
                        <span className="font-semibold text-slate-800">{r.detail || r.type}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${s.text}`}>
                        {r.severity}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Recovery Events */}
          {active_events.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-[#2B2B2B] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Active Recovery Incidents</span>
              </h3>
              <div className="space-y-2">
                {active_events.map(ev => (
                  <div
                    key={ev.event_id}
                    className="bg-white border border-[#D4D4D4] rounded-xl p-3.5 flex items-center justify-between text-xs shadow-xs"
                  >
                    <div>
                      <div className="font-bold text-[#2B2B2B] capitalize">{ev.event_type?.replace(/_/g, ' ')}</div>
                      <div className="text-[11px] text-[#666666] font-mono mt-0.5">
                        {ev.root_cause || 'unassigned'} · {ev.event_id}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[#2B2B2B]">₹{(ev.amount || 0).toLocaleString('en-IN')}</div>
                      <div
                        className={`text-[10px] font-bold uppercase mt-0.5 ${
                          ev.payment_status === 'recovered'
                            ? 'text-emerald-800'
                            : ev.payment_status === 'escalated'
                            ? 'text-blue-800'
                            : 'text-amber-800'
                        }`}
                      >
                        {ev.payment_status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Episodic History */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-[#2B2B2B] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Episodic Payment History ({episodic_history.length} events)</span>
            </h3>
            <div className="bg-white border border-[#D4D4D4] rounded-xl shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F6F6F6] text-[#666666] border-b border-[#EBEBEB] text-[11px] uppercase">
                    <th className="py-2.5 px-3.5">Date</th>
                    <th className="py-2.5 px-3.5">Type</th>
                    <th className="py-2.5 px-3.5">Channel</th>
                    <th className="py-2.5 px-3.5">Outcome</th>
                    <th className="py-2.5 px-3.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBEBEB]">
                  {episodic_history.slice(0, 8).map((ep, i) => (
                    <tr key={i} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="py-2.5 px-3.5 text-[#666666] font-mono text-[11px]">
                        {ep.created_at ? new Date(ep.created_at).toLocaleDateString() : 'Recent'}
                      </td>
                      <td className="py-2.5 px-3.5 font-medium text-[#2B2B2B] capitalize">
                        {ep.episode_type?.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 px-3.5 capitalize text-[#666666]">{ep.channel || 'System'}</td>
                      <td className="py-2.5 px-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ep.outcome === 'recovered' || ep.outcome === 'paid'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {ep.outcome}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-[#2B2B2B]">
                        {ep.amount ? `₹${ep.amount.toLocaleString('en-IN')}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Contact & Channel Effectiveness */}
        <div className="space-y-6">
          {/* Contact Card */}
          <div className="bg-white border border-[#D4D4D4] rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-[#2B2B2B] uppercase tracking-wider">Contact Coordinates</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-[#666666]">Phone:</span>
                <span className="font-mono font-bold text-[#2B2B2B]">{profile.phone}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-[#666666]">Email:</span>
                <span className="font-mono text-[#2B2B2B] truncate max-w-[180px]">{profile.email}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-[#666666]">Preferred Channel:</span>
                <span className="font-bold text-emerald-800 capitalize">{profile.preferred_channel}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-[#666666]">Language:</span>
                <span className="font-medium text-[#2B2B2B] capitalize">{profile.language}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#666666]">Merchant ID:</span>
                <span className="font-mono text-slate-500">{profile.merchant_id || 'merch_01'}</span>
              </div>
            </div>
          </div>

          {/* Channel Response Rates */}
          <div className="bg-white border border-[#D4D4D4] rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-[#2B2B2B] uppercase tracking-wider">Channel Conversion Rates</h3>
            <div className="space-y-1">
              {Object.entries(channel_effectiveness || {}).map(([ch, rate]) => (
                <ChannelBar key={ch} channel={ch} rate={rate} />
              ))}
            </div>
          </div>

          {/* Legal Compliance Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[11px] text-slate-600 space-y-2 shadow-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>DPDP 2023 &amp; RBI Compliance Notice</span>
            </div>
            <p className="leading-relaxed">
              This telemetry is strictly scoped under Section 4(1) of the Digital Personal Data Protection Act 2023 for contractual payment reconciliation. No unmasked PAN/CVV data is retained.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
