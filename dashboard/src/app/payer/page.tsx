'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AIChatBot from '@/components/AIChatBot';

export default function CustomerPayerPortal() {
  const [customerName, setCustomerName] = useState('Ashwin Khowala');
  const [amount, setAmount] = useState(4999);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [ptpDate, setPtpDate] = useState<string | null>(null);
  const [paidSuccess, setPaidSuccess] = useState(false);

  const handleClaimDiscount = () => {
    if (!discountApplied) {
      setAmount(prev => Math.round(prev * 0.95));
      setDiscountApplied(true);
      alert('🎉 5% Instant Concession Applied! Your updated payable amount is ₹4,749.');
    }
  };

  const handleRegisterPtp = (date: string) => {
    setPtpDate(date);
    alert(`🤝 Promise-to-Pay registered for ${date}! All automated reminder calls and messages are now paused.`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800">
      {/* 1. TOP NAVBAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-6 py-3">
        <div className="max-w-[1500px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00A3C4] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
              R
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                Razorpay Customer Payment Portal
              </h1>
              <p className="text-[11px] text-slate-500">Secure Invoice Recovery & Settlement</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://t.me/razorpaytestbot"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-cyan-50 text-[#00A3C4] border border-cyan-200 text-xs font-bold hover:bg-cyan-100 transition-colors"
            >
              🤖 Support Bot: @razorpaytestbot
            </a>

            <Link
              href="/merchant"
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
            >
              Switch to Merchant Operations &rarr;
            </Link>

            <div className="w-8 h-8 rounded-full bg-[#00A3C4] text-white font-bold flex items-center justify-center text-xs">
              A
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN 2-COLUMN VIEW */}
      <div className="max-w-[1500px] mx-auto w-full px-6 py-8 flex-1 flex flex-col lg:flex-row gap-8 items-start">
        {/* CENTER COLUMN: Invoice Details & Settlement Actions */}
        <main className="flex-1 w-full space-y-6">
          {/* Header Banner */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                Pending Payment Notice
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              Welcome back, {customerName}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your recurring subscription payment experienced a temporary bank soft-decline. You can complete settlement below with instant discounts or schedule a convenient date.
            </p>
          </div>

          {/* Invoice Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Invoice Reference</div>
                <div className="text-sm font-extrabold text-slate-900 font-mono mt-0.5">INV-2026-8842</div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                Action Required
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-slate-500 font-medium">Merchant</div>
                <div className="font-bold text-slate-900 mt-1">SaaS Subscriptions Pro</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-slate-500 font-medium">Reason</div>
                <div className="font-bold text-slate-900 mt-1">Subscription Soft-Decline</div>
              </div>
              <div className="p-3.5 rounded-xl bg-cyan-50/60 border border-cyan-100">
                <div className="text-[#00A3C4] font-medium">Payable Amount</div>
                <div className="text-lg font-extrabold text-[#00A3C4] mt-0.5">
                  ₹{amount.toLocaleString()}
                  {discountApplied && <span className="text-[11px] ml-1.5 text-emerald-600 font-bold">(5% Off)</span>}
                </div>
              </div>
            </div>

            {/* 1-Click Razorpay Pay Button */}
            {!paidSuccess ? (
              <div className="space-y-3 pt-2">
                <a
                  href="https://rzp.io/rzp/Qf0zRD2B"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 rounded-xl bg-[#00A3C4] hover:bg-[#008da8] text-white text-sm font-extrabold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <span>💳 Pay ₹{amount.toLocaleString()} Now via Razorpay</span>
                  <span>&rarr;</span>
                </a>

                <button
                  onClick={() => setPaidSuccess(true)}
                  className="w-full py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors border border-emerald-200"
                >
                  ✓ Simulate Payment Success (Test Capture)
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center space-y-1.5">
                <div className="text-2xl">🎉</div>
                <div className="text-sm font-extrabold">Payment Successful!</div>
                <div className="text-xs text-emerald-700">
                  ₹{amount.toLocaleString()} captured. Webhook reconciler has canceled all pending reminder queues.
                </div>
              </div>
            )}
          </div>

          {/* Concession Discount & Promise to Pay Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 5% Discount Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold">
                  🎁
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2">Claim 5% Instant Concession</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  As a valued customer with a strong track record, you are pre-approved for an instant 5% settlement discount.
                </p>
              </div>

              <button
                onClick={handleClaimDiscount}
                disabled={discountApplied}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-200 text-white text-xs font-bold transition-all shadow-xs"
              >
                {discountApplied ? '✓ 5% Discount Applied (₹4,749)' : 'Apply 5% Discount Now'}
              </button>
            </div>

            {/* Promise to Pay Card */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold">
                  🤝
                </div>
                <h3 className="text-sm font-bold text-slate-900 mt-2">Promise to Pay Later</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Need a few days? Choose a date to pause all automated reminder phone calls and WhatsApp messages.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2 text-xs">
                  {['Tomorrow', 'Next Monday', 'Sep 5th'].map((d, i) => (
                    <button
                      key={i}
                      onClick={() => handleRegisterPtp(d)}
                      className={`flex-1 py-2 rounded-lg font-bold border transition-all text-[11px] ${
                        ptpDate === d
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                {ptpDate && (
                  <div className="text-[10px] text-purple-700 font-medium text-center">
                    ✓ Paused until {ptpDate}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT COLUMN: Dhanvantari AI ChatBot tailored for Payer */}
        <AIChatBot
          role="payer"
          customerName={customerName}
          amount={amount}
          rootCause="subscription_failed"
          onToolAction={action => {
            if (action.tool === 'apply_concession_discount' && action.updatedAmount) {
              setAmount(action.updatedAmount);
              setDiscountApplied(true);
            } else if (action.tool === 'register_promise_to_pay' && action.promisedDate) {
              setPtpDate(action.promisedDate);
            }
          }}
        />
      </div>
    </div>
  );
}
