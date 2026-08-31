'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Mail,
  Phone,
  Send,
  Smartphone,
  CheckCircle2,
  FileText,
  Users,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

import { getApiBaseUrl } from '@/lib/api';
import { theme } from '@/lib/theme';

const API = getApiBaseUrl();

interface CustomerRow {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  preferred_channel: string;
  language: string;
  payment_reliability: number;
  risk_score: number;
  total_failures: number;
  total_recoveries: number;
  ltv_inr: number;
  telegram_chat_id: string | null;
  whatsapp_response_rate: number;
  updated_at: string;
}

const getReliabilityBadge = (score: number) => {
  const pct = Math.round(score * 100);
  if (pct >= 80) {
    return {
      text: `${pct}%`,
      style: 'text-emerald-800 bg-emerald-50 border-emerald-200',
      barColor: 'bg-emerald-500',
    };
  }
  if (pct >= 60) {
    return {
      text: `${pct}%`,
      style: 'text-amber-800 bg-amber-50 border-amber-300',
      barColor: 'bg-amber-500',
    };
  }
  return {
    text: `${pct}%`,
    style: 'text-rose-800 bg-rose-50 border-rose-200',
    barColor: 'bg-rose-500',
  };
};

const getRiskBadge = (score: number) => {
  const pct = Math.round(score * 100);
  if (pct <= 30) {
    return { text: `${pct}`, style: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
  }
  if (pct <= 60) {
    return { text: `${pct}`, style: 'text-amber-800 bg-amber-50 border-amber-300' };
  }
  return { text: `${pct}`, style: 'text-rose-800 bg-rose-50 border-rose-200' };
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

export default function CustomersPage({ params }: { params: { merchantId: string } }) {
  const merchantId = params?.merchantId || 'merch_01';
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('risk_score');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/merchants/${merchantId}/customers?page=${page}&sort_by=${sortBy}&page_size=50`)
        .then(r => r.json())
        .catch(() => ({ customers: [], total: 0 })),
      fetch(`${API}/api/merchants/${merchantId}/at-risk-summary`)
        .then(r => r.json())
        .catch(() => null),
    ]).then(([data, sum]) => {
      setCustomers(data.customers || []);
      setTotal(data.total || 0);
      setSummary(sum);
      setLoading(false);
    });
  }, [merchantId, page, sortBy]);

  const filtered = customers.filter(
    c =>
      !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#2B2B2B] font-sans antialiased">
      {/* Top Header */}
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
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-bold text-[#2B2B2B] leading-tight">Customer Intelligence CRM</h1>
                <p className="text-[11px] text-[#666666]">4-Tier Behavioral Memory &amp; Historical Track Records</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-[#D4D4D4]">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>DPDP 2023 Compliant</span>
            </span>
            <span className="text-xs text-[#666666] font-medium font-mono">{total.toLocaleString()} profiles</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPI Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-[#666666] uppercase tracking-wider">Total At-Risk Volume</div>
              <div className="text-xl font-bold text-rose-700 mt-1">
                ₹{(summary.at_risk_amount_inr || 0).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-[#666666] mt-0.5">{summary.at_risk_count || 0} active at-risk accounts</div>
            </div>

            <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Recovery Success Rate</div>
              <div className="text-xl font-bold text-emerald-800 mt-1">
                {(summary.recovery_rate_pct || 0).toFixed(1)}%
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>Across automated channels</span>
              </div>
            </div>

            <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Duplicate Contact Breaches</div>
              <div className="text-xl font-bold text-blue-800 mt-1">
                {summary.duplicate_contacts ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Strict 0-spam invariant</div>
            </div>

            <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-[#666666] uppercase tracking-wider">Memory Prior Depth</div>
              <div className="text-xl font-bold text-[#2B2B2B] mt-1">54,000</div>
              <div className="text-[11px] text-[#666666] mt-0.5">Episodic payment prior records</div>
            </div>
          </div>
        )}

        {/* Controls & Search */}
        <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="w-4 h-4 text-[#666666] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search customer by name, email, or ID..."
              className="w-full pl-9 pr-4 py-1.5 bg-[#FAFAFA] border border-[#D4D4D4] rounded-lg text-xs font-medium text-[#2B2B2B] placeholder-[#888888] focus:outline-none focus:bg-white focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 text-xs text-[#666666]">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </div>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-3 py-1.5 bg-[#FAFAFA] border border-[#D4D4D4] rounded-lg text-xs font-medium text-[#2B2B2B] focus:outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="risk_score">Risk Score (High to Low)</option>
              <option value="payment_reliability">Payment Reliability</option>
              <option value="total_failures">Failure Count</option>
              <option value="ltv_inr">Customer LTV</option>
            </select>

            <div className="flex items-center gap-1 pl-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-[#D4D4D4] bg-[#FAFAFA] hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-[#2B2B2B]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-[#666666] px-2 font-mono">Page {page}</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={customers.length < 50}
                className="p-1.5 rounded-lg border border-[#D4D4D4] bg-[#FAFAFA] hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-[#2B2B2B]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Customer Table */}
        <div className="bg-white border border-[#D4D4D4] rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={theme.table.headerRow}>
                  <th className="py-3 px-4">Customer Name &amp; ID</th>
                  <th className="py-3 px-4">Preferred Channel</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Historical Reliability</th>
                  <th className="py-3 px-4">Risk Index</th>
                  <th className="py-3 px-4 text-center">Failures</th>
                  <th className="py-3 px-4 text-center">Recoveries</th>
                  <th className="py-3 px-4">LTV (INR)</th>
                  <th className="py-3 px-4">Telegram Bot</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBEBEB]">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-[#666666]">
                      Loading customer profile telemetry...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-[#666666]">
                      No matching customer accounts found.
                    </td>
                  </tr>
                ) : (
                  filtered.map(c => {
                    const rel = getReliabilityBadge(c.payment_reliability || 0);
                    const risk = getRiskBadge(c.risk_score || 0);

                    return (
                      <tr key={c.customer_id} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[#2B2B2B]">{c.name}</div>
                          <div className="text-[11px] text-[#666666] font-mono">{c.customer_id} · {c.phone}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-50 border border-[#D4D4D4] text-[#2B2B2B] capitalize">
                            {renderChannelIcon(c.preferred_channel)}
                            <span>{c.preferred_channel}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[#666666] font-medium capitalize">{c.language}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                              <div
                                className={`h-full ${rel.barColor}`}
                                style={{ width: `${Math.min(100, Math.round((c.payment_reliability || 0) * 100))}%` }}
                              />
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${rel.style}`}>
                              {rel.text}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${risk.style}`}>
                            {risk.text}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`font-semibold ${
                              c.total_failures > 3 ? 'text-rose-700 font-bold' : 'text-[#666666]'
                            }`}
                          >
                            {c.total_failures}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-800">
                          {c.total_recoveries}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium text-[#2B2B2B]">
                          ₹{Math.round(c.ltv_inr || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4">
                          {c.telegram_chat_id ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                              <CheckCircle2 className="w-3 h-3 text-sky-600" />
                              <span>Linked</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/merchant/customers/${merchantId}/${c.customer_id}`}
                            className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-[#2B2B2B] hover:bg-black text-white text-xs font-semibold transition-colors shadow-xs"
                          >
                            View Profile
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
