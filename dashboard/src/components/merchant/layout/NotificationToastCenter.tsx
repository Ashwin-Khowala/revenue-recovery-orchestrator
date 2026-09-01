'use client';

import React from 'react';
import { useMerchant } from '@/context/MerchantContext';
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  ExternalLink,
  Copy,
  Check,
  Send,
  ShieldCheck,
  Bot,
} from 'lucide-react';

export default function NotificationToastCenter() {
  const { toasts, removeToast } = useMerchant();
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
      {toasts.map(toast => {
        const isSuccess = toast.type === 'success' || !toast.type;
        const isWarning = toast.type === 'warning';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-up ${
              isSuccess
                ? 'bg-slate-900/95 border-emerald-500/40 text-white shadow-emerald-950/30'
                : isWarning
                ? 'bg-slate-900/95 border-amber-500/40 text-white shadow-amber-950/30'
                : isError
                ? 'bg-slate-900/95 border-rose-500/40 text-white shadow-rose-950/30'
                : 'bg-slate-900/95 border-blue-500/40 text-white shadow-blue-950/30'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Status Icon */}
              <div className="shrink-0 mt-0.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {isError && <AlertTriangle className="w-5 h-5 text-rose-400" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
              </div>

              {/* Toast Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
                    {toast.title || 'Recovery Notification'}
                    {toast.channel && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {toast.channel}
                      </span>
                    )}
                  </h4>
                  <button
                    onClick={() => removeToast(toast.id)}
                    className="text-slate-400 hover:text-slate-200 p-0.5 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {toast.message}
                </p>

                {/* Optional Link / Action */}
                {toast.link && (
                  <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => handleCopy(toast.link!, toast.id)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors border border-slate-700"
                    >
                      {copiedId === toast.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Link Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>Copy 1-Click Link</span>
                        </>
                      )}
                    </button>

                    <a
                      href={toast.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium ml-auto"
                    >
                      <span>Checkout Page</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
