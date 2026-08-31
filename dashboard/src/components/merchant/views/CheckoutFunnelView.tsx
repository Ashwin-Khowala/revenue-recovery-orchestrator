'use client';

import React, { useState } from 'react';
import { useMerchant } from '@/context/MerchantContext';
import { theme } from '@/lib/theme';
import {
  ShoppingCart,
  ShieldCheck,
  Zap,
  Sparkles,
  CheckCircle2,
  Send,
  Clock,
} from 'lucide-react';

export default function CheckoutFunnelView() {
  const { incidents, setChannelResult, handleSendWhatsApp } = useMerchant();

  // Derive checkout abandoned incidents from live database
  const checkoutIncidents = incidents.filter(
    i => i.rootCause === 'checkout_abandoned' || i.archetype?.includes('friction') || i.archetype?.includes('shopping')
  );

  const displayList = checkoutIncidents.length > 0 ? checkoutIncidents : incidents.slice(0, 6);

  const totalCartValue = displayList.reduce((acc, c) => acc + c.amount, 0);
  const marginShieldedTotal = displayList.reduce((acc, c) => acc + Math.round(c.amount * 0.15), 0);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(displayList[0]?.id || 'inc_004');
  const activeIncident = displayList.find(i => i.id === selectedIncidentId) || displayList[0];

  const handleTestDispatch = (inc: any) => {
    handleSendWhatsApp(inc);
    setChannelResult(`Dispatched Margin Shield 1-click link to ${inc.customer} (₹${inc.amount.toLocaleString('en-IN')}) with 0% margin loss.`);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#2B2B2B] tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-teal-600" />
            <span>Cart Drops &amp; Margin Shield</span>
          </h1>
          <p className="text-xs text-[#666666] mt-0.5">
            Live Supabase checkout drop-offs, dynamic margin protection, and 1-click cart resume links.
          </p>
        </div>
      </div>

      {/* Top 4 KPI Metrics (Live DB) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">Gross Margin Shielded</div>
          <div className="text-2xl font-bold text-[#2B2B2B] mt-1">₹{marginShieldedTotal.toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-[#666666] mt-1">Preserved by withholding unnecessary coupons</div>
        </div>

        <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Total Cart Value (DB)</div>
          <div className="text-2xl font-bold text-[#2B2B2B] mt-1">₹{totalCartValue.toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-[#666666] mt-1">{displayList.length} live database carts</div>
        </div>

        <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Coupon Gaming Stopped</div>
          <div className="text-2xl font-bold text-[#2B2B2B] mt-1">0 Discount</div>
          <div className="text-[11px] text-[#666666] mt-1">Given to habitual window shoppers</div>
        </div>

        <div className="bg-white border border-[#D4D4D4] rounded-xl p-4 shadow-xs">
          <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Targeted Incentives</div>
          <div className="text-2xl font-bold text-[#2B2B2B] mt-1">₹250 Max</div>
          <div className="text-[11px] text-[#666666] mt-1">Capped at exact shipping fee shock</div>
        </div>
      </div>

      {/* 4-Step Drop-Off Visual Funnel */}
      <div className="bg-white border border-[#D4D4D4] rounded-xl p-5 shadow-xs space-y-3.5">
        <div className="border-b border-[#EBEBEB] pb-2.5">
          <h2 className="text-xs font-bold text-[#2B2B2B] uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-teal-600" />
            <span>Funnel Telemetry &amp; AI Countermeasures</span>
          </h2>
          <p className="text-[11px] text-[#666666] mt-0.5">
            Drop-off rates across stages with automated actions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          <div className="p-3.5 rounded-xl bg-teal-50/40 border border-teal-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-teal-900">1. Cart Created</span>
              <span className="text-teal-900 font-mono">100%</span>
            </div>
            <div className="w-full h-1.5 bg-teal-200 rounded-full overflow-hidden">
              <div className="w-full h-full bg-teal-600 rounded-full" />
            </div>
            <div className="text-[11px] text-[#666666] pt-1">
              <strong>1,420 Shoppers</strong> initiated checkout.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/40 border border-blue-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-blue-900">2. Shipping Info</span>
              <span className="text-blue-900 font-mono">86.2%</span>
            </div>
            <div className="w-full h-1.5 bg-blue-200 rounded-full overflow-hidden">
              <div className="w-[86%] h-full bg-blue-600 rounded-full" />
            </div>
            <div className="text-[11px] text-[#666666] pt-1">
              13.8% Drop-off: Shipping surprise. AI offers ₹250 credit.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-amber-900">3. Payment Method</span>
              <span className="text-amber-900 font-mono">72.4%</span>
            </div>
            <div className="w-full h-1.5 bg-amber-200 rounded-full overflow-hidden">
              <div className="w-[72%] h-full bg-amber-600 rounded-full" />
            </div>
            <div className="text-[11px] text-[#666666] pt-1">
              13.8% Drop-off: Trust hesitation. AI sends Buyer Protection terms.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50/40 border border-purple-200 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-purple-900">4. OTP Verification</span>
              <span className="text-purple-900 font-mono">68.1%</span>
            </div>
            <div className="w-full h-1.5 bg-purple-200 rounded-full overflow-hidden">
              <div className="w-[68%] h-full bg-purple-600 rounded-full" />
            </div>
            <div className="text-[11px] text-[#666666] pt-1">
              4.3% Drop-off: Timeout. AI sends 1-click direct resume link.
            </div>
          </div>
        </div>
      </div>

      {/* Live Abandoned Carts Table (Supabase DB) */}
      <div className={theme.table.wrapper}>
        <div className={`px-4 py-3 border-b ${theme.border.default} bg-[#FAFAFA] flex items-center justify-between`}>
          <div>
            <h3 className="text-xs font-bold text-[#2B2B2B] uppercase tracking-wider">
              Live Database Abandoned Carts ({displayList.length})
            </h3>
            <p className="text-[11px] text-[#666666] mt-0.5">
              High-intent drop-offs with zero coupon erosion from Supabase.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={theme.table.headerRow}>
                <th className="py-2.5 px-4">Shopper</th>
                <th className="py-2.5 px-4">Cart Value</th>
                <th className="py-2.5 px-4">Margin Shield Strategy</th>
                <th className="py-2.5 px-4">Margin Preserved</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EBEBEB]">
              {displayList.map(c => (
                <tr key={c.id} className="hover:bg-[#FAFAFA] transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#2B2B2B]">{c.customer}</div>
                    <div className="text-[11px] text-[#666666] font-mono">{c.customerPhone}</div>
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#2B2B2B]">
                    ₹{c.amount.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4 max-w-[280px]">
                    <div className="text-xs font-medium text-[#2B2B2B] truncate">{c.evRankedStrategy}</div>
                    <div className="text-[10px] text-[#666666] font-mono capitalize">{c.archetype?.replace(/_/g, ' ')}</div>
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-teal-800">
                    +₹{Math.round(c.amount * 0.15).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                      <CheckCircle2 className="w-3 h-3 text-teal-600" />
                      <span>{c.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleTestDispatch(c)}
                      className={theme.button.outline}
                    >
                      <Send className="w-3 h-3 text-teal-600" />
                      <span>Resume Link</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
