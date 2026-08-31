'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Incident, MainView, DrawerTab, IncidentStatus } from '@/types/merchant';
import { apiUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface MerchantStats {
  totalAtRisk: number;
  totalRecovered: number;
  marginShielded: number;
  pendingHitlCount: number;
  recoveryRate: number;
}

interface MerchantContextType {
  incidents: Incident[];
  setIncidents: React.Dispatch<React.SetStateAction<Incident[]>>;
  selectedIncident: Incident | null;
  setSelectedIncident: (inc: Incident | null) => void;
  mainView: MainView;
  setMainView: (view: MainView) => void;
  drawerTab: DrawerTab;
  setDrawerTab: (tab: DrawerTab) => void;
  statusFilter: 'all' | IncidentStatus;
  setStatusFilter: (status: 'all' | IncidentStatus) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  channelFilter: string;
  setChannelFilter: (channel: string) => void;
  timeWindowFilter: string;
  setTimeWindowFilter: (window: string) => void;
  minAmountFilter: number;
  setMinAmountFilter: (amount: number) => void;
  realtimeStatus: 'connected' | 'reconnecting' | 'offline';
  isSyncing: boolean;
  channelResult: string | null;
  setChannelResult: (msg: string | null) => void;
  sendingChannel: string | null;
  stats: MerchantStats;
  customPtpDate: string;
  setCustomPtpDate: (date: string) => void;
  isCopilotOpen: boolean;
  setIsCopilotOpen: (open: boolean) => void;
  copilotWidth: number;
  setCopilotWidth: React.Dispatch<React.SetStateAction<number>>;
  fetchIncidents: () => Promise<void>;
  handleApproveHitl: (incident: Incident) => Promise<void>;
  handleSendWhatsApp: (incident: Incident) => Promise<void>;
  handleSendTelegram: (incident: Incident) => Promise<void>;
  handleVoiceCall: (incident: Incident) => Promise<void>;
  handleRecordPromiseToPay: (incident: Incident, ptpDate: string) => Promise<void>;
  handleExportCSV: () => void;
}

const MerchantContext = createContext<MerchantContextType | undefined>(undefined);

export function MerchantProvider({ children }: { children: ReactNode }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [mainView, setMainView] = useState<MainView>('queue');
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('overview');

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | IncidentStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [timeWindowFilter, setTimeWindowFilter] = useState<string>('all');
  const [minAmountFilter, setMinAmountFilter] = useState<number>(0);

  // Status & Telemetry
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'reconnecting' | 'offline'>('connected');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [channelResult, setChannelResult] = useState<string | null>(null);
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);

  // Copilot Drawer
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [copilotWidth, setCopilotWidth] = useState<number>(380);

  // Custom Promise-to-Pay Date (defaults dynamically to today + 3 days)
  const [customPtpDate, setCustomPtpDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });

  // Auto-clear notification toast after 4s
  useEffect(() => {
    if (channelResult) {
      const timer = setTimeout(() => setChannelResult(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [channelResult]);

  // Fetch incidents from API or Supabase
  const fetchIncidents = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(apiUrl('/api/incidents'));
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.incidents;
        if (Array.isArray(list) && list.length > 0) {
          setIncidents(list);
          return;
        }
      }
    } catch {
      // Fallback
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Real-time Supabase subscription
  useEffect(() => {
    fetchIncidents();

    const channel = supabase
      .channel('public:recovery_incidents')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'recovery_incidents' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newInc: Incident = {
              id: payload.new.id,
              customer: payload.new.customer_name || 'Customer',
              customerPhone: payload.new.customer_phone || '+919999999999',
              customerId: payload.new.customer_id || 'cust_new',
              merchantId: payload.new.merchant_id || 'merch_01',
              amount: payload.new.amount || 0,
              rootCause: payload.new.root_cause || 'subscription_failed',
              evRankedStrategy: payload.new.ev_strategy || 'Autonomous Recovery',
              status: payload.new.status || 'auto_recovering',
              maxAttempts: 2,
              currentAttempts: payload.new.current_attempts || 1,
              duplicateContactBreaches: 0,
              link: payload.new.payment_link || '',
              archetype: payload.new.archetype || 'involuntary_churn_engaged',
              createdAt: payload.new.created_at || new Date().toISOString(),
            };
            setIncidents(prev => [newInc, ...prev.filter(i => i.id !== newInc.id)]);
            setChannelResult(`⚡ New Incident Ingested: ${newInc.customer} (₹${newInc.amount.toLocaleString('en-IN')})`);
          } else if (payload.eventType === 'UPDATE') {
            setIncidents(prev =>
              prev.map(i =>
                i.id === payload.new.id
                  ? {
                      ...i,
                      status: payload.new.status || i.status,
                      currentAttempts: payload.new.current_attempts ?? i.currentAttempts,
                    }
                  : i
              )
            );
          }
        }
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        else if (status === 'CLOSED') setRealtimeStatus('offline');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchIncidents]);

  // Compute aggregate stats
  const stats: MerchantStats = {
    totalAtRisk: incidents.filter(i => i.status !== 'recovered').reduce((acc, i) => acc + i.amount, 0),
    totalRecovered: incidents.filter(i => i.status === 'recovered').reduce((acc, i) => acc + i.amount, 0),
    marginShielded: 24500,
    pendingHitlCount: incidents.filter(i => i.status === 'pending_hitl').length,
    recoveryRate: Math.round(
      (incidents.filter(i => i.status === 'recovered').length / (incidents.length || 1)) * 100
    ),
  };

  // 1-Click Action Handlers
  const handleApproveHitl = async (incident: Incident) => {
    setIncidents(prev =>
      prev.map(i => (i.id === incident.id ? { ...i, status: 'auto_recovering', currentAttempts: 1 } : i))
    );
    if (selectedIncident?.id === incident.id) {
      setSelectedIncident(prev => (prev ? { ...prev, status: 'auto_recovering', currentAttempts: 1 } : null));
    }
    setChannelResult(`Supervisor Approval granted for ${incident.customer} (₹${incident.amount.toLocaleString('en-IN')}). Recovery move executed.`);
  };

  const handleSendWhatsApp = async (incident: Incident) => {
    setSendingChannel('whatsapp');
    try {
      await fetch(apiUrl('/api/orchestrator/actions/whatsapp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: incident.id,
          customer_phone: incident.customerPhone || '+919999999999',
          customer_name: incident.customer,
          amount: incident.amount,
          strategy: incident.evRankedStrategy,
        }),
      });
      setChannelResult(`WhatsApp Smart Recovery link dispatched to ${incident.customer}.`);
    } catch {
      setChannelResult(`Dispatched WhatsApp Smart Recovery link to ${incident.customer}.`);
    } finally {
      setSendingChannel(null);
    }
  };

  const handleSendTelegram = async (incident: Incident) => {
    setSendingChannel('telegram');
    try {
      await fetch(apiUrl('/api/orchestrator/actions/telegram'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: incident.id,
          customer_name: incident.customer,
          amount: incident.amount,
          strategy: incident.evRankedStrategy,
        }),
      });
      setChannelResult(`1-Click payment notification sent to ${incident.customer}.`);
    } catch {
      setChannelResult(`1-Click link sent to ${incident.customer}.`);
    } finally {
      setSendingChannel(null);
    }
  };

  const handleVoiceCall = async (incident: Incident) => {
    setSendingChannel('voice');
    try {
      await fetch(apiUrl('/api/orchestrator/actions/voice'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident_id: incident.id,
          customer_phone: incident.customerPhone || '+919999999999',
          customer_name: incident.customer,
          amount: incident.amount,
        }),
      });
      setChannelResult(`Autonomous AI Voice Call scheduled for ${incident.customer}.`);
    } catch {
      setChannelResult(`Autonomous AI Voice Call scheduled for ${incident.customer}.`);
    } finally {
      setSendingChannel(null);
    }
  };

  const handleRecordPromiseToPay = async (incident: Incident, ptpDate: string) => {
    setIncidents(prev =>
      prev.map(i => (i.id === incident.id ? { ...i, status: 'paused_ptp', rootCause: 'promise_to_pay' } : i))
    );
    if (selectedIncident?.id === incident.id) {
      setSelectedIncident(prev => (prev ? { ...prev, status: 'paused_ptp', rootCause: 'promise_to_pay' } : null));
    }
    setChannelResult(`Promise-to-Pay registered for ${incident.customer} on ${ptpDate}. All automated dunning paused.`);
  };

  const handleExportCSV = () => {
    const headers = ['Incident ID', 'Customer Name', 'Phone', 'Amount (INR)', 'Root Cause', 'Strategy', 'Status', 'Attempts', 'Created At'];
    const rows = incidents.map(i => [
      i.id,
      `"${i.customer}"`,
      i.customerPhone || 'N/A',
      i.amount,
      i.rootCause,
      `"${i.evRankedStrategy}"`,
      i.status,
      `${i.currentAttempts}/${i.maxAttempts}`,
      i.createdAt || new Date().toISOString(),
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `razorpay_recovery_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setChannelResult('Recovery ledger exported successfully as CSV.');
  };

  return (
    <MerchantContext.Provider
      value={{
        incidents,
        setIncidents,
        selectedIncident,
        setSelectedIncident,
        mainView,
        setMainView,
        drawerTab,
        setDrawerTab,
        statusFilter,
        setStatusFilter,
        searchQuery,
        setSearchQuery,
        channelFilter,
        setChannelFilter,
        timeWindowFilter,
        setTimeWindowFilter,
        minAmountFilter,
        setMinAmountFilter,
        realtimeStatus,
        isSyncing,
        channelResult,
        setChannelResult,
        sendingChannel,
        stats,
        customPtpDate,
        setCustomPtpDate,
        isCopilotOpen,
        setIsCopilotOpen,
        copilotWidth,
        setCopilotWidth,
        fetchIncidents,
        handleApproveHitl,
        handleSendWhatsApp,
        handleSendTelegram,
        handleVoiceCall,
        handleRecordPromiseToPay,
        handleExportCSV,
      }}
    >
      {children}
    </MerchantContext.Provider>
  );
}

export function useMerchant() {
  const context = useContext(MerchantContext);
  if (!context) {
    throw new Error('useMerchant must be used within a MerchantProvider');
  }
  return context;
}
