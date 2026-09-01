'use client';

import React from 'react';
import Link from 'next/link';
import { useMerchant } from '@/context/MerchantContext';
import { MainView } from '@/types/merchant';
import { theme } from '@/lib/theme';
import {
  Zap,
  ShoppingCart,
  RefreshCw,
  Briefcase,
  ClipboardCheck,
  Calendar,
  Layers,
  Sliders,
  Users,
  AlertOctagon,
  ExternalLink,
} from 'lucide-react';

export default function MerchantSidebar() {
  const { mainView, setMainView, incidents, realtimeStatus, isSyncing } = useMerchant();

  const safeIncidents = Array.isArray(incidents) ? incidents : [];
  const pendingHitlCount = safeIncidents.filter(i => i.status === 'pending_hitl').length;
  const activeCount = safeIncidents.filter(i => i.status !== 'recovered').length;

  const NAV_ITEMS: {
    id: MainView;
    label: string;
    icon: React.ReactNode;
    activeStyle: string;
    iconColor: string;
    badge?: string;
    badgeStyle?: string;
  }[] = [
    {
      id: 'queue',
      label: 'Recovery Action Center',
      icon: <Zap className="w-4 h-4" />,
      activeStyle: 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs font-bold',
      iconColor: 'text-blue-600',
      badge: `${activeCount}`,
      badgeStyle: 'bg-blue-100 text-blue-800 border border-blue-200',
    },
    {
      id: 'checkout_funnel',
      label: 'Cart Drops & Margin Shield',
      icon: <ShoppingCart className="w-4 h-4" />,
      activeStyle: 'bg-teal-50 text-teal-700 border border-teal-200 shadow-xs font-bold',
      iconColor: 'text-teal-600',
    },
    {
      id: 'subscription_churn',
      label: 'Subscription Churn Guard',
      icon: <RefreshCw className="w-4 h-4" />,
      activeStyle: 'bg-purple-50 text-purple-700 border border-purple-200 shadow-xs font-bold',
      iconColor: 'text-purple-600',
    },
    {
      id: 'b2b_receivables',
      label: 'B2B Receivables Ledger',
      icon: <Briefcase className="w-4 h-4" />,
      activeStyle: 'bg-amber-50 text-amber-800 border border-amber-200 shadow-xs font-bold',
      iconColor: 'text-amber-600',
      badge: pendingHitlCount > 0 ? `${pendingHitlCount}` : undefined,
      badgeStyle: 'bg-amber-100 text-amber-800 border border-amber-300',
    },
    {
      id: 'mandates_scheme',
      label: 'Recurring Mandates',
      icon: <ClipboardCheck className="w-4 h-4" />,
      activeStyle: 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs font-bold',
      iconColor: 'text-indigo-600',
    },
    {
      id: 'ptp_forecast',
      label: 'Promise-to-Pay Cash Flow',
      icon: <Calendar className="w-4 h-4" />,
      activeStyle: 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs font-bold',
      iconColor: 'text-emerald-600',
    },
    {
      id: 'decline_taxonomy',
      label: 'Bank Decline Intelligence',
      icon: <Layers className="w-4 h-4" />,
      activeStyle: 'bg-slate-100 text-slate-800 border border-slate-300 shadow-xs font-bold',
      iconColor: 'text-slate-600',
    },
    {
      id: 'exceptions',
      label: 'Exceptions & Stopping Rules',
      icon: <AlertOctagon className="w-4 h-4" />,
      activeStyle: 'bg-rose-50 text-rose-800 border border-rose-200 shadow-xs font-bold',
      iconColor: 'text-rose-600',
      badge: 'Audit',
      badgeStyle: 'bg-rose-100 text-rose-800 border border-rose-300',
    },
  ];

  return (
    <aside className={`w-64 border-r ${theme.border.default} ${theme.layout.sidebarBg} flex flex-col shrink-0`}>
      {/* Brand Header */}
      <div className={`p-4 border-b ${theme.border.default} flex items-center gap-3`}>
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
          R
        </div>
        <div>
          <div className="font-bold text-[#2B2B2B] text-sm leading-tight flex items-center gap-1.5">
            <span>Razorpay</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              RECOVER
            </span>
          </div>
          <div className="text-[11px] text-[#666666]">Merchant Operations</div>
        </div>
      </div>

      {/* Primary Navigation Rail */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
        <div className="px-3 py-1.5 text-[10px] font-bold text-[#B3B3B3] uppercase tracking-wider">
          Revenue Operations
        </div>

        {NAV_ITEMS.map(item => {
          const isActive = mainView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setMainView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                isActive
                  ? item.activeStyle
                  : 'text-[#666666] hover:bg-[#F5F5F5] hover:text-[#2B2B2B] font-medium'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <span className={isActive ? '' : item.iconColor}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    isActive ? item.badgeStyle || 'bg-white/80 text-[#2B2B2B]' : 'bg-[#F5F5F5] text-[#2B2B2B] border border-[#D4D4D4]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Secondary Operational Links */}
        <div className="pt-4 px-3 py-1.5 text-[10px] font-bold text-[#B3B3B3] uppercase tracking-wider">
          Controls &amp; Insights
        </div>

        <Link
          href="/merchant/optimizer"
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#666666] hover:bg-[#F5F5F5] hover:text-[#2B2B2B] transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-[#666666]" />
            <span>Policy Optimizer</span>
          </div>
          <ExternalLink className="w-3 h-3 text-[#B3B3B3]" />
        </Link>

        <Link
          href="/merchant/customers/merch_01"
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#666666] hover:bg-[#F5F5F5] hover:text-[#2B2B2B] transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Users className="w-4 h-4 text-[#666666]" />
            <span>Customer 360</span>
          </div>
          <ExternalLink className="w-3 h-3 text-[#B3B3B3]" />
        </Link>
      </div>

      {/* Live Telemetry Status Footer */}
      <div className={`p-3 border-t ${theme.border.default} bg-[#FAFAFA]`}>
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                realtimeStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="font-medium text-[#2B2B2B]">
              {realtimeStatus === 'connected' ? 'Telemetry Active' : 'Connecting...'}
            </span>
          </div>
          {isSyncing && <span className="text-[10px] text-blue-600 font-medium">Syncing</span>}
        </div>
      </div>
    </aside>
  );
}
