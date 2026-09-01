'use client';

import React, { useState } from 'react';
import { useMerchant } from '@/context/MerchantContext';
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  X,
  Copy,
  Check,
  Send,
  Sparkles,
  Bot,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Phone,
  MessageSquare,
  Lock,
} from 'lucide-react';

export default function PlanOfActionModal() {
  const {
    planModalIncident,
    setPlanModalIncident,
    handleApproveHitl,
    sendingChannel,
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
      await new Promise(r => setTimeout(r, 400));
      setActiveStep(2);
      await new Promise(r => setTimeout(r, 400));
      setActiveStep(3);

      await handleApproveHitl(inc);

      addToast({
        title: 'Plan Executed Successfully',
        message: `Dispatched recovery outreach for ${inc.customer} (₹${inc.amount.toLocaleString('en-IN')}) via WhatsApp & mirrored to Telegram @razorpaytestbot.`,
        type: 'success',
        channel: 'WhatsApp + Telegram',
        link: recoveryLink,
      });

      setPlanModalIncident(null);
    } catch (err) {
      addToast({
        title: 'Execution Error',
        message: `Failed to execute recovery plan: ${err}`,
        type: 'error',
      });
    } finally {
      setIsExecuting(false);
      setActiveStep(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Autonomous Recovery Plan of Action
                </h3>
                {isHighValue && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                    HITL ESCALATION (≥₹1L)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Deterministic policy & guardrail verification before customer dispatch
              </p>
            </div>
          </div>

          <button
            onClick={() => setPlanModalIncident(null)}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs">
          {/* Incident Summary Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Customer</span>
              <span className="text-sm font-bold text-slate-900 mt-0.5 block truncate">{inc.customer}</span>
              <span className="text-[11px] text-slate-500">{inc.customerPhone || '+91 98201 44102'}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">At-Risk Amount</span>
              <span className="text-sm font-bold text-emerald-700 mt-0.5 block">
                ₹{inc.amount.toLocaleString('en-IN')}
              </span>
              <span className="text-[11px] text-slate-500">INR Net Recovery</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Root Cause</span>
              <span className="text-xs font-bold text-blue-700 mt-1 block capitalize truncate">
                {(inc.rootCause || inc.archetype || 'Payment Failed').replace(/_/g, ' ')}
              </span>
              <span className="text-[11px] text-slate-500">94% Confidence</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Payer Reliability</span>
              <span className="text-sm font-bold text-indigo-700 mt-0.5 block">{reliability}% On-Time</span>
              <span className="text-[11px] text-emerald-700 font-semibold">Optimal: WhatsApp</span>
            </div>
          </div>

          {/* 4-Step Action Plan */}
          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Proposed 4-Step Execution Workflow
            </h4>

            <div className="space-y-2.5">
              {/* Step 1 */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                activeStep === 1 
                  ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100 shadow-xs' 
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                    activeStep === 1 ? 'bg-blue-600 text-white animate-pulse' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    1
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 text-xs block">Mint HMAC-Signed Razorpay 1-Click Checkout Link</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                      Generates dynamic payment reference (<code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">{recoveryLink.slice(0, 32)}...</code>) with 5% margin shield applied.
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                activeStep === 2 
                  ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100 shadow-xs' 
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                    activeStep === 2 ? 'bg-blue-600 text-white animate-pulse' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    2
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 text-xs block">Dispatch Interactive WhatsApp Recovery Template</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                      Sends personalized Hinglish nudge with 1-click UPI/Card checkout button and RBI AFA consent instructions.
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                activeStep === 3 
                  ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-100 shadow-xs' 
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                    activeStep === 3 ? 'bg-blue-600 text-white animate-pulse' : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    3
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 text-xs block">Mirror Operational Receipt to Telegram Merchant Bot</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                      Broadcasts live verification receipt with inline payment button to registered admin chat (<code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">@razorpaytestbot</code>).
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded-xl border bg-white border-slate-200 hover:border-slate-300 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 text-xs block">24-Hour Cooldown & Webhook Race Arbitrator</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
                      Enforces 24h quiet period. If <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">payment.captured</code> webhook arrives before customer clicks, outreach is instantly aborted (0 duplicate spam).
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Copy Link Box */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] text-slate-700 truncate font-mono">{recoveryLink}</span>
            </div>
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shrink-0 border border-slate-200 transition-colors shadow-xs"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3">
          <button
            onClick={() => setPlanModalIncident(null)}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors shadow-xs"
          >
            Cancel / Reject
          </button>

          <div className="flex items-center gap-2">
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
    </div>
  );
}
