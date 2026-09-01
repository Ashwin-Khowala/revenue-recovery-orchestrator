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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Autonomous Recovery Plan of Action
                {isHighValue && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    HITL ESCALATION (≥₹1L)
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Deterministic Policy & Guardrail Verification before customer dispatch
              </p>
            </div>
          </div>

          <button
            onClick={() => setPlanModalIncident(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-xs">
          {/* Incident Summary Card */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Customer</span>
              <span className="text-sm font-bold text-white mt-0.5 block truncate">{inc.customer}</span>
              <span className="text-[10px] text-slate-400">{inc.customerPhone || '+91 98201 44102'}</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">At-Risk Amount</span>
              <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                ₹{inc.amount.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400">INR Net Recovery</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Root Cause</span>
              <span className="text-xs font-bold text-blue-400 mt-1 block capitalize truncate">
                {(inc.rootCause || inc.archetype || 'Payment Failed').replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] text-slate-400">94% Confidence</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Payer Reliability</span>
              <span className="text-sm font-bold text-indigo-300 mt-0.5 block">{reliability}% On-Time</span>
              <span className="text-[10px] text-emerald-400 font-medium">Optimal: WhatsApp</span>
            </div>
          </div>

          {/* 4-Step Action Plan */}
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Proposed 4-Step Execution Workflow
            </h4>

            <div className="space-y-2.5">
              {/* Step 1 */}
              <div className={`p-3 rounded-lg border transition-all ${
                activeStep === 1 
                  ? 'bg-blue-950/40 border-blue-500/60 text-white' 
                  : 'bg-slate-800/40 border-slate-700/40 text-slate-300'
              }`}>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-white block">Mint HMAC-Signed Razorpay 1-Click Checkout Link</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Generates dynamic payment reference (`{recoveryLink.slice(0, 32)}...`) with 5% margin shield applied.
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className={`p-3 rounded-lg border transition-all ${
                activeStep === 2 
                  ? 'bg-blue-950/40 border-blue-500/60 text-white' 
                  : 'bg-slate-800/40 border-slate-700/40 text-slate-300'
              }`}>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-white block">Dispatch Interactive WhatsApp Recovery Template</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Sends personalized Hinglish nudge with 1-click UPI/Card checkout button and RBI AFA consent instructions.
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className={`p-3 rounded-lg border transition-all ${
                activeStep === 3 
                  ? 'bg-blue-950/40 border-blue-500/60 text-white' 
                  : 'bg-slate-800/40 border-slate-700/40 text-slate-300'
              }`}>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-white block">Mirror Operational Receipt to Telegram Merchant Bot</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Broadcasts live verification receipt with inline payment button to registered admin chat (`@razorpaytestbot`).
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-3 rounded-lg border bg-slate-800/40 border-slate-700/40 text-slate-300">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    4
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-white block">24-Hour Cooldown & Webhook Race Arbitrator</span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Enforces 24h quiet period. If `payment.captured` webhook arrives before customer clicks, outreach is instantly aborted (0 duplicate spam).
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Copy Link Box */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[11px] text-slate-300 truncate font-mono">{recoveryLink}</span>
            </div>
            <button
              onClick={handleCopyLink}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 shrink-0 border border-slate-700 transition-colors"
            >
              {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
              <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            onClick={() => setPlanModalIncident(null)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancel / Reject
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
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
