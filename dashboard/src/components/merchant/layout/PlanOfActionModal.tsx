'use client';

import React, { useState } from 'react';
import { useMerchant } from '@/context/MerchantContext';
import {
  X,
  Copy,
  Check,
  Sparkles,
  Bot,
  ArrowRight,
  ShieldAlert,
  MessageSquare,
  Send,
  Clock,
  Link as LinkIcon,
  CheckCircle2,
} from 'lucide-react';

export default function PlanOfActionModal() {
  const {
    planModalIncident,
    setPlanModalIncident,
    handleApproveHitl,
    addToast,
  } = useMerchant();

  const [isExecuting, setIsExecuting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  if (!planModalIncident) return null;

  const inc = planModalIncident;
  const isHighValue = inc.amount >= 100000;
  const reliability = inc.history?.prior_payment_success_rate 
    ? Math.round(inc.history.prior_payment_success_rate * 100) 
    : 88;

  const recoveryLink = inc.paymentLink || inc.link || `https://rzp.io/i/${inc.customer.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)}_${Math.round(inc.amount)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(recoveryLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setActiveStep(1);

    try {
      await new Promise(r => setTimeout(r, 350));
      setActiveStep(2);
      await new Promise(r => setTimeout(r, 350));
      setActiveStep(3);

      await handleApproveHitl(inc);

      addToast({
        title: 'Recovery Plan Dispatched',
        message: `Approved outreach for ${inc.customer} (₹${inc.amount.toLocaleString('en-IN')}) via WhatsApp and mirrored to Telegram @razorpaytestbot.`,
        type: 'success',
        channel: 'WhatsApp + Telegram',
        link: recoveryLink,
      });

      setPlanModalIncident(null);
    } catch (err) {
      addToast({
        title: 'Execution Failed',
        message: `Could not execute recovery plan: ${err}`,
        type: 'error',
      });
    } finally {
      setIsExecuting(false);
      setActiveStep(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Recovery Plan of Action</h3>
                {isHighValue && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    High Value (&ge; ₹1L)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Review and authorize agent recovery actions before sending.
              </p>
            </div>
          </div>

          <button
            onClick={() => setPlanModalIncident(null)}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Top Summary Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{inc.customer}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100/70 text-blue-700 capitalize">
                  {(inc.rootCause || inc.archetype || 'Payment Failed').replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                <span>{inc.customerPhone || '+91 98201 44102'}</span>
                <span>•</span>
                <span>Reliability: <strong className="text-slate-700">{reliability}%</strong> on-time</span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">At-Risk</div>
              <div className="text-lg font-bold text-emerald-600">
                ₹{inc.amount.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {/* Stepped Timeline */}
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Execution Timeline
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {/* Step 1 */}
              <div className="relative">
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  activeStep === 1 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
                    : 'bg-white border-2 border-slate-300 text-slate-600'
                }`}>
                  1
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-all">
                  <div className="text-xs font-bold text-slate-900">Mint Razorpay 1-Click Payment Link</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Dynamic checkout link with 5% margin shield applied.
                  </div>
                  <div className="mt-2 flex items-center justify-between bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-200">
                    <span className="text-[11px] font-mono text-slate-600 truncate max-w-[320px]">
                      {recoveryLink}
                    </span>
                    <button
                      onClick={handleCopyLink}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 shrink-0 ml-2"
                    >
                      {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  activeStep === 2 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
                    : 'bg-white border-2 border-slate-300 text-slate-600'
                }`}>
                  2
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Dispatch Interactive WhatsApp Nudge</span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      WhatsApp
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Sends personalized recovery message with 1-click payment CTA.
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                  activeStep === 3 
                    ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
                    : 'bg-white border-2 border-slate-300 text-slate-600'
                }`}>
                  3
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Mirror Receipt to Merchant Admin</span>
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      Telegram @razorpaytestbot
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Live operational broadcast with inline verification receipt.
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="relative">
                <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white border-2 border-slate-300 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                  4
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-all">
                  <div className="text-xs font-bold text-slate-900">24-Hour Cooldown & Webhook Race Arbitrator</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Enforces 24h quiet window. If payment arrives before customer clicks, outreach is cancelled (0 duplicate spam).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
          <button
            onClick={() => setPlanModalIncident(null)}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors"
          >
            Cancel / Reject
          </button>

          <button
            onClick={handleExecute}
            disabled={isExecuting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>{isExecuting ? 'Executing Plan...' : 'Authorize & Execute Plan'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
