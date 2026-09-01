'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMerchant } from '@/context/MerchantContext';
import { ROOT_CAUSE_META } from '@/types/merchant';
import { theme } from '@/lib/theme';
import {
  Zap,
  TrendingUp,
  ShieldCheck,
  Clock,
  CheckCircle2,
  RefreshCw,
  Calendar,
  Send,
  Check,
  Eye,
} from 'lucide-react';

export default function RecoveryQueueView() {
  const {
    incidents,
    stats,
    statusFilter,
    setStatusFilter,
    searchQuery,
    channelFilter,
    setChannelFilter,
    minAmountFilter,
    setMinAmountFilter,
    setSelectedIncident,
    setPlanModalIncident,
    setMainView,
    handleApproveHitl,
    handleSendWhatsApp,
    sendingChannel,
  } = useMerchant();

  const [selectedIncidentIds, setSelectedIncidentIds] = useState<string[]>([]);

  // Filtered dataset
  const filteredIncidents = incidents.filter(inc => {
    if (statusFilter !== 'all' && inc.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = inc.customer.toLowerCase().includes(q);
      const matchId = inc.id.toLowerCase().includes(q);
      const matchPhone = inc.customerPhone?.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchPhone) return false;
    }
    if (minAmountFilter > 0 && inc.amount < minAmountFilter) return false;
    return true;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIncidentIds(filteredIncidents.map(i => i.id));
    } else {
      setSelectedIncidentIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIncidentIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* 4 Crisp KPI Cards with Light Domain Tints (No deep grey coverings) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: At Risk */}
        <button
          onClick={() => setStatusFilter('all')}
          className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group shadow-xs ${
            statusFilter === 'all'
              ? 'bg-blue-50/60 border-blue-300 ring-2 ring-blue-500/30'
              : 'bg-white border-[#D4D4D4] hover:border-blue-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#666666]">
              At-Risk Revenue
            </span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Zap className="w-4 h-4 text-blue-600" />
            </span>
          </div>
          <div className="text-2xl font-bold mt-2 tracking-tight text-[#2B2B2B]">
            ₹{stats.totalAtRisk.toLocaleString('en-IN')}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[#666666]">
              {incidents.filter(i => i.status !== 'recovered').length} active incidents
            </span>
            <span className="text-[10px] font-bold underline text-blue-700">
              All &rarr;
            </span>
          </div>
        </button>

        {/* Card 2: Recovered */}
        <button
          onClick={() => setStatusFilter('recovered')}
          className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group shadow-xs ${
            statusFilter === 'recovered'
              ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/30'
              : 'bg-white border-[#D4D4D4] hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Recovered Revenue
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </span>
          </div>
          <div className="text-2xl font-bold mt-2 tracking-tight text-[#2B2B2B]">
            ₹{stats.totalRecovered.toLocaleString('en-IN')}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-medium">
              {stats.recoveryRate}% overall rate
            </span>
            <span className="text-[10px] font-bold underline text-emerald-700">
              Filter &rarr;
            </span>
          </div>
        </button>

        {/* Card 3: Margin Shield */}
        <button
          onClick={() => setMainView('checkout_funnel')}
          className="p-4 rounded-xl border text-left transition-all relative overflow-hidden group shadow-xs bg-white border-[#D4D4D4] hover:border-teal-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
              Margin Preserved
            </span>
            <span className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
            </span>
          </div>
          <div className="text-2xl font-bold mt-2 tracking-tight text-[#2B2B2B]">
            ₹{stats.marginShielded.toLocaleString('en-IN')}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[#666666]">Anti-coupon gaming</span>
            <span className="text-[10px] font-bold underline text-teal-700">Funnel &rarr;</span>
          </div>
        </button>

        {/* Card 4: Needs Approval */}
        <button
          onClick={() => setStatusFilter('pending_hitl')}
          className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden group shadow-xs ${
            statusFilter === 'pending_hitl'
              ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/30'
              : 'bg-white border-[#D4D4D4] hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Supervisor Approval
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4 text-amber-600" />
            </span>
          </div>
          <div className="text-2xl font-bold mt-2 tracking-tight text-[#2B2B2B]">
            {stats.pendingHitlCount} Pending
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-amber-700 font-medium">
              &ge; ₹1,00,000 held
            </span>
            <span className="text-[10px] font-bold underline text-amber-700">
              Review &rarr;
            </span>
          </div>
        </button>
      </div>

      {/* Filter Bar */}
      <div className={`${theme.card.base} p-3.5 space-y-2.5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
            {[
              { id: 'all', label: 'All Incidents', count: incidents.length },
              {
                id: 'auto_recovering',
                label: 'AI Recovering',
                count: incidents.filter(i => i.status === 'auto_recovering').length,
              },
              {
                id: 'pending_hitl',
                label: 'Needs Approval',
                count: incidents.filter(i => i.status === 'pending_hitl').length,
                highlight: true,
              },
              {
                id: 'paused_ptp',
                label: 'Paused (PTP)',
                count: incidents.filter(i => i.status === 'paused_ptp').length,
              },
              {
                id: 'recovered',
                label: 'Recovered',
                count: incidents.filter(i => i.status === 'recovered').length,
              },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold ${
                  statusFilter === tab.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-300 shadow-xs font-bold'
                    : tab.highlight && tab.count > 0
                    ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100'
                    : 'bg-[#FAFAFA] text-[#666666] hover:bg-[#F5F5F5] hover:text-[#2B2B2B] border border-[#D4D4D4]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    statusFilter === tab.id ? 'bg-blue-200 text-blue-900' : 'bg-white text-[#2B2B2B] border border-[#D4D4D4]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Secondary Dropdown Filters */}
          <div className="flex items-center gap-2 text-xs">
            <select
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[#D4D4D4] bg-white font-medium text-[#2B2B2B] focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Channels</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="voice">AI Voice</option>
              <option value="telegram">Telegram</option>
              <option value="reroute">Silent Reroute</option>
            </select>

            <select
              value={minAmountFilter}
              onChange={e => setMinAmountFilter(Number(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-[#D4D4D4] bg-white font-medium text-[#2B2B2B] focus:outline-none focus:border-blue-500"
            >
              <option value="0">All Amounts</option>
              <option value="10000">&gt; ₹10,000</option>
              <option value="50000">&gt; ₹50,000</option>
              <option value="100000">&ge; ₹1,00,000 (Supervisor Gated)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incident Ledger Table */}
      <div className={theme.table.wrapper}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={theme.table.headerRow}>
                <th className="py-2.5 px-4 w-8">
                  <input
                    type="checkbox"
                    checked={
                      selectedIncidentIds.length === filteredIncidents.length && filteredIncidents.length > 0
                    }
                    onChange={e => handleSelectAll(e.target.checked)}
                    className="rounded border-[#D4D4D4] text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-2.5 px-4">Customer &amp; Incident</th>
                <th className="py-2.5 px-4">Root Cause</th>
                <th className="py-2.5 px-4">Amount</th>
                <th className="py-2.5 px-4">Executed Recovery Move</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Limits</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBEBEB]">
              {filteredIncidents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#666666]">
                    No recovery incidents match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredIncidents.map(inc => (
                  <tr key={inc.id} className="hover:bg-[#FAFAFA] transition-colors group">
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={selectedIncidentIds.includes(inc.id)}
                        onChange={() => handleToggleSelect(inc.id)}
                        className="rounded border-[#D4D4D4] text-blue-600 focus:ring-blue-500"
                      />
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-[#2B2B2B]">{inc.customer}</div>
                      <div className="text-[11px] font-mono text-[#666666]">{inc.id}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${ROOT_CAUSE_META[inc.rootCause]?.badgeColor || theme.badge.neutral}`}>
                        {ROOT_CAUSE_META[inc.rootCause]?.label || inc.rootCause}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono font-bold text-[#2B2B2B]">
                      ₹{inc.amount.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-[#2B2B2B] font-medium max-w-xs truncate" title={inc.evRankedStrategy}>
                        {inc.evRankedStrategy}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      {inc.status === 'pending_hitl' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Approval Needed</span>
                        </span>
                      )}
                      {inc.status === 'auto_recovering' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                          <span>AI Recovering</span>
                        </span>
                      )}
                      {inc.status === 'paused_ptp' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Calendar className="w-3 h-3 text-emerald-600" />
                          <span>PTP Paused</span>
                        </span>
                      )}
                      {inc.status === 'recovered' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Recovered</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-[11px] text-[#666666] font-mono">
                      {inc.currentAttempts}/{inc.maxAttempts}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inc.status === 'pending_hitl' ? (
                          <button
                            onClick={() => setPlanModalIncident(inc)}
                            className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center gap-1.5"
                            title="Review Agent Plan of Action"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Review Plan</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendWhatsApp(inc)}
                            disabled={sendingChannel === 'whatsapp'}
                            className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold text-xs transition-colors flex items-center gap-1"
                            title="Send WhatsApp Link"
                          >
                            <Send className="w-3 h-3 text-emerald-600" />
                            <span className="hidden sm:inline">WhatsApp</span>
                          </button>
                        )}

                        <button
                          onClick={() => setPlanModalIncident(inc)}
                          className="p-1 rounded-md text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
                          title="View Agent Plan of Action"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
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
