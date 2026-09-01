'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  Search,
  Filter,
  Download,
  Clock,
  Ban,
  CheckCircle2,
  HelpCircle,
  TrendingDown,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface ExceptionItem {
  event_id: string;
  amount: number;
  root_cause: string;
  action_taken: string;
  channel: string;
  guardrail_result: string;
  reason: string;
}

interface ExceptionsData {
  generated_at: string;
  total_non_recovered_count: number;
  exceptions: ExceptionItem[];
}

export default function ExceptionsView() {
  const [data, setData] = useState<ExceptionsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchExceptions = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/evals/exceptions');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        // Fallback default structure
        setData({
          generated_at: new Date().toISOString(),
          total_non_recovered_count: 0,
          exceptions: [],
        });
      }
    } catch (err) {
      console.warn('Could not fetch exceptions directly from FastAPI, using offline fallback', err);
      setData({
        generated_at: new Date().toISOString(),
        total_non_recovered_count: 0,
        exceptions: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, []);

  const exceptionsList = data?.exceptions || [];

  const hitlCount = exceptionsList.filter(e => e.guardrail_result === 'ESCALATE').length;
  const blockCount = exceptionsList.filter(e => e.guardrail_result === 'BLOCK').length;
  const doNothingCount = exceptionsList.filter(e => e.action_taken === 'do_nothing' || (e.reason && e.reason.includes('DO_NOTHING'))).length;
  const totalAmount = exceptionsList.reduce((acc, e) => acc + (e.amount || 0), 0);

  const filtered = exceptionsList.filter(e => {
    const matchesSearch =
      e.event_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.root_cause || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.reason || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (categoryFilter === 'hitl') return e.guardrail_result === 'ESCALATE';
    if (categoryFilter === 'blocked') return e.guardrail_result === 'BLOCK';
    if (categoryFilter === 'do_nothing') return e.action_taken === 'do_nothing' || (e.reason && e.reason.includes('DO_NOTHING'));
    return true;
  });

  const handleExportCSV = () => {
    if (!exceptionsList.length) return;
    const headers = ['Event ID', 'Amount (INR)', 'Root Cause', 'Action Taken', 'Channel', 'Guardrail Result', 'Stopping Rule / Reason'];
    const rows = exceptionsList.map(e => [
      e.event_id,
      e.amount,
      `"${e.root_cause}"`,
      `"${e.action_taken}"`,
      `"${e.channel}"`,
      `"${e.guardrail_result}"`,
      `"${(e.reason || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `razorpay_exceptions_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <AlertOctagon className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Track 3 & 4 Exceptions Ledger</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Full deterministic audit trail of every incident refused, paused for HITL sign-off, or throttled by stopping rules.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchExceptions}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reload</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="text-xs font-medium text-slate-500">Total Unrecovered Cases</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{data?.total_non_recovered_count ?? exceptionsList.length}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>₹{totalAmount.toLocaleString('en-IN')} uncollected GMV</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200 bg-amber-50/20 shadow-xs">
          <div className="text-xs font-medium text-amber-700 flex items-center justify-between">
            <span>HITL Paused (&ge; ₹1,00,000)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-1">{hitlCount}</div>
          <div className="text-[11px] text-amber-700 mt-1">
            Safe human gate; not auto-spammed
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-blue-200 bg-blue-50/20 shadow-xs">
          <div className="text-xs font-medium text-blue-700 flex items-center justify-between">
            <span>Do Nothing / Natural Prior</span>
            <TrendingDown className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-1">{doNothingCount}</div>
          <div className="text-[11px] text-blue-700 mt-1">
            Zero friction penalty scored
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-rose-200 bg-rose-50/20 shadow-xs">
          <div className="text-xs font-medium text-rose-700 flex items-center justify-between">
            <span>Guardrail Compliance Blocked</span>
            <Ban className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-900 mt-1">{blockCount}</div>
          <div className="text-[11px] text-rose-700 mt-1">
            Opt-out / 24h quiet throttled
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: 'All Exceptions', count: exceptionsList.length },
            { id: 'hitl', label: 'HITL Paused', count: hitlCount },
            { id: 'do_nothing', label: 'Do Nothing Unresolved', count: doNothingCount },
            { id: 'blocked', label: 'Compliance Blocked', count: blockCount },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                categoryFilter === tab.id
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                categoryFilter === tab.id ? 'bg-blue-200 text-blue-900' : 'bg-slate-100 text-slate-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ID, cause, reason..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Exceptions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">At-Risk (₹)</th>
                <th className="py-3 px-4">Root Cause Taxonomy</th>
                <th className="py-3 px-4">Action / Channel</th>
                <th className="py-3 px-4">Guardrail Gate</th>
                <th className="py-3 px-4">Underlying Deterministic Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading Track 3 & 4 Exceptions Ledger...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No exceptions found matching current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      {item.event_id}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {item.root_cause || 'unclassified'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="capitalize">{item.channel || 'none'}</span>
                        <span className="text-slate-400 text-[10px]">({item.action_taken})</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {item.guardrail_result === 'ESCALATE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>ESCALATE (HITL)</span>
                        </span>
                      ) : item.guardrail_result === 'BLOCK' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
                          <Ban className="w-3 h-3 text-rose-600" />
                          <span>BLOCK</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          <span>{item.guardrail_result || 'ALLOW'}</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-md font-mono text-[11px]">
                      {item.reason || 'Decision model completed within standard parameters.'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
