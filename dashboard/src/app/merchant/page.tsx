'use client';

import React, { useRef, useState } from 'react';
import { MerchantProvider, useMerchant } from '@/context/MerchantContext';
import MerchantSidebar from '@/components/merchant/layout/MerchantSidebar';
import MerchantHeader from '@/components/merchant/layout/MerchantHeader';
import ForensicInspectionDrawer from '@/components/merchant/layout/ForensicInspectionDrawer';
import RecoveryQueueView from '@/components/merchant/views/RecoveryQueueView';
import CheckoutFunnelView from '@/components/merchant/views/CheckoutFunnelView';
import SubscriptionChurnView from '@/components/merchant/views/SubscriptionChurnView';
import B2BReceivablesView from '@/components/merchant/views/B2BReceivablesView';
import MandatesSchemeView from '@/components/merchant/views/MandatesSchemeView';
import PTPForecastView from '@/components/merchant/views/PTPForecastView';
import DeclineTaxonomyView from '@/components/merchant/views/DeclineTaxonomyView';
import PlanOfActionModal from '@/components/merchant/layout/PlanOfActionModal';
import NotificationToastCenter from '@/components/merchant/layout/NotificationToastCenter';
import AIChatBot from '@/components/AIChatBot';

function MerchantDashboardContent() {
  const {
    mainView,
    selectedIncident,
    isCopilotOpen,
    setIsCopilotOpen,
    copilotWidth,
    setCopilotWidth,
    stats,
    incidents,
  } = useMerchant();

  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // Resize handler for AI Copilot pane
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = document.body.clientWidth - e.clientX;
      if (newWidth >= 300 && newWidth <= 800) {
        setCopilotWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setCopilotWidth]);

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900 font-sans overflow-hidden">
      {/* Left Navigation Rail */}
      <MerchantSidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
        {/* Top Header */}
        <MerchantHeader />

        {/* Dynamic View Router Container */}
        <div className="flex-1 flex min-w-0 overflow-hidden relative">
          <main className="flex-1 min-w-0 overflow-y-auto p-6 custom-scrollbar">
            {mainView === 'queue' && <RecoveryQueueView />}
            {mainView === 'checkout_funnel' && <CheckoutFunnelView />}
            {mainView === 'subscription_churn' && <SubscriptionChurnView />}
            {mainView === 'b2b_receivables' && <B2BReceivablesView />}
            {mainView === 'mandates_scheme' && <MandatesSchemeView />}
            {mainView === 'ptp_forecast' && <PTPForecastView />}
            {mainView === 'decline_taxonomy' && <DeclineTaxonomyView />}
          </main>

          {/* 4-Tab Forensic Customer 360 Inspection Slide-Over Drawer */}
          <ForensicInspectionDrawer />

          {/* Right Resizable AI Copilot Drawer */}
          {isCopilotOpen && (
            <div
              className="hidden xl:flex shrink-0 h-full relative border-l border-slate-200 bg-white z-10"
              style={{ width: `${copilotWidth}px` }}
            >
              {/* Drag Handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-50 group hover:bg-[#00A3C4]/30 flex items-center justify-center -ml-1 transition-colors"
                onMouseDown={e => {
                  e.preventDefault();
                  isDraggingRef.current = true;
                  setIsDragging(true);
                  document.body.style.cursor = 'col-resize';
                }}
              />

              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <AIChatBot
                  role="merchant"
                  customerName={selectedIncident ? selectedIncident.customer : 'Merchant Operations'}
                  amount={selectedIncident ? selectedIncident.amount : stats.totalAtRisk}
                  rootCause={selectedIncident ? selectedIncident.rootCause : 'portfolio_overview'}
                  customerId={selectedIncident?.customerId || 'portfolio'}
                  merchantId="merch_01"
                  isOpen={isCopilotOpen}
                  onToggleOpen={() => setIsCopilotOpen(false)}
                  resizableWidth={copilotWidth}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Autonomous Recovery Plan of Action Modal */}
      <PlanOfActionModal />

      {/* Floating Rich Toast Notification Center */}
      <NotificationToastCenter />
    </div>
  );
}

export default function MerchantDashboardPage() {
  return (
    <MerchantProvider>
      <MerchantDashboardContent />
    </MerchantProvider>
  );
}
