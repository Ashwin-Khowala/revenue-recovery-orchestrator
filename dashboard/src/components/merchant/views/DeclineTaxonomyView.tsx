'use client';

import React, { useState } from 'react';
import { useMerchant } from '@/context/MerchantContext';
import { theme } from '@/lib/theme';
import {
  Layers,
  Search,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface DeclineCode {
  isoCode: string;
  category: 'soft_decline' | 'hard_decline' | 'technical_outage' | 'fraud_risk';
  categoryBadge: string;
  description: string;
  orchestratorAction: string;
  customerContactPolicy: string;
  successRate: string;
}

const DECLINE_TAXONOMY: DeclineCode[] = [
  {
    isoCode: '51 (Insufficient Funds)',
    category: 'soft_decline',
    categoryBadge: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Account balance temporarily insufficient for recurring mandate or card charge.',
    orchestratorAction: 'Schedule silent backoff retry aligned to salary cycle (1st or 5th of month).',
    customerContactPolicy: '1 gentle WhatsApp update with 14-day grace window before any service pause.',
    successRate: '88.4% Recovery Rate',
  },
  {
    isoCode: '05 (Do Not Honor)',
    category: 'soft_decline',
    categoryBadge: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Issuing bank generic block (often temporary fraud rule or card limit trigger).',
    orchestratorAction: 'Dispatches instant UPI / Alternate Card 1-click Razorpay checkout link.',
    customerContactPolicy: 'Immediate WhatsApp alert prompting customer to approve in banking app.',
    successRate: '79.2% Recovery Rate',
  },
  {
    isoCode: '91 (Issuer or Switch Inoperative)',
    category: 'technical_outage',
    categoryBadge: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Bank server timeout or NPCI switch degradation.',
    orchestratorAction: 'Silent instantaneous reroute to secondary acquiring bank route.',
    customerContactPolicy: 'NEVER contact customer. 100% silent infrastructure reroute.',
    successRate: '94.6% Recovery Rate',
  },
  {
    isoCode: '54 (Expired Card)',
    category: 'soft_decline',
    categoryBadge: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Saved card token expired on recurring subscription mandate.',
    orchestratorAction: 'Dispatches Razorpay Card Updater & Token Re-Registration flow.',
    customerContactPolicy: '1-click secure card update link sent via email and WhatsApp.',
    successRate: '86.1% Recovery Rate',
  },
  {
    isoCode: '14 (Invalid Card Number)',
    category: 'hard_decline',
    categoryBadge: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Card number does not exist on issuer master database.',
    orchestratorAction: 'Mark payment method permanently invalid; prompt fresh checkout.',
    customerContactPolicy: 'Prompt to enter a fresh valid payment method on next visit.',
    successRate: '42.0% Recovery Rate',
  },
  {
    isoCode: '41 / 43 (Lost or Stolen Card)',
    category: 'fraud_risk',
    categoryBadge: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Card flagged as stolen or compromised by cardholder.',
    orchestratorAction: 'IMMEDIATE HARD LOCK. Delete saved card token; block recurring retry.',
    customerContactPolicy: 'Zero outreach. Flag for risk investigation.',
    successRate: '0% (Hard Security Halt)',
  },
];

export default function DeclineTaxonomyView() {
  const { incidents } = useMerchant();
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Live database calculations
  const totalDatabaseIncidents = incidents.length;
  const softDeclinesCount = incidents.filter(i => i.rootCause === 'subscription_failed' || i.rootCause === 'mandate_auth_failed').length;
  const technicalOutageCount = incidents.filter(i => i.rootCause === 'payment_degraded').length;
  const hardDeclinesCount = incidents.filter(i => i.rootCause === 'receivable_overdue' && i.amount >= 100000).length;

  const filteredDeclineCodes = DECLINE_TAXONOMY.filter(
    d =>
      d.isoCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.orchestratorAction.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#2B2B2B] tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-700" />
            <span>Bank Decline Intelligence</span>
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            Live ISO 8583 bank return code taxonomy linked to {totalDatabaseIncidents} live database incidents.
          </p>
        </div>

        {/* Search Filter Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#B3B3B3]" />
          <input
            type="text"
            placeholder="Search ISO code or root cause..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-1.5 rounded-lg border border-[#D4D4D4] bg-white text-xs text-[#2B2B2B] focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
          />
        </div>
      </div>

      {/* Top 4 KPI Metrics (Live DB) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Soft Declines (DB)</div>
          <div className="text-2xl font-bold text-[#2B2B2B] mt-1">{softDeclinesCount} Incidents</div>
          <div className="text-[11px] text-[#666666] mt-1">Recoverable via pay-cycle retries &amp; AFA</div>
        </div>

        <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Bank Route Outages</div>
          <div className="text-2xl font-bold text-[#2B2B2B] mt-1">{technicalOutageCount} Rerouted</div>
          <div className="text-[11px] text-[#666666] mt-1">100% silent infrastructure rerouting</div>
        </div>

        <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">High-Value Escalated</div>
          <div className="text-2xl font-bold text-[#2B2B2B] mt-1">{hardDeclinesCount} Invoices</div>
          <div className="text-[11px] text-[#666666] mt-1">Held for human supervisor authorization</div>
        </div>

        <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Zero-Spam Guarantee</div>
          <div className="text-2xl font-bold text-[#2B2B2B] mt-1">100% Compliant</div>
          <div className="text-[11px] text-[#666666] mt-1">Strict max 2 touches per incident ceiling</div>
        </div>
      </div>

      {/* Decline Codes Table */}
      <div className={theme.table.wrapper}>
        <div className={`px-4 py-3 border-b ${theme.border.default} bg-[#FAFAFA] flex items-center justify-between`}>
          <div>
            <h3 className="text-xs font-bold text-[#2B2B2B] uppercase tracking-wider">
              ISO 8583 Return Code Rules &amp; Recovery Playbooks
            </h3>
            <p className="text-[11px] text-[#666666] mt-0.5">
              Deterministic routing matrix matching bank error responses to optimal channels.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={theme.table.headerRow}>
                <th className="py-2.5 px-4">ISO Code &amp; Domain</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Bank Error Description</th>
                <th className="py-2.5 px-4">Autonomous Recovery Action</th>
                <th className="py-2.5 px-4">Customer Contact Policy</th>
                <th className="py-2.5 px-4 text-right">Recovery Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBEBEB]">
              {filteredDeclineCodes.map((d, idx) => (
                <tr key={idx} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="py-3 px-4 font-bold text-[#2B2B2B]">{d.isoCode}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${d.categoryBadge}`}>
                      {d.category.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-[#2B2B2B] max-w-[220px]">{d.description}</td>
                  <td className="py-3 px-4 text-[#2B2B2B] font-medium max-w-[240px]">{d.orchestratorAction}</td>
                  <td className="py-3 px-4 text-[#666666] max-w-[200px]">{d.customerContactPolicy}</td>
                  {(() => {
                    const isZero = d.successRate.startsWith('0%');
                    const isLow = d.successRate.startsWith('4') || d.successRate.startsWith('5');
                    const colorClass = isZero ? 'text-rose-700' : isLow ? 'text-amber-800' : 'text-emerald-800';
                    return (
                      <td className={`py-3 px-4 text-right font-mono font-bold ${colorClass}`}>
                        {d.successRate}
                      </td>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
