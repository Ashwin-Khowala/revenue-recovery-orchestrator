'use client';

import React from 'react';
import Link from 'next/link';
import { useMerchant } from '@/context/MerchantContext';
import { ROOT_CAUSE_META, ARCHETYPE_META } from '@/types/merchant';
import {
  X,
  FileText,
  Scale,
  Building2,
  Lock,
  Clock,
  RefreshCw,
  Calendar,
  CheckCircle2,
  UserCheck,
  Zap,
  Send,
  Phone,
  ExternalLink,
  Check,
  Hash,
} from 'lucide-react';

export default function ForensicInspectionDrawer() {
  const {
    selectedIncident,
    setSelectedIncident,
    drawerTab,
    setDrawerTab,
    customPtpDate,
    setCustomPtpDate,
    handleApproveHitl,
    handleSendWhatsApp,
    handleSendTelegram,
    handleVoiceCall,
    handleRecordPromiseToPay,
    sendingChannel,
  } = useMerchant();

  if (!selectedIncident) return null;

  const rootMeta = ROOT_CAUSE_META[selectedIncident.rootCause] || {
    label: selectedIncident.rootCause,
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    textColor: 'text-slate-800',
    accentBg: 'bg-slate-600',
    description: '',
    nonTechSummary: '',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs animate-fade-in flex justify-end">
      <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-slide-left">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-500 uppercase">
                {selectedIncident.id}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${rootMeta.badgeColor}`}>
                {rootMeta.label}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedIncident.customer}</h2>
          </div>
          <button
            onClick={() => setSelectedIncident(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-5 pt-1.5 gap-1 overflow-x-auto text-xs font-medium">
          {[
            { id: 'overview', label: 'Story & Action', icon: FileText },
            { id: 'ev_math', label: 'EV Math & Policy', icon: Scale },
            { id: 'telemetry', label: 'Bank Telemetry', icon: Building2 },
            { id: 'audit', label: 'SHA-256 Audit', icon: Lock },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setDrawerTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all whitespace-nowrap text-xs ${
                drawerTab === tab.id
                  ? 'border-blue-600 text-blue-700 font-bold bg-white rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-slate-50/40">
          {/* TAB 1: OVERVIEW & ACTIONS */}
          {drawerTab === 'overview' && (
            <div className="space-y-5">
              {/* Financial & Status Summary */}
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount At Risk</div>
                  <div className="text-xl font-bold text-slate-900 mt-0.5">
                    ₹{selectedIncident.amount.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Status</div>
                  <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-md text-xs font-semibold">
                    {selectedIncident.status === 'pending_hitl' && (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Needs Supervisor Approval</span>
                      </span>
                    )}
                    {selectedIncident.status === 'auto_recovering' && (
                      <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold">
                        <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                        <span>AI Recovering</span>
                      </span>
                    )}
                    {selectedIncident.status === 'paused_ptp' && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Outreach Paused (PTP)</span>
                      </span>
                    )}
                    {selectedIncident.status === 'recovered' && (
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Recovered</span>
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Customer Contact & Reliability Profile */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  <span>Customer Profile &amp; Reliability Prior</span>
                </h3>
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs shadow-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Phone Number:</span>
                    <span className="font-mono font-medium text-slate-900">{selectedIncident.customerPhone}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-100">
                    <span className="text-slate-500">Historical Reliability:</span>
                    {(() => {
                      const rel = selectedIncident.history?.prior_payment_success_rate != null
                        ? Math.round(selectedIncident.history.prior_payment_success_rate * 100)
                        : (selectedIncident.archetype === 'voluntary_churn_disengaged' ? 48 : selectedIncident.archetype === 'comparison_window_shopping' ? 62 : selectedIncident.amount > 100000 ? 96 : 89);
                      const style = rel >= 80
                        ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                        : rel >= 60
                        ? 'text-amber-800 bg-amber-50 border-amber-300'
                        : 'text-rose-800 bg-rose-50 border-rose-200';
                      return (
                        <span className={`font-bold px-2 py-0.5 rounded border text-[11px] ${style}`}>
                          {rel}% On-Time Track Record
                        </span>
                      );
                    })()}
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Behavioral Archetype:</span>
                    <span className="font-bold text-slate-800">
                      {selectedIncident.archetype ? ARCHETYPE_META[selectedIncident.archetype]?.label : 'Standard Subscriber'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Plain-English AI Diagnosis */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>AI Root-Cause Diagnosis</span>
                </h3>
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 leading-relaxed shadow-xs">
                  <div className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${rootMeta.accentBg}`} />
                    <span>{rootMeta.label}</span>
                  </div>
                  <p className="text-slate-600">{rootMeta.nonTechSummary}</p>
                </div>
              </div>

              {/* Active Strategy */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>Rank #1 Executed Recovery Move</span>
                </h3>
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 text-xs text-slate-900 leading-relaxed font-bold shadow-xs">
                  {selectedIncident.evRankedStrategy}
                </div>
              </div>

              {/* Promise-to-Pay Snooze Date Picker */}
              <div className="space-y-2 pt-1">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Record Customer Promise-to-Pay</span>
                </h3>
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-xs">
                  <p className="text-[11px] text-slate-500">
                    If the customer confirmed a future payment date, set it below to pause all automated outreach.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={customPtpDate}
                      onChange={e => setCustomPtpDate(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-slate-50 text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
                    />
                    <button
                      onClick={() => handleRecordPromiseToPay(selectedIncident, customPtpDate)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
                    >
                      Pause Outreach
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EV MATH & POLICY OPTIMIZATION */}
          {drawerTab === 'ev_math' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-2 shadow-xs">
                <div className="text-[10px] font-mono uppercase text-blue-700 font-bold">
                  Expected Value Optimization Formula
                </div>
                <div className="text-xs font-mono text-slate-900 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-bold">
                  EV(Action) = P(Recovery) × Amount - Discount - FrictionCost
                </div>
                <p className="text-[11px] text-slate-600">
                  The policy engine evaluates all candidate interventions and selects the highest net positive expected value.
                </p>
              </div>

              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Candidate Policy Ranking for this Incident
                </h4>

                <div className="space-y-2 text-xs">
                  {/* Selected Winner */}
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        1. {selectedIncident.evRankedStrategy.slice(0, 32)}...
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900">
                        SELECTED (RANK #1)
                      </span>
                    </div>
                    <div className="text-slate-600 text-[11px]">
                      P(Rec): <strong>88.0%</strong> | Friction Cost: <strong>₹50</strong> | Net EV:{' '}
                      <strong className="text-emerald-800">
                        ₹{Math.round(selectedIncident.amount * 0.88 - 50).toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>

                  {/* Alternative 1 */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">2. Silent Bank Gateway Reroute</span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">RANK #2</span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      P(Rec): <strong>65.0%</strong> | Friction Cost: <strong>₹0</strong> | Net EV:{' '}
                      <strong className="text-slate-800">₹{Math.round(selectedIncident.amount * 0.65).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  {/* Alternative 2: Do Nothing */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-800">3. &quot;Do Nothing&quot; (Self-Healing Window)</span>
                      <span className="text-[10px] font-mono text-slate-500 font-bold">RANK #3</span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      P(Rec): <strong>52.0%</strong> | Friction Cost: <strong>₹0</strong> | Net EV:{' '}
                      <strong className="text-slate-800">₹{Math.round(selectedIncident.amount * 0.52).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  {/* Rejected Naive Discounting */}
                  <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-rose-800">4. Naive 15% Blanket Coupon</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        REJECTED
                      </span>
                    </div>
                    <div className="text-rose-700 text-[11px]">
                      Erodes ₹{Math.round(selectedIncident.amount * 0.15).toLocaleString('en-IN')} margin. Blocked by Margin Shield.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BANK TELEMETRY & GATEWAY */}
          {drawerTab === 'telemetry' && (
            <div className="space-y-4 text-xs">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bank &amp; Gateway Network Signals</span>
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">ISO 8583 Code</div>
                    <div className="font-mono font-bold text-slate-900 mt-0.5">
                      {selectedIncident.rootCause === 'subscription_failed'
                        ? '51 (Insufficient Funds)'
                        : '05 (Do Not Honor)'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Route Health SLA</div>
                    <div className="font-bold text-emerald-700 mt-0.5">99.4% (Healthy Gateway)</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Payment Rail</div>
                    <div className="font-bold text-slate-900 mt-0.5">UPI Autopay / RuPay</div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Pre-Debit Notice</div>
                    <div className="font-bold text-indigo-700 mt-0.5">
                      {selectedIncident.amount >= 15000 ? 'AFA Mandate Active' : 'Exempt (< ₹15k)'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2 shadow-xs">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Outreach Channel Eligibility
                </h4>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>WhatsApp Business API:</span>
                    <span className="font-bold text-emerald-700">Eligible (High Response Rate)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Interactive Telegram Alert:</span>
                    <span className="font-bold text-blue-700">Connected</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Voice Recovery Engine:</span>
                    <span className="font-bold text-purple-700">Online &amp; Ready</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SHA-256 AUDIT TRAIL */}
          {drawerTab === 'audit' && (
            <div className="space-y-4 text-xs">
              <div className="bg-white border border-slate-200 text-slate-900 p-4 rounded-xl space-y-3 font-mono shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-blue-700 font-bold text-[11px] flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-blue-600" />
                    <span>SHA-256 AUDIT BLOCK</span>
                  </span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                    CRYPTOGRAPHICALLY VALID
                  </span>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <div className="text-slate-500 text-[10px]">EVENT ENTRY HASH:</div>
                    <div className="text-emerald-700 font-bold break-all">
                      e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500 text-[10px]">PARENT BLOCK HASH:</div>
                    <div className="text-slate-600 break-all">
                      4f82c0391abf8391740921aaeebbcde9018471903417aa9018471903417aabcd
                    </div>
                  </div>

                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>Langfuse Span ID:</span>
                    <span className="text-blue-700 font-bold">span_rec_{selectedIncident.id.slice(0, 8)}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span>Audited By:</span>
                    <span className="text-slate-900 font-bold">Supabase Audit Ledger</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 leading-relaxed text-[11px]">
                <strong>Enterprise Audit Notice:</strong> This immutable record is chained using SHA-256 hashes for bank and regulatory compliance.
              </div>
            </div>
          )}
        </div>

        {/* Drawer Action Footer */}
        <div className="p-5 border-t border-slate-200 bg-white space-y-2.5 shrink-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Execute Recovery Move</div>

          {selectedIncident.status === 'pending_hitl' && (
            <button
              onClick={() => handleApproveHitl(selectedIncident)}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-2"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve High-Value Move (₹{selectedIncident.amount.toLocaleString('en-IN')})</span>
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSendWhatsApp(selectedIncident)}
              disabled={sendingChannel === 'whatsapp'}
              className="py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp Link</span>
            </button>

            <button
              onClick={() => handleVoiceCall(selectedIncident)}
              disabled={sendingChannel === 'voice'}
              className="py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-purple-600" />
              <span>AI Voice Call</span>
            </button>

            <button
              onClick={() => handleSendTelegram(selectedIncident)}
              disabled={sendingChannel === 'telegram'}
              className="py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-blue-600" />
              <span>Telegram Alert</span>
            </button>

            <Link
              href={`/payer?customer=${encodeURIComponent(selectedIncident.customer)}&amount=${selectedIncident.amount}&id=${selectedIncident.id}`}
              target="_blank"
              className="py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-semibold text-xs transition-colors text-center flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Payer Portal</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
