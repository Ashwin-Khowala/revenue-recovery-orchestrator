'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AIChatBot from '@/components/AIChatBot';

export default function CustomerPayerPortal() {
  const [customerName] = useState('Ashwin Khowala');
  const [originalAmount] = useState(4999);
  const [amount, setAmount] = useState(4999);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [ptpDate, setPtpDate] = useState<string | null>(null);
  const [paidSuccess, setPaidSuccess] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [notification, setNotification] = useState<{ type: 'success' | 'info'; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const showNotification = (type: 'success' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  const handleClaimDiscount = () => {
    if (!discountApplied) {
      const discounted = Math.round(originalAmount * 0.95);
      setAmount(discounted);
      setDiscountApplied(true);
      showNotification('success', '🎉 5% Settlement Concession applied! New payable total: ₹' + discounted.toLocaleString('en-IN'));
    }
  };

  const handleRegisterPtp = (date: string) => {
    setPtpDate(date);
    showNotification('info', `🤝 Promise-to-Pay confirmed for ${date}. All automated recovery outreach has been paused.`);
  };

  const handleSimulatePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setPaidSuccess(true);
      showNotification('success', '✓ Payment captured successfully. Confirmation receipt dispatched.');
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800 antialiased">
      {/* 1. TOP BRANDED NAVIGATION */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00A3C4] flex items-center justify-center text-white font-extrabold text-base shadow-sm">
              R
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 leading-tight">
                  Razorpay Verified Checkout
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  256-Bit SSL Encrypted
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Invoice Recovery & Settlement Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://t.me/razorpaytestbot"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 text-[#00A3C4] border border-cyan-200 text-xs font-bold hover:bg-cyan-100 transition-colors"
            >
              <span>🤖</span>
              <span>Telegram Bot</span>
            </a>

            <Link
              href="/merchant"
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
            >
              Merchant Ops &rarr;
            </Link>

            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs border border-slate-300">
              AK
            </div>
          </div>
        </div>
      </header>

      {/* Floating Notification Toast */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div
            className={`px-5 py-3 rounded-xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
              notification.type === 'success'
                ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                : 'bg-slate-900 text-cyan-200 border-slate-700'
            }`}
          >
            <span>{notification.type === 'success' ? '✨' : 'ℹ️'}</span>
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 text-slate-400 hover:text-white">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* 2. MAIN 2-COLUMN CHECKOUT EXPERIENCE */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 flex flex-col lg:flex-row gap-8 items-start">
        
        {/* LEFT COLUMN: Clean Invoice & Settlement Card */}
        <main className="flex-1 w-full space-y-6 min-w-0">
          
          {/* Customer Welcome & Notice Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                  Payment Attention Needed
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Hello, {customerName}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                Your subscription payment for <strong className="text-slate-700 font-semibold">SaaS Subscriptions Pro</strong> experienced a temporary bank soft-decline. You can complete the settlement below, apply your pre-approved loyalty concession, or select a convenient payment date.
              </p>
            </div>
            <div className="hidden sm:flex flex-col items-end shrink-0">
              <span className="text-[10px] text-slate-400 font-mono">Invoice Reference</span>
              <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded mt-0.5">INV-2026-8842</span>
            </div>
          </div>

          {/* Detailed Invoice & Payment Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
            
            {/* Invoice Breakdown Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Invoice Summary</h3>
                <p className="text-xs text-slate-400 mt-0.5">Annual Plan Subscription Renewal</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${paidSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {paidSuccess ? '✓ Paid & Settled' : 'Pending Settlement'}
              </span>
            </div>

            {/* Line Items Table */}
            <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-100 space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>SaaS Subscriptions Pro &mdash; Annual Plan</span>
                <span className="font-semibold text-slate-900">₹{originalAmount.toLocaleString('en-IN')}</span>
              </div>
              
              {discountApplied && (
                <div className="flex items-center justify-between text-emerald-600 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span>🎁</span>
                    <span>5% Instant Settlement Concession</span>
                  </span>
                  <span>-₹{(originalAmount - amount).toLocaleString('en-IN')}</span>
                </div>
              )}

              {ptpDate && (
                <div className="flex items-center justify-between text-purple-600 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span>🤝</span>
                    <span>Promise-to-Pay Scheduled</span>
                  </span>
                  <span>{ptpDate} (Outreach Paused)</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-sm">
                <span className="font-bold text-slate-900">Total Payable</span>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-[#00A3C4]">₹{amount.toLocaleString('en-IN')}</span>
                  {discountApplied && (
                    <div className="text-[10px] text-emerald-600 font-bold">5% discount savings included</div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            {!paidSuccess && (
              <div className="space-y-3 pt-1">
                <div className="text-xs font-bold text-slate-700">Select Payment Route:</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'upi', label: 'UPI (GPay / PhonePe)', icon: '⚡' },
                    { id: 'card', label: 'Credit / Debit Card', icon: '💳' },
                    { id: 'netbanking', label: 'NetBanking / Mandate', icon: '🏦' },
                  ].map(method => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethod(method.id as any)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        selectedMethod === method.id
                          ? 'border-[#00A3C4] bg-cyan-50/40 text-slate-900 ring-1 ring-[#00A3C4]'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="text-base mb-1">{method.icon}</div>
                      <div className="text-xs font-bold leading-tight">{method.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {!paidSuccess ? (
              <div className="space-y-3 pt-2">
                <a
                  href="https://rzp.io/rzp/Qf0zRD2B"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 rounded-xl bg-[#00A3C4] hover:bg-[#008ea6] text-white text-sm font-extrabold transition-all shadow-md flex items-center justify-center gap-2 text-center"
                >
                  <span>💳 Pay ₹{amount.toLocaleString('en-IN')} via Razorpay Gateway</span>
                  <span>&rarr;</span>
                </a>

                <button
                  onClick={handleSimulatePayment}
                  disabled={isProcessing}
                  className="w-full py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors border border-emerald-200 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                      <span>Reconciling payment webhook...</span>
                    </>
                  ) : (
                    <span>✓ Simulate Payment Capture (Webhook Reconciliation Test)</span>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 text-2xl flex items-center justify-center mx-auto">
                  ✓
                </div>
                <h4 className="text-base font-bold text-emerald-900">Payment Successfully Captured</h4>
                <p className="text-xs text-emerald-700 max-w-md mx-auto">
                  ₹{amount.toLocaleString('en-IN')} has been settled. The Razorpay Webhook Reconciler has automatically canceled all reminder queues and marked your account in good standing.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setPaidSuccess(false);
                      setDiscountApplied(false);
                      setAmount(originalAmount);
                      setPtpDate(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                  >
                    Reset Demo State
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Self-Service Options: Concession & Promise-to-Pay */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* 5% Discount Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-base font-bold">
                  🎁
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2.5">5% Instant Settlement Concession</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Based on your on-time payment track record, our decision engine has pre-approved an instant 5% concession on this invoice.
                </p>
              </div>

              <button
                onClick={handleClaimDiscount}
                disabled={discountApplied || paidSuccess}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-all shadow-xs"
              >
                {discountApplied ? '✓ 5% Discount Applied (₹4,749)' : 'Claim 5% Discount Now'}
              </button>
            </div>

            {/* Promise-to-Pay Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-base font-bold">
                  🤝
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2.5">Promise to Pay Later</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Need a few days? Select a target payment date. We will pause all automated phone calls and reminder messages until then.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  {['Tomorrow', 'Next Monday', 'Sep 5th'].map((d, i) => (
                    <button
                      key={i}
                      disabled={paidSuccess}
                      onClick={() => handleRegisterPtp(d)}
                      className={`flex-1 py-2 rounded-lg font-bold border transition-all text-xs ${
                        ptpDate === d
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 disabled:opacity-50'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                {ptpDate && (
                  <div className="text-[11px] text-purple-700 font-medium text-center">
                    ✓ Outreach paused until {ptpDate}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN: AI Payment Concierge Card */}
        <div className="w-full lg:w-[420px] shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden sticky top-20">
          <div className="h-[680px] flex flex-col">
            <AIChatBot
              role="payer"
              customerName={customerName}
              amount={amount}
              rootCause="subscription_failed"
              defaultOpen={true}
              isOpen={true}
              onToggleOpen={() => {}}
              onToolAction={action => {
                if (action.tool === 'apply_concession_discount' && action.updatedAmount) {
                  setAmount(action.updatedAmount);
                  setDiscountApplied(true);
                  showNotification('success', `🎉 5% Discount applied by AI Copilot! Updated: ₹${action.updatedAmount.toLocaleString('en-IN')}`);
                } else if (action.tool === 'register_promise_to_pay' && action.promisedDate) {
                  setPtpDate(action.promisedDate);
                  showNotification('info', `🤝 Promise-to-Pay registered for ${action.promisedDate}. Reminders paused.`);
                }
              }}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
