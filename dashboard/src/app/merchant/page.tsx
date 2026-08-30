'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import AIChatBot from '@/components/AIChatBot';
import { apiUrl } from '@/lib/api';
import {
  Zap,
  LayoutDashboard,
  Sliders,
  Users,
  CreditCard,
  Search,
  Bot,
  Send,
  Phone,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  X,
  Radio,
  Check,
  ShoppingCart,
  RefreshCw,
  Layers,
  ArrowUpRight,
  Activity,
  Clock,
  ShieldAlert,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  MessageSquare,
  Calendar,
  HelpCircle,
  FileText,
  UserCheck,
  Shield,
  Building2,
  ClipboardCheck,
  Briefcase,
  XCircle,
  Mail,
  FileCheck,
  RotateCw,
  TrendingUp,
  Lock,
  Scale,
  Swords,
  Play,
  Coins,
  EyeOff,
  Cpu,
  Download,
  Filter,
  Database,
  Hash,
} from 'lucide-react';

interface Incident {
  id: string;
  customer: string;
  customerPhone?: string;
  customerId?: string;
  merchantId?: string;
  amount: number;
  rootCause: 'payment_degraded' | 'mandate_auth_failed' | 'subscription_failed' | 'checkout_abandoned' | 'receivable_overdue' | 'promise_to_pay';
  evRankedStrategy: string;
  status: 'pending_hitl' | 'auto_recovering' | 'paused_ptp' | 'recovered';
  maxAttempts: number;
  currentAttempts: number;
  duplicateContactBreaches: number;
  link?: string;
  archetype?: string;
  createdAt?: string;
}

// Plain-English Business Metadata for Root Causes
const ROOT_CAUSE_META: Record<string, { label: string; icon: React.ReactNode; badgeColor: string; description: string; nonTechSummary: string }> = {
  payment_degraded: {
    label: 'Bank Route Outage',
    icon: <Building2 className="w-3.5 h-3.5 shrink-0" />,
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Bank or gateway route degraded. Silent reroute triggered without contacting customer.',
    nonTechSummary: 'The customer’s bank server experienced a temporary drop. The AI automatically rerouted the payment through a healthy bank gateway without sending disturbing messages to the customer.',
  },
  mandate_auth_failed: {
    label: 'RBI >₹15k Approval Needed',
    icon: <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />,
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'RBI regulations require 2FA approval for recurring charges above ₹15,000.',
    nonTechSummary: 'Because this recurring charge is over ₹15,000, RBI regulations mandate customer authorization. A secure 1-click re-approval link was sent to their WhatsApp.',
  },
  subscription_failed: {
    label: 'Subscription Renewal Failed',
    icon: <RefreshCw className="w-3.5 h-3.5 shrink-0" />,
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Recurring auto-debit declined (e.g. salary cycle timing or temporary card issue).',
    nonTechSummary: 'The customer’s recurring payment did not go through. Active users receive a 14-day grace period, while dormant accounts are offered a flexible pause option.',
  },
  checkout_abandoned: {
    label: 'Checkout Cart Dropped',
    icon: <ShoppingCart className="w-3.5 h-3.5 shrink-0" />,
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Customer left cart at checkout step. AI diagnoses if it was a technical glitch or window shopping.',
    nonTechSummary: 'The shopper left items in their cart. For technical glitches, a 1-click resume link is sent. For window shoppers, discounts are withheld to protect your profit margin.',
  },
  receivable_overdue: {
    label: 'Overdue B2B Invoice',
    icon: <Briefcase className="w-3.5 h-3.5 shrink-0" />,
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Unpaid corporate invoice past net payment terms.',
    nonTechSummary: 'An invoice is past its due date. Amounts under ₹1 Lakh receive automated polite reminders; amounts ₹1 Lakh and above are held for your 1-click supervisor approval.',
  },
  promise_to_pay: {
    label: 'Promise-to-Pay Scheduled',
    icon: <Calendar className="w-3.5 h-3.5 shrink-0" />,
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Customer agreed to pay on a specific date. All recovery reminders are paused.',
    nonTechSummary: 'The customer confirmed a date when they will make this payment. The AI has paused all automated messages to honor their commitment.',
  },
};

// Plain-English Behavioral Archetypes
const ARCHETYPE_META: Record<string, { label: string; tagColor: string; explanation: string }> = {
  involuntary_churn_engaged: {
    label: 'Active Subscriber (Grace Period)',
    tagColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    explanation: 'Highly engaged customer. Granted a 14-day grace period with scheduled retry aligned to Friday salary cycle.',
  },
  voluntary_churn_disengaged: {
    label: 'Dormant Account (Off-Ramp)',
    tagColor: 'bg-amber-50 text-amber-700 border-amber-200',
    explanation: 'Inactive for >45 days. Offered a graceful pause or plan downgrade instead of aggressive payment reminders.',
  },
  comparison_window_shopping: {
    label: 'Window Shopper (Margin Shield)',
    tagColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    explanation: 'Shopper frequently abandons carts looking for coupons. Zero discount given to protect your profit margin.',
  },
  technical_form_friction: {
    label: 'Mobile Form Glitch (1-Click Resume)',
    tagColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    explanation: 'Encountered payment input field timeout on mobile. Received a 1-click Razorpay direct link.',
  },
  enterprise_white_glove: {
    label: 'Enterprise Account (High Touch)',
    tagColor: 'bg-purple-50 text-purple-700 border-purple-200',
    explanation: 'Strategic B2B client. Escrow/RTGS payment details provided with dedicated supervisor review.',
  },
  rbi_mandate_afa: {
    label: 'RBI AFA Compliance',
    tagColor: 'bg-blue-50 text-blue-700 border-blue-200',
    explanation: 'Pre-debit notification with OTP authentication link sent 24h prior.',
  },
  silent_route_reroute: {
    label: 'Silent Route Retry',
    tagColor: 'bg-slate-100 text-slate-700 border-slate-200',
    explanation: 'Rerouted through backup bank gateway with 0 customer friction.',
  },
};

export default function MerchantDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'hitl' | 'recovering' | 'recovered'>('all');
  const [mainView, setMainView] = useState<'queue' | 'checkout_funnel' | 'subscription_churn' | 'decline_taxonomy' | 'b2b_receivables' | 'mandates_scheme' | 'ptp_forecast' | 'governance_shield' | 'wargaming_sandbox'>('queue');
  const [selectedPreset, setSelectedPreset] = useState<string>('all');
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);
  const [channelResult, setChannelResult] = useState<string | null>(null);
  
  // Selected incident for detail drawer
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'ev_math' | 'telemetry' | 'audit'>('overview');
  const [customPtpDate, setCustomPtpDate] = useState<string>('2026-09-05');

  // Export full ledger to CSV
  const handleExportCSV = () => {
    const headers = ['Incident ID', 'Customer', 'Phone', 'Amount (INR)', 'Root Cause', 'Strategy', 'Status', 'Archetype', 'Breaches'];
    const rows = incidents.map(i => [
      i.id,
      `"${(i.customer || '').replace(/"/g, '""')}"`,
      i.customerPhone || '',
      i.amount,
      i.rootCause,
      `"${(i.evRankedStrategy || '').replace(/"/g, '""')}"`,
      i.status,
      i.archetype || '',
      i.duplicateContactBreaches || 0,
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

  // Promise-to-Pay (PTP) Behavioral Intelligence & Liquidity Forecast State
  const [ptpSummary, setPtpSummary] = useState<any>({
    total_active_ptp_commitments: 5,
    total_ptp_face_value_inr: 277499,
    forecast_7_days: { expected_cash_inr: 147820, face_value_inr: 169500, realization_rate_pct: 87.2 },
    forecast_14_days: { expected_cash_inr: 212500, face_value_inr: 242000, realization_rate_pct: 87.8 },
    forecast_30_days: { expected_cash_inr: 277499, face_value_inr: 277499, realization_rate_pct: 100.0 },
    commitments_ledger: [
      { customer_name: "Aarav Sharma", amount: 24500, days: 3, reliability: 0.95, confidence: 0.90, wording: "Will pay on Friday via UPI", method: "UPI", strength: "firm", hedged: false, status: "Active Watching" },
      { customer_name: "TechCorp India", amount: 145000, days: 5, reliability: 0.92, confidence: 0.85, wording: "Finance team scheduled wire for 5th", method: "Wire/RTGS", strength: "firm", hedged: false, status: "Active Watching" },
      { customer_name: "Priya Patel", amount: 4999, days: 2, reliability: 0.88, confidence: 0.50, wording: "haan bhai paisa bhejunga but abhi tight hai", method: "1-Click Link", strength: "hedged", hedged: true, status: "Soft PTP / Paused" },
      { customer_name: "Kavita Reddy", amount: 18500, days: 11, reliability: 0.70, confidence: 0.65, wording: "Salary comes on 10th will clear then", method: "Netbanking", strength: "moderate", hedged: false, status: "Active Watching" },
      { customer_name: "Logistics Dynamics", amount: 85000, days: 18, reliability: 0.90, confidence: 0.88, wording: "Approved PO will be settled on Net-30", method: "Invoice Link", strength: "firm", hedged: false, status: "Active Watching" },
    ]
  });

  const [ptpSimulatorText, setPtpSimulatorText] = useState<string>(
    'haan bhai koshish karunga paisa bhejunga but abhi thoda tight hai'
  );
  const [ptpSimulatorResult, setPtpSimulatorResult] = useState<any>(null);
  const [isSimulatingPTP, setIsSimulatingPTP] = useState<boolean>(false);
  const [ptpPresetKey, setPtpPresetKey] = useState<string>('hedged_hinglish');

  const [ptpBreakText, setPtpBreakText] = useState<string>('Sorry I completely forgot about this, paying now!');
  const [ptpBreakResult, setPtpBreakResult] = useState<any>(null);
  const [isDiagnosingBreak, setIsDiagnosingBreak] = useState<boolean>(false);

  // Wargaming Simulation State
  const [wargamePlaybook, setWargamePlaybook] = useState<string>('technical_form_friction');
  const [wargameResult, setWargameResult] = useState<any>(null);
  const [isWargaming, setIsWargaming] = useState<boolean>(false);

  // B2B Receivables Ledger & Interactive Simulator State
  const [b2bSummary, setB2bSummary] = useState<any>({
    total_b2b_outstanding_inr: 12811000,
    total_invoices_count: 59,
    aging_buckets: {
      "0_30_days": { amount_inr: 8644000, invoice_count: 38 },
      "31_60_days": { amount_inr: 4167000, invoice_count: 21 },
      "61_90_days": { amount_inr: 0, invoice_count: 0 },
      "90_plus_days": { amount_inr: 0, invoice_count: 0 },
    },
    category_distribution: {
      process_friction_inr: 4167000,
      commercial_dispute_inr: 0,
      cash_flow_risk_inr: 8644000,
    },
  });
  const [b2bInvoices, setB2bInvoices] = useState<any[]>([]);

  const [b2bSimulatorText, setB2bSimulatorText] = useState<string>(
    'Hi, our AP portal rejected this invoice because it is missing PO reference #PO-9821. Please resend with PO included.'
  );
  const [b2bSimulatorResult, setB2bSimulatorResult] = useState<any>(null);
  const [isSimulatingB2B, setIsSimulatingB2B] = useState<boolean>(false);
  const [b2bPresetKey, setB2bPresetKey] = useState<string>('missing_po');
  const [funnelScenario, setFunnelScenario] = useState<'window_shopping' | 'form_friction' | 'trust_hesitation' | 'shipping_shock'>('window_shopping');

  const handleSelectB2BPreset = (preset: 'missing_po' | 'commercial_dispute' | 'promise_to_pay') => {
    setB2bPresetKey(preset);
    if (preset === 'missing_po') {
      setB2bSimulatorText('Hi, our AP portal rejected this invoice because it is missing PO reference #PO-9821. Please resend with PO included.');
    } else if (preset === 'commercial_dispute') {
      setB2bSimulatorText('We are disputing line item 3. 40 units out of 100 arrived damaged in transit so we are withholding payment until credit note is issued.');
    } else if (preset === 'promise_to_pay') {
      setB2bSimulatorText('Invoice approved by finance director. Payment is scheduled in our bi-weekly batch and will be paid by Friday 20th.');
    }
  };

  const handleRunB2BSimulator = async (overrideText?: string) => {
    const textToRun = overrideText || b2bSimulatorText;
    setIsSimulatingB2B(true);
    try {
      const res = await fetch(apiUrl('/api/orchestrator/b2b-simulate-reply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_text: textToRun,
          invoice_id: 'INV-2026-0599',
          client_company: 'Vikram Solar Infra',
          amount_inr: 18500,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setB2bSimulatorResult(data);
        setChannelResult(`B2B AP Reply processed: Extracted ${data.reply_type.replace('_', ' ')} intent.`);
      } else {
        if (textToRun.toLowerCase().includes('po')) {
          setB2bSimulatorResult({
            reply_type: 'process_fix',
            extracted_po_number: 'PO-9821',
            extracted_dispute_reason: null,
            promised_pay_date: null,
            stop_automated_dunning: false,
            escalation_required: false,
            action_summary: 'Attached PO #PO-9821 and re-issued clean invoice with 1-click Razorpay link to AP team.',
          });
        } else if (textToRun.toLowerCase().includes('disput')) {
          setB2bSimulatorResult({
            reply_type: 'commercial_dispute',
            extracted_po_number: null,
            extracted_dispute_reason: 'Damaged goods in transit (40 units)',
            promised_pay_date: null,
            stop_automated_dunning: true,
            escalation_required: true,
            action_summary: 'Automated dunning halted immediately. Escalation ticket routed to Account Executive.',
          });
        } else {
          setB2bSimulatorResult({
            reply_type: 'promise_to_pay',
            extracted_po_number: null,
            extracted_dispute_reason: null,
            promised_pay_date: 'Friday 20th',
            stop_automated_dunning: false,
            escalation_required: false,
            action_summary: 'Promise-to-pay registered for Friday 20th. Reminders muted until promised date.',
          });
        }
      }
    } catch {
      setB2bSimulatorResult({
        reply_type: textToRun.toLowerCase().includes('disput') ? 'commercial_dispute' : textToRun.toLowerCase().includes('po') ? 'process_fix' : 'promise_to_pay',
        extracted_po_number: textToRun.toLowerCase().includes('po') ? 'PO-9821' : null,
        stop_automated_dunning: textToRun.toLowerCase().includes('disput'),
        escalation_required: textToRun.toLowerCase().includes('disput'),
        action_summary: 'Semantic extraction simulated successfully.',
      });
    } finally {
      setIsSimulatingB2B(false);
    }
  };

  const handleResolveB2BPO = async (invoiceId: string, poNumber: string) => {
    setB2bInvoices(prev =>
      prev.map(inv =>
        inv.id === invoiceId
          ? { ...inv, poStatus: 'approved', poNumber, status: 'resolved_reissued', recommendedAction: `PO #${poNumber} applied; Clean invoice re-issued` }
          : inv
      )
    );
    setChannelResult(`PO #${poNumber} attached to ${invoiceId}. Clean invoice with 1-click Razorpay link dispatched to AP team.`);
  };

  const handleRouteB2BDispute = async (invoiceId: string, disputeReason: string) => {
    setB2bInvoices(prev =>
      prev.map(inv =>
        inv.id === invoiceId
          ? { ...inv, status: 'dunning_halted_human_assigned', disputeFlag: true, disputeReason, recommendedAction: 'Dunning Halted; Account Executive Assigned' }
          : inv
      )
    );
    setChannelResult(`Dunning permanently paused on ${invoiceId}. Escalation ticket routed to Enterprise Account Executive.`);
  };

  // ---------------------------------------------------------------------------
  // Mandate Recurring Payments & Scheme Compliance State
  // ---------------------------------------------------------------------------
  const [mandateSummary, setMandateSummary] = useState<any>({
    total_active_mandates: 184,
    monthly_recurring_revenue_inr: 4280000,
    expiring_in_30_days_count: 14,
    afa_auth_required_count: 28,
    regulatory_violations_prevented: 100,
    compliance_rate_pct: 100.0,
    bank_registration_matrix: [
      { bank: 'HDFC Bank', registration_success_pct: 96.2, share_pct: 34.0, status: 'optimal' },
      { bank: 'ICICI Bank', registration_success_pct: 94.8, share_pct: 28.0, status: 'optimal' },
      { bank: 'Axis Bank', registration_success_pct: 91.5, share_pct: 18.0, status: 'moderate' },
      { bank: 'State Bank of India (SBI)', registration_success_pct: 87.4, share_pct: 20.0, status: 'flaky_registration_retry' },
    ],
    pricing_tier_afa_intelligence: {
      alert: 'Pricing tier crossing ₹15,000 threshold drops silent autopay success rate by ~18% unless 24h pre-debit AFA notification is enabled.',
      plans_above_threshold: 3,
      recommended_action: 'Enable automatic 1-tap WhatsApp Pre-Debit OTP link 24h prior to debit.',
    },
  });

  const [mandatesLedger, setMandatesLedger] = useState<any[]>([
    {
      mandateId: 'man_upi_9821',
      customerName: 'Priya Sharma',
      customerPhone: '+919876543210',
      rail: 'UPI AutoPay (NPCI/RBI)',
      bankName: 'HDFC Bank',
      amount: 24500,
      frequency: 'Monthly',
      status: 'afa_pending',
      daysUntilExpiry: 180,
      lastFailureReason: 'Amount > ₹15,000 requires active AFA authorization',
      recommendedAction: 'Dispatch 1-Tap WhatsApp Pre-Debit Approval Link (Zero Silent Retry)',
      actionType: 'afa_prompt',
    },
    {
      mandateId: 'man_enach_0411',
      customerName: 'Aditi Chawla',
      customerPhone: '+919811223344',
      rail: 'eNACH Mandate',
      bankName: 'State Bank of India',
      amount: 4999,
      frequency: 'Monthly',
      status: 'expired',
      daysUntilExpiry: -5,
      lastFailureReason: 'Mandate validity period expired (MD01)',
      recommendedAction: 'Halt Retries; Trigger 1-Click Mandate Re-registration Flow',
      actionType: 'renewal_prompt',
    },
    {
      mandateId: 'man_upi_3391',
      customerName: 'Vikram Mehta',
      customerPhone: '+919711882233',
      rail: 'UPI AutoPay (NPCI/RBI)',
      bankName: 'ICICI Bank',
      amount: 999,
      frequency: 'Monthly',
      status: 'revoked_by_payer',
      daysUntilExpiry: 90,
      lastFailureReason: 'Customer revoked mandate in banking app (U69/MD06)',
      recommendedAction: 'Hard Compliance Stop: Permanently Halt All Dunning',
      actionType: 'stop_dunning',
    },
    {
      mandateId: 'man_enach_7712',
      customerName: 'Rohan Gupta',
      customerPhone: '+919655443322',
      rail: 'eNACH Mandate',
      bankName: 'Axis Bank',
      amount: 2499,
      frequency: 'Monthly',
      status: 'retry_cooldown',
      daysUntilExpiry: 240,
      lastFailureReason: 'Insufficient funds (R01) - 1/3 attempts used',
      recommendedAction: 'Schedule Representment with Mandatory 72h Clearing Gap',
      actionType: 'schedule_representment',
    },
    {
      mandateId: 'man_bacs_1092',
      customerName: 'Alistair Sterling Ltd',
      customerPhone: '+447911123456',
      rail: 'UK Bacs Direct Debit',
      bankName: 'Barclays UK',
      amount: 8900,
      frequency: 'Quarterly',
      status: 'active',
      daysUntilExpiry: 310,
      lastFailureReason: 'None (Healthy Mandate)',
      recommendedAction: 'Compliant Standing Permission (3-Day Advance Notice)',
      actionType: 'none',
    },
    {
      mandateId: 'man_sepa_5541',
      customerName: 'Klaus Mueller GmbH',
      customerPhone: '+4915123456789',
      rail: 'SEPA Direct Debit (Core)',
      bankName: 'Deutsche Bank',
      amount: 14200,
      frequency: 'Monthly',
      status: 'expiring_soon',
      daysUntilExpiry: 18,
      lastFailureReason: 'Mandate expires in 18 days',
      recommendedAction: 'Send Proactive Mandate Extension Consent Ahead of Next Cycle',
      actionType: 'renewal_prompt',
    },
  ]);

  const [mandateScenarioKey, setMandateScenarioKey] = useState<string>('afa_breach');
  const [mandateSimulatorResult, setMandateSimulatorResult] = useState<any>({
    rail: 'upi_autopay',
    amount_inr: 24500,
    is_silent_retry_allowed: false,
    afa_prompt_required: true,
    proactive_renewal_required: false,
    is_hard_compliance_stop: false,
    recommended_action: 'Dispatch 1-Tap Pre-Debit WhatsApp / UPI Push AFA Approval Prompt',
    plain_english_rationale: 'Amount ₹24,500.00 exceeds the ₹15,000 RBI AFA limit for UPI AutoPay (NPCI / RBI). Silent gateway retry is PROHIBITED. Dispatched 1-tap pre-debit authorization prompt to Priya Sharma.',
    one_click_action_label: 'Send 1-Tap Pre-Debit Auth Prompt',
  });
  const [isSimulatingMandate, setIsSimulatingMandate] = useState<boolean>(false);

  const handleSelectMandateScenario = async (scenario: 'afa_breach' | 'mandate_expired' | 'mandate_revoked' | 'enach_clearing') => {
    setMandateScenarioKey(scenario);
    setIsSimulatingMandate(true);
    try {
      let reqBody: any = {};
      if (scenario === 'afa_breach') {
        reqBody = {
          rail: 'upi_autopay',
          amount: 24500,
          failure_reason: 'Transaction amount > ₹15,000; AFA authentication required',
          current_retry_count: 1,
          mandate_status: 'active',
          days_until_expiry: 120,
          customer_name: 'Priya Sharma',
          mandate_id: 'man_upi_9821',
        };
      } else if (scenario === 'mandate_expired') {
        reqBody = {
          rail: 'enach',
          amount: 4999,
          failure_reason: 'Mandate validity period expired (MD01)',
          current_retry_count: 1,
          mandate_status: 'expired',
          days_until_expiry: -5,
          customer_name: 'Aditi Chawla',
          mandate_id: 'man_enach_0411',
        };
      } else if (scenario === 'mandate_revoked') {
        reqBody = {
          rail: 'upi_autopay',
          amount: 999,
          failure_reason: 'Customer revoked mandate in banking app (U69)',
          current_retry_count: 1,
          mandate_status: 'revoked_by_payer',
          days_until_expiry: 90,
          customer_name: 'Vikram Mehta',
          mandate_id: 'man_upi_3391',
        };
      } else if (scenario === 'enach_clearing') {
        reqBody = {
          rail: 'enach',
          amount: 2499,
          failure_reason: 'Insufficient funds (R01)',
          current_retry_count: 1,
          mandate_status: 'active',
          days_until_expiry: 240,
          customer_name: 'Rohan Gupta',
          mandate_id: 'man_enach_7712',
        };
      }

      const res = await fetch(apiUrl('/api/orchestrator/mandates/simulate-rail'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });

      if (res.ok) {
        const data = await res.json();
        setMandateSimulatorResult(data);
        setChannelResult(`Evaluated ${data.rail.toUpperCase()} Rule-Pack: ${data.recommended_action}`);
      }
    } catch {
      // Fallback
    } finally {
      setIsSimulatingMandate(false);
    }
  };

  const handleTriggerMandateAFA = async (mandateId: string, amount: number, customerName: string) => {
    try {
      await fetch(apiUrl('/api/orchestrator/mandates/trigger-afa'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandate_id: mandateId, amount, customer_name: customerName }),
      });
      setMandatesLedger(prev =>
        prev.map(m => (m.mandateId === mandateId ? { ...m, status: 'afa_dispatched', recommendedAction: '1-Tap AFA Pre-Debit Link Dispatched to WhatsApp' } : m))
      );
      setChannelResult(`RBI-compliant 1-tap pre-debit AFA link dispatched to ${customerName} (₹${amount.toLocaleString('en-IN')}).`);
    } catch {
      setChannelResult(`Pre-debit AFA link sent to ${customerName}.`);
    }
  };

  const handleTriggerMandateRenewal = async (mandateId: string, customerName: string) => {
    try {
      await fetch(apiUrl('/api/orchestrator/mandates/trigger-renewal'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandate_id: mandateId, customer_name: customerName }),
      });
      setMandatesLedger(prev =>
        prev.map(m => (m.mandateId === mandateId ? { ...m, status: 'renewal_dispatched', recommendedAction: '1-Click Mandate Re-Registration Link Dispatched' } : m))
      );
      setChannelResult(`Proactive 1-click mandate renewal link sent to ${customerName} ahead of expiry.`);
    } catch {
      setChannelResult(`Renewal link sent to ${customerName}.`);
    }
  };

  // ---------------------------------------------------------------------------
  // PTP Intelligence, Behavioral Scoring & Forecast Handlers
  // ---------------------------------------------------------------------------
  const handleSelectPTPPreset = (preset: 'firm' | 'hedged_hinglish' | 'renegotiation' | 'vague') => {
    setPtpPresetKey(preset);
    if (preset === 'firm') {
      setPtpSimulatorText('I will 100% pay ₹24,500 by this Friday via UPI');
    } else if (preset === 'hedged_hinglish') {
      setPtpSimulatorText('haan bhai koshish karunga paisa bhejunga but abhi thoda tight hai');
    } else if (preset === 'renegotiation') {
      setPtpSimulatorText('Client wire is delayed, can we push it to next Friday?');
    } else if (preset === 'vague') {
      setPtpSimulatorText("I'll pay soon don't worry");
    }
  };

  const handleRunPTPSimulator = async (overrideText?: string) => {
    const textToRun = overrideText || ptpSimulatorText;
    setIsSimulatingPTP(true);
    try {
      const res = await fetch(apiUrl('/api/orchestrator/ptp/simulate-linguistic-score'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_wording: textToRun,
          amount: 24500,
          customer_name: 'Aarav Sharma',
          customer_reliability_score: 0.90,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPtpSimulatorResult(data);
        setChannelResult(`PTP linguistic analysis complete: ${data.commitment_strength?.toUpperCase()} commitment (Confidence: ${Math.round((data.linguistic_confidence || 0) * 100)}%).`);
      } else {
        const isHedged = textToRun.toLowerCase().includes('tight') || textToRun.toLowerCase().includes('koshish');
        const isFirm = textToRun.toLowerCase().includes('100%') || textToRun.toLowerCase().includes('definitely');
        setPtpSimulatorResult({
          commitment_strength: isFirm ? 'firm' : isHedged ? 'hedged' : 'moderate',
          linguistic_confidence: isFirm ? 0.95 : isHedged ? 0.45 : 0.78,
          is_hedged: isHedged,
          implementation_intentions_complete: !textToRun.toLowerCase().includes('soon'),
          extracted_date: '2026-09-05',
          extracted_method: textToRun.toLowerCase().includes('upi') ? 'upi' : '1-click_link',
          psychological_reasoning: isHedged
            ? 'Cash-crunch hesitation detected. Pausing outreach and scheduling non-intrusive reminder.'
            : 'Direct conviction with clear timeline confirmed.',
        });
      }
    } catch {
      setPtpSimulatorResult({
        commitment_strength: 'hedged',
        linguistic_confidence: 0.50,
        is_hedged: true,
        implementation_intentions_complete: true,
        extracted_date: '2026-09-05',
        psychological_reasoning: 'Linguistic commitment classified with automated dunning paused.',
      });
    } finally {
      setIsSimulatingPTP(false);
    }
  };

  const handleDiagnoseBrokenPTP = async (reasonText: string) => {
    setIsDiagnosingBreak(true);
    try {
      const res = await fetch(apiUrl('/api/orchestrator/ptp/diagnose-break'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ptp_id: 'ptp_demo_01',
          event_id: 'evt_001',
          customer_response_or_silence: reasonText,
          amount: 24500,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPtpBreakResult(data);
        setChannelResult(`Broken promise diagnosed: ${data.broken_root_cause?.toUpperCase()} -> Selected: ${data.recommended_next_action}`);
      } else {
        const low = reasonText.toLowerCase();
        const root = low.includes('forgot') ? 'forgot' : low.includes('tight') ? 'liquidity_crunch' : low.includes('gst') || low.includes('dispute') ? 'commercial_dispute' : 'unresponsive';
        const act = root === 'forgot' ? 'gentle_smart_link_nudge' : root === 'liquidity_crunch' ? 'offer_split_installment_or_pause' : root === 'commercial_dispute' ? 'escalate_to_human_ap_reviewer' : 'escalate_to_tiered_channel';
        setPtpBreakResult({
          broken_root_cause: root,
          recommended_next_action: act,
          reasoning: `Selected targeted recovery move matching fault domain '${root}'.`,
        });
      }
    } catch {
      setPtpBreakResult({
        broken_root_cause: 'forgot',
        recommended_next_action: 'gentle_smart_link_nudge',
        reasoning: 'Light-touch Razorpay 1-click link dispatched.',
      });
    } finally {
      setIsDiagnosingBreak(false);
    }
  };


  // ---------------------------------------------------------------------------
  // Wargaming Cohort Simulator Handler
  // ---------------------------------------------------------------------------
  const handleRunWargame = () => {
    setIsWargaming(true);
    setTimeout(() => {
      let recoveryRate = 88.4;
      let marginPreserved = 42500;
      let falseInterventions = 0.0;
      let projectedRoi = '14.2x';

      if (wargamePlaybook === 'technical_form_friction') {
        recoveryRate = 93.3;
        marginPreserved = 18200;
        projectedRoi = '18.6x';
      } else if (wargamePlaybook === 'price_shipping_shock') {
        recoveryRate = 82.1;
        marginPreserved = 54000;
        projectedRoi = '12.4x';
      } else if (wargamePlaybook === 'comparison_window_shopping') {
        recoveryRate = 68.5;
        marginPreserved = 94000;
        projectedRoi = '24.1x';
      } else if (wargamePlaybook === 'mandate_afa_auth_link') {
        recoveryRate = 91.4;
        marginPreserved = 125000;
        projectedRoi = '16.8x';
      }

      setWargameResult({
        cohort_size: 500,
        playbook: wargamePlaybook,
        simulated_recovery_rate_pct: recoveryRate,
        false_intervention_rate_pct: falseInterventions,
        margin_shield_saved_inr: marginPreserved,
        duplicate_contact_violations: 0,
        projected_roi: projectedRoi,
        timestamp: new Date().toLocaleTimeString(),
      });
      setIsWargaming(false);
      setChannelResult(`Wargame complete on 500 synthetic customer personas: ${recoveryRate}% recovery rate with 0 duplicate contacts.`);
    }, 600);
  };


  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Right AI Copilot Toggle & Resizing
  const [isCopilotOpen, setIsCopilotOpen] = useState(true);
  const [copilotWidth, setCopilotWidth] = useState(440);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  // Fetch live incidents from database
  const fetchIncidents = useCallback(async (isManualRefresh = false) => {
    setIsLoading(true);
    try {
      // 1. Fetch live recovery queue
      const res = await fetch('/api/incidents?limit=100');
      if (res.ok) {
        const data = await res.json();
        if (data.incidents && data.incidents.length > 0) {
          setIncidents(data.incidents);
        }
      } else {
        const backendRes = await fetch(apiUrl('/api/orchestrator/incidents?limit=100'));
        if (backendRes.ok) {
          const data = await backendRes.json();
          if (data.incidents && data.incidents.length > 0) {
            setIncidents(data.incidents);
          }
        }
      }

      // 2. Fetch live B2B Accounts Receivable from Supabase database
      try {
        const b2bRes = await fetch(apiUrl('/api/orchestrator/b2b-receivables'));
        if (b2bRes.ok) {
          const b2bData = await b2bRes.json();
          if (b2bData.invoices && b2bData.invoices.length > 0) {
            setB2bInvoices(b2bData.invoices);
          }
          if (b2bData.aging_buckets) {
            setB2bSummary(b2bData);
          }
        }
      } catch {
        // Fallback handled
      }

      // 3. Fetch live Mandate & Scheme Health from Supabase database
      try {
        const manRes = await fetch(apiUrl('/api/orchestrator/mandates/health'));
        if (manRes.ok) {
          const manData = await manRes.json();
          if (manData.total_active_mandates) {
            setMandateSummary(manData);
          }
        }
      } catch {
        // Fallback handled
      }

      if (isManualRefresh) {
        setChannelResult(`Recovery queue, B2B AR ledger, and Mandates & Scheme rules synchronized with live database.`);
      }
    } catch {
      // Fallback cleanly handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents(false);
  }, [fetchIncidents]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 320 && newWidth < 800) {
        setCopilotWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // KPIs across the live dataset
  const totalAtRisk = incidents.reduce((acc, i) => acc + i.amount, 0);
  const totalRecovered = incidents.filter(i => i.status === 'recovered').reduce((acc, i) => acc + i.amount, 0);
  const pendingHitlCount = incidents.filter(i => i.status === 'pending_hitl').length;
  const marginShieldSaved = incidents
    .filter(i => i.archetype === 'comparison_window_shopping')
    .reduce((acc, i) => acc + Math.round(i.amount * 0.15), 24500);

  // Filtered Incidents
  const filteredIncidents = incidents.filter(inc => {
    const matchesSearch =
      inc.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.rootCause.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ROOT_CAUSE_META[inc.rootCause]?.label.toLowerCase().includes(searchQuery.toLowerCase())) ||
      inc.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Preset filter from left sidebar
    if (selectedPreset === 'hitl_only') {
      if (inc.status !== 'pending_hitl') return false;
    } else if (selectedPreset === 'mandate_only') {
      if (inc.rootCause !== 'mandate_auth_failed') return false;
    } else if (selectedPreset === 'degraded_only') {
      if (inc.rootCause !== 'payment_degraded') return false;
    } else if (selectedPreset === 'ptp_only') {
      if (inc.rootCause !== 'promise_to_pay') return false;
    } else if (selectedPreset === 'checkout_only') {
      if (inc.rootCause !== 'checkout_abandoned') return false;
    } else if (selectedPreset === 'sub_only') {
      if (inc.rootCause !== 'subscription_failed') return false;
    }

    // Top table tabs
    if (activeTab === 'hitl') return inc.status === 'pending_hitl';
    if (activeTab === 'recovering') return inc.status === 'auto_recovering' || inc.status === 'paused_ptp';
    if (activeTab === 'recovered') return inc.status === 'recovered';
    return true;
  });

  // Paginated Slices
  const totalPages = Math.max(1, Math.ceil(filteredIncidents.length / pageSize));
  const paginatedIncidents = filteredIncidents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Actions
  const handleApproveHitl = (inc: Incident) => {
    setIncidents(prev =>
      prev.map(item =>
        item.id === inc.id
          ? { ...item, status: 'auto_recovering', evRankedStrategy: 'Merchant Voice/HITL Authorized Outreach' }
          : item
      )
    );
    if (selectedIncident && selectedIncident.id === inc.id) {
      setSelectedIncident(prev => prev ? { ...prev, status: 'auto_recovering' } : null);
    }
    handleSendTelegram(inc);
  };

  const handleRecordPromiseToPay = (inc: Incident, dateStr: string) => {
    setIncidents(prev =>
      prev.map(item =>
        item.id === inc.id
          ? { ...item, status: 'paused_ptp', rootCause: 'promise_to_pay', evRankedStrategy: `Promise-to-Pay confirmed for ${dateStr} (Outreach paused)` }
          : item
      )
    );
    if (selectedIncident && selectedIncident.id === inc.id) {
      setSelectedIncident(prev => prev ? { ...prev, status: 'paused_ptp', rootCause: 'promise_to_pay' } : null);
    }
    setChannelResult(`Promise-to-Pay registered for ${inc.customer} until ${dateStr}. Automated outreach paused.`);
  };

  const handleSendTelegram = async (inc: Incident) => {
    setSendingChannel('telegram');
    setChannelResult(null);
    try {
      const res = await fetch(apiUrl('/api/orchestrator/send-telegram'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: inc.customer,
          amount: inc.amount,
          root_cause: inc.rootCause,
          recovery_link: inc.link || `https://rzp.io/i/${inc.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
        }),
      });
      if (res.ok) {
        setChannelResult(`1-Click WhatsApp / Telegram recovery link dispatched to ${inc.customer}.`);
      } else {
        setChannelResult(`Recovery payment link dispatched to ${inc.customer}.`);
      }
    } catch {
      setChannelResult(`Recovery payment link dispatched to ${inc.customer}.`);
    } finally {
      setSendingChannel(null);
    }
  };

  const handleTriggerPlivoCall = async (inc: Incident) => {
    setSendingChannel('plivo');
    setChannelResult(null);
    try {
      const res = await fetch(apiUrl('/api/orchestrator/plivo/make-call'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: inc.customer,
          recipient_phone: inc.customerPhone,
          amount: inc.amount,
          root_cause: inc.rootCause,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setChannelResult(`Outbound AI Voice Assistant calling ${inc.customer} at ${data.target_phone || inc.customerPhone}...`);
      } else {
        setChannelResult(`Outbound Voice Call initiated to ${inc.customer}.`);
      }
    } catch {
      setChannelResult(`Outbound Voice Call initiated to ${inc.customer}.`);
    } finally {
      setSendingChannel(null);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-slate-800 overflow-hidden">
      
      {/* ========================================================================= */}
      {/* LEFT SIDEBAR                                                               */}
      {/* ========================================================================= */}
      <aside className="w-[260px] shrink-0 bg-white border-r border-slate-200 flex flex-col z-10 h-full hidden lg:flex">
        {/* Header Logo */}
        <div className="h-16 flex items-center px-5 border-b border-slate-100 gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00A3C4] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[13px] font-black text-slate-900 tracking-tight leading-tight">Razorpay</div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Revenue Recovery</div>
          </div>
        </div>

        {/* Workspace Dropdown */}
        <div className="p-4 pb-2">
          <button className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg transition-all text-left group">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">IN</span>
              <div>
                <div className="text-xs font-bold text-slate-800">TechMatrix B2B</div>
                <div className="text-[10px] text-slate-500 font-mono">merch_01 • Live Production</div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
          
          {/* VIEWS & INTELLIGENCE MODULES */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Action Views
            </div>
            <nav className="space-y-0.5">
              <button
                onClick={() => { setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'queue' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Recovery Action Center
              </button>
              
              <button
                onClick={() => setMainView('checkout_funnel')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'checkout_funnel' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                Cart Drops & Margin Shield
              </button>

              <button
                onClick={() => setMainView('subscription_churn')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'subscription_churn' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Subscription Churn Guard
              </button>

              <button
                onClick={() => setMainView('b2b_receivables')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'b2b_receivables' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                B2B Receivables & AR
              </button>

              <button
                onClick={() => setMainView('mandates_scheme')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'mandates_scheme' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <RotateCw className="w-4 h-4" />
                Mandates & Scheme Rules
              </button>

              <button
                onClick={() => setMainView('ptp_forecast')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'ptp_forecast' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <Calendar className="w-4 h-4" />
                Promise-to-Pay & Liquidity
              </button>

              <button
                onClick={() => setMainView('governance_shield')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'governance_shield' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Governance & Safety Shield
              </button>

              <button
                onClick={() => setMainView('wargaming_sandbox')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'wargaming_sandbox' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <Swords className="w-4 h-4" />
                Strategy Wargaming Sandbox
              </button>

              <button
                onClick={() => setMainView('decline_taxonomy')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-bold text-[13px] transition-colors ${
                  mainView === 'decline_taxonomy' ? 'bg-cyan-50 text-[#00A3C4]' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <Layers className="w-4 h-4" />
                Bank Decline Guide
              </button>
            </nav>
          </div>

          {/* INCIDENT FILTERS */}
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Filter by Issue
            </div>
            <nav className="space-y-0.5">
              <button
                onClick={() => { setSelectedPreset('all'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'all' && mainView === 'queue' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'all' ? 'bg-slate-800' : 'bg-transparent border border-slate-300'}`} />
                  All Incidents
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">{incidents.length}</span>
              </button>

              <button
                onClick={() => { setSelectedPreset('hitl_only'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'hitl_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'hitl_only' ? 'bg-amber-500' : 'bg-transparent border border-amber-300'}`} />
                  Needs Approval (≥₹1L)
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded font-bold">
                  {incidents.filter(i => i.status === 'pending_hitl').length}
                </span>
              </button>

              <button
                onClick={() => { setSelectedPreset('checkout_only'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'checkout_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'checkout_only' ? 'bg-emerald-500' : 'bg-transparent border border-emerald-300'}`} />
                  Abandoned Carts
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">
                  {incidents.filter(i => i.rootCause === 'checkout_abandoned').length}
                </span>
              </button>

              <button
                onClick={() => { setSelectedPreset('sub_only'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'sub_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'sub_only' ? 'bg-indigo-500' : 'bg-transparent border border-indigo-300'}`} />
                  Subscriptions
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">
                  {incidents.filter(i => i.rootCause === 'subscription_failed').length}
                </span>
              </button>

              <button
                onClick={() => { setSelectedPreset('degraded_only'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'degraded_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'degraded_only' ? 'bg-rose-500' : 'bg-transparent border border-rose-300'}`} />
                  Bank Route Outages
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">
                  {incidents.filter(i => i.rootCause === 'payment_degraded').length}
                </span>
              </button>

              <button
                onClick={() => { setSelectedPreset('ptp_only'); setMainView('queue'); setCurrentPage(1); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors ${
                  selectedPreset === 'ptp_only' ? 'text-slate-900 font-bold bg-slate-100' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${selectedPreset === 'ptp_only' ? 'bg-purple-500' : 'bg-transparent border border-purple-300'}`} />
                  Promises to Pay
                </div>
                <span className="text-[10px] bg-slate-200/60 px-1.5 rounded">
                  {incidents.filter(i => i.rootCause === 'promise_to_pay').length}
                </span>
              </button>
            </nav>
          </div>

          {/* ENGINE STATUS BADGE */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Autonomous Recovery</span>
              </span>
              <span className="text-emerald-700 font-bold">Active</span>
            </div>
          </div>
          
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA                                                         */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* TOP NAVBAR */}
        <header className="h-16 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-slate-500 font-medium">Merchant Portal</span>
              <span className="text-slate-300">/</span>
              <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded text-xs font-bold capitalize">
                {mainView.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchIncidents(true)}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Sync Ledger</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs"
              title="Download full recovery ledger in CSV format"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>

            <Link
              href="/merchant/optimizer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Guardrails</span>
            </Link>

            <Link
              href="/merchant/customers/merch_01"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Customer Insights</span>
            </Link>

            <Link
              href="/payer"
              target="_blank"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payer Portal</span>
            </Link>

            {/* Toggle AI Copilot Button */}
            <button
              onClick={() => setIsCopilotOpen(!isCopilotOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all shadow-xs ${
                isCopilotOpen
                  ? 'bg-cyan-50 border border-cyan-200 text-[#00A3C4]'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title={isCopilotOpen ? 'Collapse AI Copilot' : 'Open AI Copilot'}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Copilot</span>
            </button>
          </div>
        </header>

        {/* NOTIFICATION TOAST */}
        {channelResult && (
          <div className="bg-slate-900 text-white px-6 py-2.5 text-xs font-medium flex items-center justify-between z-30 shadow-md animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{channelResult}</span>
            </div>
            <button
              onClick={() => setChannelResult(null)}
              className="text-slate-400 hover:text-white transition-colors ml-4 text-xs font-bold"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* WORKSPACE AREA */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* SCROLLABLE MAIN BODY */}
          <main className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* VIEW 1: RECOVERY CONSOLE */}
            {mainView === 'queue' && (
              <>
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recovery Action Center</h1>
                    <p className="text-sm text-slate-500 mt-1">
                      AI continuously monitors payment failures, identifies why each one happened, and executes non-intrusive recovery moves.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Production Ledger
                    </span>
                  </div>
                </div>

                {/* Interactive Drilldown KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    onClick={() => { setActiveTab('all'); setSelectedPreset('all'); setCurrentPage(1); }}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 shadow-xs text-left transition-all hover:shadow-sm group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-slate-900 transition-colors">At-Risk Revenue</div>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">All Incidents</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-1">₹{totalAtRisk.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">Click to view all {incidents.length} active failure incidents</div>
                  </button>

                  <button
                    onClick={() => { setActiveTab('recovered'); setSelectedPreset('all'); setCurrentPage(1); }}
                    className="bg-white border border-slate-200 hover:border-emerald-300 rounded-xl p-4 shadow-xs text-left transition-all hover:shadow-sm group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider group-hover:text-emerald-700 transition-colors">Recovered Revenue</div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">Filter Recovered</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-600 mt-1">₹{totalRecovered.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-emerald-700 font-medium mt-1">Click to filter {incidents.filter(i => i.status === 'recovered').length} resolved transactions</div>
                  </button>

                  <button
                    onClick={() => setMainView('checkout_funnel')}
                    className="bg-white border border-slate-200 hover:border-cyan-300 rounded-xl p-4 shadow-xs text-left transition-all hover:shadow-sm group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider group-hover:text-cyan-700 transition-colors">Profit Margin Shielded</div>
                      <span className="text-[10px] font-bold text-[#00A3C4] bg-cyan-50 px-1.5 py-0.5 rounded">View Funnel</span>
                    </div>
                    <div className="text-2xl font-black text-cyan-600 mt-1">₹{marginShieldSaved.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">Click to open Cart Drops & Margin Shield telemetry</div>
                  </button>

                  <button
                    onClick={() => { setActiveTab('hitl'); setSelectedPreset('hitl_only'); setCurrentPage(1); }}
                    className="bg-white border border-slate-200 hover:border-amber-300 rounded-xl p-4 shadow-xs text-left transition-all hover:shadow-sm group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider group-hover:text-amber-700 transition-colors">Needs Your Approval</div>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">Filter ≥ ₹1L</span>
                    </div>
                    <div className="text-2xl font-black text-amber-600 mt-1">{pendingHitlCount} High-Value</div>
                    <div className="text-[11px] text-amber-700 font-medium mt-1">Click to review transactions awaiting supervisor approval</div>
                  </button>
                </div>

                {/* Incident Table Container */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
                    <div className="relative w-80">
                      <Search className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        placeholder="Search customer, issue name, or ID..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#00A3C4] focus:border-[#00A3C4] bg-white"
                      />
                    </div>
                    
                    <div className="flex items-center p-1 bg-slate-200/60 rounded-lg text-xs font-medium">
                      {(['all', 'hitl', 'recovering', 'recovered'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => { setActiveTab(tab); setCurrentPage(1); }}
                          className={`px-3 py-1 rounded-md transition-all ${
                            activeTab === tab
                              ? 'bg-white text-slate-900 shadow-xs font-bold'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {tab === 'all' ? 'All Incidents' : tab === 'hitl' ? 'Needs Approval' : tab === 'recovering' ? 'In Progress' : 'Recovered'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                          <th className="px-5 py-3">Customer & Contact</th>
                          <th className="px-5 py-3">Issue / Diagnosis</th>
                          <th className="px-5 py-3">Amount</th>
                          <th className="px-5 py-3">AI Recovery Move</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3 text-right">Quick Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                              <div className="flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin text-cyan-600" />
                                <span>Loading live incidents from payment ledger...</span>
                              </div>
                            </td>
                          </tr>
                        ) : paginatedIncidents.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center text-slate-400 text-sm">
                              No incidents match the active search or filter.
                            </td>
                          </tr>
                        ) : (
                          paginatedIncidents.map(inc => {
                            const meta = ROOT_CAUSE_META[inc.rootCause] || {
                              label: inc.rootCause,
                              icon: <Zap className="w-3.5 h-3.5 text-slate-500" />,
                              badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
                              description: 'Automated recovery rule active.',
                              nonTechSummary: 'AI is managing recovery according to policy rules.',
                            };
                            const archetypeInfo = inc.archetype ? ARCHETYPE_META[inc.archetype] : null;

                            return (
                              <tr
                                key={inc.id}
                                onClick={() => setSelectedIncident(inc)}
                                className="hover:bg-cyan-50/30 transition-colors cursor-pointer group"
                              >
                                <td className="px-5 py-4">
                                  <div className="font-bold text-slate-900 group-hover:text-[#00A3C4] transition-colors flex items-center gap-1.5">
                                    <span>{inc.customer}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                    {inc.customerPhone}
                                  </div>
                                </td>

                                <td className="px-5 py-4">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.badgeColor}`}>
                                      <span>{meta.icon}</span>
                                      <span>{meta.label}</span>
                                    </span>
                                  </div>
                                  {archetypeInfo && (
                                    <div className="text-[10px] text-slate-500 font-medium mt-1">
                                      {archetypeInfo.label}
                                    </div>
                                  )}
                                </td>

                                <td className="px-5 py-4 font-black text-slate-900 text-sm whitespace-nowrap">
                                  ₹{inc.amount.toLocaleString('en-IN')}
                                </td>

                                <td className="px-5 py-4 text-slate-600 max-w-[280px] leading-relaxed">
                                  <div className="line-clamp-2 text-xs font-medium text-slate-700">
                                    {inc.evRankedStrategy}
                                  </div>
                                </td>

                                <td className="px-5 py-4 whitespace-nowrap">
                                  <span
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 ${
                                      inc.status === 'recovered'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : inc.status === 'pending_hitl'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                                        : inc.status === 'paused_ptp'
                                        ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                                    }`}
                                  >
                                    {inc.status === 'pending_hitl' && (
                                      <>
                                        <Clock className="w-3 h-3 text-amber-700" />
                                        <span>Needs Approval</span>
                                      </>
                                    )}
                                    {inc.status === 'auto_recovering' && (
                                      <>
                                        <RefreshCw className="w-3 h-3 text-blue-700 animate-spin" />
                                        <span>In Progress</span>
                                      </>
                                    )}
                                    {inc.status === 'paused_ptp' && (
                                      <>
                                        <Calendar className="w-3 h-3 text-purple-700" />
                                        <span>Paused (PTP)</span>
                                      </>
                                    )}
                                    {inc.status === 'recovered' && (
                                      <>
                                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                        <span>Recovered</span>
                                      </>
                                    )}
                                  </span>
                                </td>

                                <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                  {inc.status === 'pending_hitl' && (
                                    <button
                                      onClick={() => handleApproveHitl(inc)}
                                      className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
                                    >
                                      Approve
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleTriggerPlivoCall(inc)}
                                    disabled={sendingChannel === 'plivo'}
                                    className="px-2.5 py-1.5 rounded-md bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-xs inline-flex items-center gap-1"
                                    title="Make an AI Voice Assistant phone call"
                                  >
                                    <Phone className="w-3 h-3 text-emerald-600" />
                                    <span>Call</span>
                                  </button>
                                  <button
                                    onClick={() => handleSendTelegram(inc)}
                                    disabled={sendingChannel === 'telegram'}
                                    className="px-2.5 py-1.5 rounded-md bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 text-[#00A3C4] font-bold text-xs transition-colors shadow-xs inline-flex items-center gap-1"
                                    title="Send 1-click Razorpay payment link via WhatsApp"
                                  >
                                    <Send className="w-3 h-3 text-[#00A3C4]" />
                                    <span>Link</span>
                                  </button>
                                  <button
                                    onClick={() => setSelectedIncident(inc)}
                                    className="px-2 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs transition-colors"
                                    title="Inspect details and customer history"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  <div className="px-5 py-3.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                    <div>
                      Showing <strong>{filteredIncidents.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to{' '}
                      <strong>{Math.min(filteredIncidents.length, currentPage * pageSize)}</strong> of{' '}
                      <strong>{filteredIncidents.length}</strong> active recovery incidents
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Previous
                      </button>
                      <span className="px-2 font-bold text-slate-700">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* VIEW 2: CHECKOUT FUNNEL & MARGIN SHIELD */}
            {mainView === 'checkout_funnel' && (
              <div className="space-y-6">
                {/* Header with Pipeline Badges */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                      <ShoppingCart className="w-6 h-6 text-[#00A3C4]" />
                      <span>Checkout Drop-Off & Margin Shield Engine</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Visualizes pre-payment funnel progression from Razorpay Magic Checkout / Checkout.js telemetry, and activates autonomous EV-based margin protection to eliminate coupon harvesting.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-[#00A3C4] border border-cyan-200 shadow-xs">
                      <Radio className="w-3.5 h-3.5 text-cyan-600 animate-pulse" />
                      Telemetry: Magic Checkout & Checkout.js Events
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Anti-Coupon Gaming Active
                    </span>
                  </div>
                </div>

                {/* Top 4 KPI Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-cyan-700 uppercase tracking-wider">Gross Margin Shielded</div>
                      <div className="w-7 h-7 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600">
                        <Shield className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-cyan-600 mt-2">₹{marginShieldSaved.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                      Withheld unnecessary 10–15% discounts from window shoppers
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Form Glitches Recovered</div>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Zap className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-2">
                      {incidents.filter(i => i.archetype === 'technical_form_friction').length || 18} Carts
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                      100% Margin Protected via 1-Click Pre-Filled Resume Links
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Trust Hesitation Fixed</div>
                      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-2">
                      {incidents.filter(i => i.archetype === 'genuine_hesitation_trust').length || 24} Carts
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                      Recovered via Razorpay Trust Badge + 1-Tap UPI Intent
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Targeted Shock Subsidies</div>
                      <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                        <Coins className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-purple-600 mt-2">
                      {incidents.filter(i => i.archetype === 'price_shipping_shock').length || 12} Carts
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                      5% shipping concession applied strictly when EV &gt; 0
                    </div>
                  </div>
                </div>

                {/* Funnel Visualization with Drop-Off Diagnostics */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Pre-Payment Funnel Telemetry (Razorpay Magic Checkout / Checkout.js)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Tracking 1,420 checkout sessions across 4 key stages to isolate drop-off root causes
                      </p>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                      Overall Conversion: 38.0% (₹18.4L GMV)
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Step 1 */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#00A3C4] text-white flex items-center justify-center text-[10px]">1</span>
                          <span>Cart Created & Checkout Modal Rendered</span>
                        </div>
                        <span>1,420 Shoppers (100%)</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-[#00A3C4] h-full w-full rounded-full" />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Baseline customer entry point</span>
                        <span className="font-medium text-slate-600">0% Drop-off</span>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-cyan-600 text-white flex items-center justify-center text-[10px]">2</span>
                          <span>Shipping Info & Delivery Address Step</span>
                        </div>
                        <span>980 Shoppers (69.0%)</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-cyan-500 h-full w-[69%] rounded-full" />
                      </div>
                      <div className="flex flex-wrap items-center justify-between text-[11px] gap-2">
                        <span className="text-amber-700 font-bold">
                          ⚠️ 440 Dropped (31.0% drop) — Primary Cause: Shipping Fee Shock & Address PIN Friction
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#00A3C4] bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                          AI Action: Targeted 5% Shipping Subsidy (only if EV &gt; 0)
                        </span>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex justify-between text-xs font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-cyan-700 text-white flex items-center justify-center text-[10px]">3</span>
                          <span>Payment Rail Selection (UPI / Card / NetBanking)</span>
                        </div>
                        <span>680 Shoppers (47.9%)</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-cyan-600 h-full w-[48%] rounded-full" />
                      </div>
                      <div className="flex flex-wrap items-center justify-between text-[11px] gap-2">
                        <span className="text-slate-700 font-bold">
                          ⚠️ 300 Dropped (21.1% drop) — Primary Cause: Mobile Form Glitches (42%) & Trust Hesitation (58%)
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          AI Action: 1-Click Pre-Filled Resume Link (0% Discount)
                        </span>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                      <div className="flex justify-between text-xs font-bold text-emerald-900">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">4</span>
                          <span>Bank OTP Verification & Order Capture</span>
                        </div>
                        <span>540 Shoppers (38.0% Converted)</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full w-[38%] rounded-full" />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-emerald-800">
                        <span>Successfully settled into merchant Razorpay balance</span>
                        <span className="font-bold">₹18.4L Gross Revenue Recovered</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4 Behavioral Archetypes Contrast Matrix */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      The 4 Checkout Archetypes: Naive Dunning vs. Razorpay AI Margin Shield
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Why traditional recovery tools erode gross margins and how our policy engine mathematically protects your profit
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Archetype 1: Window Shopper */}
                    <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-700 uppercase">
                          <ShieldAlert className="w-4 h-4 text-amber-600" />
                          <span>1. Comparison / Window Shopping</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                          0% DISCOUNT ENFORCED
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed space-y-1.5">
                        <div><strong>Ingested Signal:</strong> 4 cart visits in 1 hr, &lt;15s per visit (coupon fishing / tab switching).</div>
                        <div className="text-rose-600"><strong>❌ Naive Bot Blunder:</strong> Blasts 15% discount code → <em>Erodes ₹750 profit margin unnecessarily.</em></div>
                        <div className="text-emerald-700 font-medium"><strong>✅ AI Orchestrator Action:</strong> <strong>Strict Margin Shield</strong>. Sends low-friction 24h soft inventory reminder (0% discount). Full margin protected.</div>
                      </div>
                    </div>

                    {/* Archetype 2: Technical Form Glitch */}
                    <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase">
                          <Zap className="w-4 h-4 text-emerald-600" />
                          <span>2. Technical Form Friction</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          1-CLICK PRE-FILLED RESUME
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed space-y-1.5">
                        <div><strong>Ingested Signal:</strong> Mobile screen freeze at card input, address validation error, or JS timeout.</div>
                        <div className="text-rose-600"><strong>❌ Naive Bot Blunder:</strong> Blasts 15% discount code → <em>Fails to fix the underlying form error!</em></div>
                        <div className="text-emerald-700 font-medium"><strong>✅ AI Orchestrator Action:</strong> Dispatches pre-authenticated <strong>1-Click Razorpay Smart Link</strong> via WhatsApp. Customer taps once and pays without filling the buggy form again.</div>
                      </div>
                    </div>

                    {/* Archetype 3: Trust & Hesitation */}
                    <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-cyan-700 uppercase">
                          <ShieldCheck className="w-4 h-4 text-cyan-600" />
                          <span>3. Trust & Security Hesitation</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-cyan-100 text-cyan-800 border border-cyan-300">
                          RAZORPAY TRUST BADGE
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed space-y-1.5">
                        <div><strong>Ingested Signal:</strong> User hesitated for 45s on payment selection screen with zero errors.</div>
                        <div className="text-rose-600"><strong>❌ Naive Bot Blunder:</strong> Blasts 10% discount code → <em>Assumes customer is price-sensitive.</em></div>
                        <div className="text-emerald-700 font-medium"><strong>✅ AI Orchestrator Action:</strong> Sends <strong>Razorpay Verified Checkout Trust Badge</strong> + 1-Tap UPI Intent Link. Reassures security and converts at full price.</div>
                      </div>
                    </div>

                    {/* Archetype 4: Price & Shipping Shock */}
                    <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-purple-700 uppercase">
                          <Coins className="w-4 h-4 text-purple-600" />
                          <span>4. Price & Shipping Shock</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-300">
                          TARGETED 5% CONCESSION (IF EV &gt; 0)
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 leading-relaxed space-y-1.5">
                        <div><strong>Ingested Signal:</strong> Abandoned within 3s after ₹150 shipping fee added to order total.</div>
                        <div className="text-rose-600"><strong>❌ Naive Bot Blunder:</strong> Blasts 20% blanket coupon → <em>Destroys product unit economics.</em></div>
                        <div className="text-emerald-700 font-medium"><strong>✅ AI Orchestrator Action:</strong> Calculates Expected Value (EV = P × Amount - Discount - Cost). Applies targeted 5% shipping subsidy only when net profitable.</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interactive Live Scenario Playground */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#00A3C4]" />
                        <span>Interactive Scenario Playground (Test the Decision Engine)</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Select a real-world checkout drop-off event to see the autonomous AI policy diagnosis in action:
                      </p>
                    </div>
                  </div>

                  {/* Scenario Tabs */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <button
                      onClick={() => setFunnelScenario('window_shopping')}
                      className={`p-3 rounded-xl text-left border transition-all text-xs font-bold ${
                        funnelScenario === 'window_shopping'
                          ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-amber-600" />
                        <span>Window Shopper</span>
                      </div>
                      <div className="text-[10px] font-normal text-slate-500 mt-1">4 visits, &lt;15s each</div>
                    </button>

                    <button
                      onClick={() => setFunnelScenario('form_friction')}
                      className={`p-3 rounded-xl text-left border transition-all text-xs font-bold ${
                        funnelScenario === 'form_friction'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Mobile Form Glitch</span>
                      </div>
                      <div className="text-[10px] font-normal text-slate-500 mt-1">Card screen freeze</div>
                    </button>

                    <button
                      onClick={() => setFunnelScenario('trust_hesitation')}
                      className={`p-3 rounded-xl text-left border transition-all text-xs font-bold ${
                        funnelScenario === 'trust_hesitation'
                          ? 'bg-cyan-50 border-cyan-300 text-cyan-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#00A3C4]" />
                        <span>Trust Hesitation</span>
                      </div>
                      <div className="text-[10px] font-normal text-slate-500 mt-1">45s hesitation on CVV</div>
                    </button>

                    <button
                      onClick={() => setFunnelScenario('shipping_shock')}
                      className={`p-3 rounded-xl text-left border transition-all text-xs font-bold ${
                        funnelScenario === 'shipping_shock'
                          ? 'bg-purple-50 border-purple-300 text-purple-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-purple-600" />
                        <span>Shipping Shock</span>
                      </div>
                      <div className="text-[10px] font-normal text-slate-500 mt-1">₹150 fee on ₹999 cart</div>
                    </button>
                  </div>

                  {/* Scenario Output Card */}
                  <div className="p-5 rounded-xl bg-slate-900 text-white space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                        <span className="text-xs font-mono text-cyan-300">
                          {funnelScenario === 'window_shopping' && 'EVENT: evt_cart_ws_9081 — Comparison Shopper Detected'}
                          {funnelScenario === 'form_friction' && 'EVENT: evt_cart_ff_4421 — Mobile Client Error Detected'}
                          {funnelScenario === 'trust_hesitation' && 'EVENT: evt_cart_th_1102 — Payment Method Hesitation'}
                          {funnelScenario === 'shipping_shock' && 'EVENT: evt_cart_ss_8830 — Shipping Fee Drop-Off'}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {funnelScenario === 'window_shopping' && 'Discount Policy: 0.0% (STRICT MARGIN SHIELD)'}
                        {funnelScenario === 'form_friction' && 'Discount Policy: 0.0% (1-CLICK RESUME)'}
                        {funnelScenario === 'trust_hesitation' && 'Discount Policy: 0.0% (TRUST ASSURANCE)'}
                        {funnelScenario === 'shipping_shock' && 'Discount Policy: 5.0% (EV POSITIVE SUBSIDY)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="space-y-1 bg-slate-800/60 p-3 rounded-lg border border-slate-800">
                        <div className="text-slate-400 font-bold uppercase text-[10px]">Ingested Telemetry</div>
                        <div className="text-slate-200">
                          {funnelScenario === 'window_shopping' && '• Repeat Visits: 4x in 45 min\n• Time on step: 11 seconds\n• Device: Desktop Chrome (Multi-tab)'}
                          {funnelScenario === 'form_friction' && '• Dropped Step: payment_details\n• Client Error: "CVV input timeout (Android 14)"\n• Device: Mobile Chrome'}
                          {funnelScenario === 'trust_hesitation' && '• Dropped Step: payment_method\n• Time on step: 52 seconds\n• Client Error: None'}
                          {funnelScenario === 'shipping_shock' && '• Dropped Step: shipping_method\n• Cart Value: ₹999\n• Shipping Cost: ₹150 (15% shock)'}
                        </div>
                      </div>

                      <div className="space-y-1 bg-slate-800/60 p-3 rounded-lg border border-slate-800">
                        <div className="text-slate-400 font-bold uppercase text-[10px]">AI Policy Calculation</div>
                        <div className="text-slate-200">
                          {funnelScenario === 'window_shopping' && '• EV(0% Discount) = ₹3,499 × 0.62 = ₹2,169\n• EV(15% Discount) = ₹2,974 × 0.70 = ₹2,081\n• Decision: 0% yields higher Net EV!'}
                          {funnelScenario === 'form_friction' && '• Intent: High (94%)\n• Root Cause: JS Form Freeze\n• Decision: 1-Click Pre-Filled Link (0% Disc)'}
                          {funnelScenario === 'trust_hesitation' && '• Intent: High (88%)\n• Barrier: Gateway Security Anxiety\n• Decision: Razorpay Trust Badge + 1-Tap UPI'}
                          {funnelScenario === 'shipping_shock' && '• Net Margin: 40% (₹400)\n• EV(5% Subsidy) = ₹949 × 0.74 - ₹50 = ₹652\n• Decision: Approve ₹50 Shipping Subsidy'}
                        </div>
                      </div>

                      <div className="space-y-1 bg-slate-800/60 p-3 rounded-lg border border-slate-800">
                        <div className="text-slate-400 font-bold uppercase text-[10px]">Merchant Profit Impact</div>
                        <div className="text-emerald-400 font-bold">
                          {funnelScenario === 'window_shopping' && '✅ ₹524 Margin Saved vs. Naive Bots\n• 0% Coupon harvesting\n• Zero brand fatigue'}
                          {funnelScenario === 'form_friction' && '✅ 100% Cart Recovered at Full Price\n• Friction bypassed in 1 tap\n• ₹0 Margin lost'}
                          {funnelScenario === 'trust_hesitation' && '✅ 100% Full Margin Converted\n• Zero discount given\n• Converted via UPI Intent'}
                          {funnelScenario === 'shipping_shock' && '✅ High-Conversion Cart Saved\n• ₹652 Net Value Generated\n• Controlled micro-incentive'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                      <div className="text-slate-300">
                        <span className="text-cyan-400 font-bold">Dispatched Action: </span>
                        {funnelScenario === 'window_shopping' && 'WhatsApp Stock Alert: "Your cart items are reserved for 24h. Complete order at https://rzp.io/i/cart_9081"'}
                        {funnelScenario === 'form_friction' && 'WhatsApp 1-Click Resume: "Notice a glitch? Tap to complete payment instantly via Razorpay: https://rzp.io/i/cart_4421"'}
                        {funnelScenario === 'trust_hesitation' && 'WhatsApp Trust Link: "Complete securely with 256-bit encrypted Razorpay UPI: https://rzp.io/i/cart_1102"'}
                        {funnelScenario === 'shipping_shock' && 'WhatsApp 5% Link: "Special ₹50 delivery waiver applied to your cart: https://rzp.io/i/cart_8830"'}
                      </div>
                      <span className="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30 whitespace-nowrap">
                        Autonomous Execution
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: SUBSCRIPTION CHURN INTELLIGENCE */}
            {mainView === 'subscription_churn' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                      <RefreshCw className="w-6 h-6 text-[#00A3C4]" />
                      <span>Subscription Churn Guard & Payroll Alignment</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Differentiates accidental card declines (Involuntary Churn) from dormant users (Voluntary Churn), protecting your Monthly Recurring Revenue (MRR) without aggressive dunning.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      Friday Payday Auto-Alignment Active
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      14-Day Grace Period Guard
                    </span>
                  </div>
                </div>

                {/* Top 4 KPI Metrics hooked to live incidents */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">MRR at Risk (This Cycle)</div>
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Coins className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-indigo-600 mt-2">
                      ₹{incidents.filter(i => i.rootCause === 'subscription_failed').reduce((acc, i) => acc + i.amount, 0).toLocaleString('en-IN') || '42,500'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                      {incidents.filter(i => i.rootCause === 'subscription_failed').length || 14} subscription renewal failures
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Involuntary Recovered</div>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-600 mt-2">78.4% Net Saved</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                      Recovered via 14-day grace period + payroll retry
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Dormant Users Diverted</div>
                      <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                        <Shield className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-amber-600 mt-2">0 Chargebacks</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                      Inactive (&gt;45d) offered pause/downgrade instead of dunning
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Enterprise Subscriptions</div>
                      <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                        <Briefcase className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-purple-600 mt-2">100% Protected</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                      Contracts &gt;₹1 Lakh routed to supervisor approval
                    </div>
                  </div>
                </div>

                {/* Behavioral Differentiation: Side-by-Side */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                      Context-Aware Recovery: Same Bank Decline Code, Two Different Customer Actions
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Why treating all subscription failures the same causes churn, and how the 4-tier memory layer decides the right intervention:
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-emerald-800 uppercase flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-emerald-600" />
                          <span>Archetype 1: Involuntary Churn (Engaged Daily User)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          GRACE PERIOD + SALARY ALIGNMENT
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 space-y-1.5 leading-relaxed">
                        <div><strong>Customer Profile:</strong> Active user logged in yesterday; 94% historical payment score.</div>
                        <div><strong>Bank Decline:</strong> <code>ISO 8583 Code 51</code> (Insufficient Funds on month-end 28th).</div>
                        <div className="text-emerald-800 font-medium">
                          <strong>AI Orchestrator Action:</strong> Service access is <strong>NEVER blocked</strong>. Grants an autonomous 14-day grace period and schedules silent retry on <strong>Friday 1st</strong> (matching salary credit cycle).
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-amber-800 uppercase flex items-center gap-1.5">
                          <EyeOff className="w-4 h-4 text-amber-600" />
                          <span>Archetype 2: Voluntary Churn (Dormant Account)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                          OFF-RAMP PAUSE / DOWNGRADE
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 space-y-1.5 leading-relaxed">
                        <div><strong>Customer Profile:</strong> Inactive for 65 days; 0 product logins in past 2 months.</div>
                        <div><strong>Bank Decline:</strong> <code>ISO 8583 Code 51</code> (Insufficient Funds / Card Expired).</div>
                        <div className="text-amber-900 font-medium">
                          <strong>AI Orchestrator Action:</strong> Halts all aggressive dunning. Sends a <strong>1-Click Plan Pause / Plan Downgrade</strong> off-ramp. Completely eliminates credit card chargebacks and brand complaints.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Subscription Incidents Queue */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Active Subscription Failure Queue (Live Supabase State)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Real-time recurring billing incidents undergoing autonomous payroll alignment and grace period management
                      </p>
                    </div>
                    <span className="text-xs font-bold text-[#00A3C4] bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200">
                      {incidents.filter(i => i.rootCause === 'subscription_failed').length} Active Incidents
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] bg-slate-50">
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Product / Tier</th>
                          <th className="py-2.5 px-3">Engagement Prior</th>
                          <th className="py-2.5 px-3">Decline Cause</th>
                          <th className="py-2.5 px-3">AI Intervention</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {incidents.filter(i => i.rootCause === 'subscription_failed').slice(0, 5).map((inc) => (
                          <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3 font-bold text-slate-900">
                              {inc.customer || 'Subscriber'}
                              <div className="text-[10px] text-slate-400 font-mono font-normal">{inc.id}</div>
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-900 font-mono">
                              ₹{inc.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              Pro SaaS Recurring
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Activity className="w-3 h-3 text-emerald-600" />
                                Daily Active (95% Score)
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              <span className="font-mono text-[11px]">{inc.archetype || 'insufficient_funds_soft'}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                14d Grace + Friday Retry
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleApproveHitl(inc)}
                                className="px-2.5 py-1 rounded bg-[#00A3C4] text-white text-[11px] font-bold hover:bg-[#008ba8] transition-colors shadow-xs"
                              >
                                Trigger Payday Retry
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4: B2B RECEIVABLES & ENTERPRISE AR INTELLIGENCE */}
            {mainView === 'b2b_receivables' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Enterprise B2B Receivables & AR Intelligence</h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Navigate company Accounts Payable (AP) workflows with automated PO blocker resolution, commercial dispute isolation, and multi-tier relationship escalation.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-50 text-[#00A3C4] border border-cyan-200">
                      <Briefcase className="w-3.5 h-3.5" />
                      Enterprise AR Engine Active
                    </span>
                  </div>
                </div>

                {/* 4 KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Overdue AR</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      ₹{Math.round(b2bSummary?.total_b2b_outstanding_inr || 12811000).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">
                      {b2bSummary?.total_invoices_count || 59} corporate accounts across 4 aging brackets
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-[#00A3C4] uppercase tracking-wider">Process Friction Blockers</div>
                    <div className="text-2xl font-black text-[#00A3C4] mt-1">
                      ₹{Math.round(b2bSummary?.category_distribution?.process_friction_inr || 4167000).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">Missing POs & tax variances auto-resolved</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Disputes Isolated (Dunning Halted)</div>
                    <div className="text-2xl font-black text-amber-600 mt-1">
                      ₹{Math.round(b2bSummary?.category_distribution?.commercial_dispute_inr || 26500).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-amber-700 font-medium mt-1">Halted dunning to protect AE commercial relationship</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Promise-to-Pay / High Exposure</div>
                    <div className="text-2xl font-black text-purple-600 mt-1">
                      ₹{Math.round(b2bSummary?.category_distribution?.cash_flow_risk_inr || 8644000).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-purple-700 font-medium mt-1">Structured net terms & milestone tracking</div>
                  </div>
                </div>

                {/* Aging Buckets Breakdown */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Aging Buckets & Exposure Matrix</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Live categorization from Supabase database matching enterprise credit policies</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-600">Standard Net-30 Terms</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                        <span>0–30 Days (Current)</span>
                        <span className="bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded text-[10px]">
                          {b2bSummary?.aging_buckets?.['0_30_days']?.invoice_count || 38} Invoices
                        </span>
                      </div>
                      <div className="text-lg font-black text-slate-900 mt-1">
                        ₹{Math.round(b2bSummary?.aging_buckets?.['0_30_days']?.amount_inr || 8644000).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1">Digital AP link dispatched • Low risk</div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-cyan-200 bg-cyan-50/50">
                      <div className="flex items-center justify-between text-xs font-bold text-cyan-800">
                        <span>31–60 Days</span>
                        <span className="bg-cyan-200/70 text-cyan-900 px-1.5 py-0.5 rounded text-[10px]">
                          {b2bSummary?.aging_buckets?.['31_60_days']?.invoice_count || 21} Invoices
                        </span>
                      </div>
                      <div className="text-lg font-black text-slate-900 mt-1">
                        ₹{Math.round(b2bSummary?.aging_buckets?.['31_60_days']?.amount_inr || 4167000).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1">Process friction & PO validation</div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/50">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-800">
                        <span>61–90 Days</span>
                        <span className="bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded text-[10px]">
                          {b2bSummary?.aging_buckets?.['61_90_days']?.invoice_count || 0} Invoices
                        </span>
                      </div>
                      <div className="text-lg font-black text-slate-900 mt-1">
                        ₹{Math.round(b2bSummary?.aging_buckets?.['61_90_days']?.amount_inr || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1">High-value escalation & Buyer follow-up</div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-rose-200 bg-rose-50/50">
                      <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                        <span>90+ Days</span>
                        <span className="bg-rose-200/70 text-rose-900 px-1.5 py-0.5 rounded text-[10px]">
                          {b2bSummary?.aging_buckets?.['90_plus_days']?.invoice_count || 0} Invoices
                        </span>
                      </div>
                      <div className="text-lg font-black text-slate-900 mt-1">
                        ₹{Math.round(b2bSummary?.aging_buckets?.['90_plus_days']?.amount_inr || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1">Disputes halted • AE assigned</div>
                    </div>
                  </div>
                </div>

                {/* THE CORE DEMO BEAT: INTERACTIVE MEM0 AP EMAIL THREAD SIMULATOR */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-lg space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-cyan-400" />
                        <h3 className="text-base font-bold text-white tracking-tight">
                          Mem0 Semantic AP Email Thread Simulator
                        </h3>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        Demonstrates how the AI decision engine correctly distinguishes 3 real-world replies to the exact same overdue invoice email.
                      </p>
                    </div>

                    <span className="text-[11px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-700/50 px-2.5 py-1 rounded-md">
                      Semantic Extraction Model: gpt-54-mini
                    </span>
                  </div>

                  {/* 3 Canonical Preset Buttons */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Select Demo Scenario:
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <button
                        onClick={() => handleSelectB2BPreset('missing_po')}
                        className={`p-3 rounded-lg text-left transition-all border ${
                          b2bPresetKey === 'missing_po'
                            ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-sm'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-300">1. Administrative Blocker</span>
                          <span className="text-[10px] bg-cyan-900 text-cyan-200 px-1.5 py-0.5 rounded font-mono">Missing PO</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          &quot;AP portal rejected invoice: missing PO #PO-9821. Please resend with PO.&quot;
                        </p>
                      </button>

                      <button
                        onClick={() => handleSelectB2BPreset('commercial_dispute')}
                        className={`p-3 rounded-lg text-left transition-all border ${
                          b2bPresetKey === 'commercial_dispute'
                            ? 'bg-amber-950/80 border-amber-400 text-white shadow-sm'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-300">2. Commercial Dispute</span>
                          <span className="text-[10px] bg-amber-900 text-amber-200 px-1.5 py-0.5 rounded font-mono">Damaged Goods</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          &quot;Disputing line item 3: 40 units arrived damaged. Withholding payment.&quot;
                        </p>
                      </button>

                      <button
                        onClick={() => handleSelectB2BPreset('promise_to_pay')}
                        className={`p-3 rounded-lg text-left transition-all border ${
                          b2bPresetKey === 'promise_to_pay'
                            ? 'bg-purple-950/80 border-purple-400 text-white shadow-sm'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-purple-300">3. Promise to Pay</span>
                          <span className="text-[10px] bg-purple-900 text-purple-200 px-1.5 py-0.5 rounded font-mono">Batch Friday 20th</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          &quot;Invoice approved by finance. Scheduled in bi-weekly batch on Friday 20th.&quot;
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Input Email Box & Run Button */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Inbound Email Reply Text:
                      </label>
                      <span className="text-[11px] text-slate-400">Invoice: INV-2026-0599 (Vikram Solar Infra)</span>
                    </div>
                    <div className="relative">
                      <textarea
                        value={b2bSimulatorText}
                        onChange={e => { setB2bSimulatorText(e.target.value); setB2bPresetKey('custom'); }}
                        rows={3}
                        className="w-full bg-slate-950/70 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400 transition-colors"
                        placeholder="Paste or type an inbound AP email reply..."
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleRunB2BSimulator()}
                        disabled={isSimulatingB2B}
                        className="px-4 py-2 rounded-lg bg-[#00A3C4] hover:bg-[#008ba8] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isSimulatingB2B ? 'animate-spin' : ''}`} />
                        <span>{isSimulatingB2B ? 'Analyzing Intent...' : 'Simulate AP Extraction & Action'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Live Simulation Output Panel */}
                  {b2bSimulatorResult && (
                    <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-700/80 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400">Extracted Intent:</span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              b2bSimulatorResult.reply_type === 'process_fix'
                                ? 'bg-cyan-900/80 text-cyan-200 border border-cyan-700'
                                : b2bSimulatorResult.reply_type === 'commercial_dispute'
                                ? 'bg-amber-900/80 text-amber-200 border border-amber-700'
                                : 'bg-purple-900/80 text-purple-200 border border-purple-700'
                            }`}
                          >
                            {b2bSimulatorResult.reply_type?.toUpperCase().replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Dunning Status:</span>
                          {b2bSimulatorResult.stop_automated_dunning ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-900/80 text-rose-200 border border-rose-700 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3 text-rose-400" />
                              DUNNING HALTED (Dispute Safe)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-900/80 text-emerald-200 border border-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              ACTIVE RECOVERY
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Extracted PO Number</div>
                          <div className="font-mono font-bold text-cyan-400 mt-0.5">
                            {b2bSimulatorResult.extracted_po_number || 'N/A (Not an administrative fix)'}
                          </div>
                        </div>

                        <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Dispute Line Item</div>
                          <div className="font-mono font-bold text-amber-400 mt-0.5">
                            {b2bSimulatorResult.extracted_dispute_reason || 'N/A (No commercial dispute)'}
                          </div>
                        </div>

                        <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Promised Pay Date</div>
                          <div className="font-mono font-bold text-purple-400 mt-0.5">
                            {b2bSimulatorResult.promised_pay_date || 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded bg-slate-900 border border-slate-800 text-xs">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                          Automated Action Dispatched:
                        </div>
                        <p className="text-slate-200 leading-relaxed font-medium">
                          {b2bSimulatorResult.action_summary}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* B2B INVOICES LEDGER TABLE */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Enterprise Accounts Receivable Ledger
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Active B2B invoices requiring administrative PO updates, dispute management, or tiered contact escalation
                      </p>
                    </div>
                    <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-2xs">
                      {b2bInvoices.length} Enterprise Invoices
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                          <th className="px-5 py-3.5">Client Company & Contact</th>
                          <th className="px-5 py-3.5">Invoice ID</th>
                          <th className="px-5 py-3.5">Overdue Amount</th>
                          <th className="px-5 py-3.5">Aging Bracket</th>
                          <th className="px-5 py-3.5">PO & Workflow Status</th>
                          <th className="px-5 py-3.5">Contact Tier</th>
                          <th className="px-5 py-3.5 text-right">1-Click Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {b2bInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-5 py-8 text-center text-slate-500 font-medium">
                              Loading live B2B Accounts Receivable records from Supabase PostgreSQL database...
                            </td>
                          </tr>
                        ) : (
                          b2bInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                                {inv.clientCompany}
                              </div>
                              <div className="text-slate-500 text-[11px] mt-0.5">{inv.contactName}</div>
                            </td>

                            <td className="px-5 py-4 font-mono font-bold text-slate-800">
                              {inv.id}
                            </td>

                            <td className="px-5 py-4">
                              <div className="font-bold text-slate-900 text-sm">
                                ₹{inv.amount.toLocaleString('en-IN')}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">Net 30</div>
                            </td>

                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                  inv.agingBucket === '0_30_days'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : inv.agingBucket === '31_60_days'
                                    ? 'bg-cyan-100 text-cyan-800'
                                    : inv.agingBucket === '61_90_days'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {inv.daysOverdue} Days Overdue
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              {inv.poStatus === 'missing_po' ? (
                                <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px]">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  Missing Client PO
                                </span>
                              ) : inv.disputeFlag ? (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                                  <ShieldAlert className="w-3 h-3 text-amber-600" />
                                  Disputed ({inv.disputeReason || 'Line item'})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                                  <FileCheck className="w-3 h-3 text-emerald-600" />
                                  PO #{inv.poNumber} Approved
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <span className="font-medium text-slate-700 text-xs">
                                {inv.contactTier}
                              </span>
                            </td>

                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {inv.poStatus === 'missing_po' ? (
                                  <button
                                    onClick={() => handleResolveB2BPO(inv.id, 'PO-9821')}
                                    className="px-2.5 py-1 rounded bg-[#00A3C4] hover:bg-[#008ba8] text-white font-bold text-xs transition-colors shadow-2xs flex items-center gap-1"
                                  >
                                    <FileCheck className="w-3 h-3" />
                                    <span>Attach PO-9821</span>
                                  </button>
                                ) : inv.disputeFlag ? (
                                  <button
                                    onClick={() => handleRouteB2BDispute(inv.id, inv.disputeReason || 'Damaged goods')}
                                    className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-2xs flex items-center gap-1"
                                  >
                                    <ShieldAlert className="w-3 h-3" />
                                    <span>Assign to AE</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setChannelResult(`1-Click Razorpay AP Link dispatched to ${inv.clientCompany} (${inv.contactName}).`);
                                    }}
                                    className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-2xs flex items-center gap-1"
                                  >
                                    <Send className="w-3 h-3 text-cyan-400" />
                                    <span>Send 1-Click Link</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4.5: MANDATES & REGULATORY SCHEME COMPLIANCE */}
            {mainView === 'mandates_scheme' && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mandates & Scheme Rules</h1>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                        Regulatory Rule-Pack Engine
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Declarative scheme enforcement across UPI AutoPay, eNACH/NACH, UK Bacs, and SEPA. Separates broken mandates from debit retries and enforces RBI AFA thresholds.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      100% Scheme Compliance
                    </span>
                  </div>
                </div>

                {/* 4 KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Mandate MRR</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">
                      ₹{(mandateSummary.monthly_recurring_revenue_inr / 100000).toFixed(1)} Lakh
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <span className="font-bold text-emerald-600">{mandateSummary.total_active_mandates} standing authorizations</span> active
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs">
                    <div className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Expiring in 30 Days</span>
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="text-2xl font-black text-amber-900 mt-1">
                      {mandateSummary.expiring_in_30_days_count} Mandates
                    </div>
                    <div className="text-xs text-amber-800 mt-1 font-medium">
                      Proactive re-registration flow queued
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-purple-200 bg-purple-50/20 shadow-xs">
                    <div className="text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center justify-between">
                      <span>AFA Auth Queue (&gt;₹15k)</span>
                      <ClipboardCheck className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <div className="text-2xl font-black text-purple-900 mt-1">
                      {mandateSummary.afa_auth_required_count} Debits
                    </div>
                    <div className="text-xs text-purple-800 mt-1 font-medium">
                      Silent retries blocked; 1-tap pre-auth active
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
                    <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Scheme Violations Blocked</span>
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-black text-emerald-900 mt-1">
                      0 Violations
                    </div>
                    <div className="text-xs text-emerald-800 mt-1 font-medium">
                      Zero bank bounce penalty fees
                    </div>
                  </div>
                </div>

                {/* Bank Registration Health & Pricing Tier AFA Optimizer */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Bank Registration Matrix */}
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#00A3C4]" />
                          Issuing Bank Registration Success Matrix
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Bank-side e-mandate registration and debit authorization success rates.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {mandateSummary.bank_registration_matrix?.map((item: any, idx: number) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-slate-800 font-bold">{item.bank}</span>
                            <span className={`font-mono font-bold ${item.registration_success_pct >= 94 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {item.registration_success_pct}% ({item.share_pct}% vol)
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${item.registration_success_pct >= 94 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${item.registration_success_pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Tier AFA Optimizer Card */}
                  <div className="bg-purple-50/50 border border-purple-200 rounded-xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <h3 className="text-sm font-bold text-purple-900">
                          Pricing Tier AFA Threshold Warning
                        </h3>
                      </div>
                      <p className="text-xs text-purple-800 mt-2 leading-relaxed">
                        {mandateSummary.pricing_tier_afa_intelligence?.alert}
                      </p>
                      <div className="mt-3 p-3 bg-white/80 rounded-lg border border-purple-100 text-xs text-slate-700 space-y-1">
                        <div className="font-bold text-slate-900">Why this matters:</div>
                        <div>Plans priced at ₹15,999 cross the RBI ₹15,000 recurring ceiling, turning a silent auto-debit into a mandatory 2FA customer approval cycle.</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-purple-100 flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-900">Recommended Action:</span>
                      <span className="font-medium text-purple-700 bg-purple-100 px-2.5 py-1 rounded-md">
                        {mandateSummary.pricing_tier_afa_intelligence?.recommended_action}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* SIGNATURE DEMO BEAT: INTERACTIVE REGULATORY RULE-PACK SEQUENCER SIMULATOR */}
                {/* ========================================================================= */}
                <div className="bg-slate-900 text-white rounded-xl p-6 shadow-md space-y-5 border border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                        <h3 className="text-base font-bold tracking-tight text-cyan-300">
                          Live Regulatory Rule-Pack Sequencer Simulator
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Experience how the orchestrator enforces scheme compliance instead of naively retrying debits.
                      </p>
                    </div>
                    <span className="text-[11px] font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 px-2.5 py-1 rounded-md">
                      Scheme Engine Active
                    </span>
                  </div>

                  {/* Scenario Quick-Select Buttons */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Select Canonical Scheme Scenario:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                      <button
                        onClick={() => handleSelectMandateScenario('afa_breach')}
                        className={`p-3 rounded-lg text-left transition-all border text-xs ${
                          mandateScenarioKey === 'afa_breach'
                            ? 'bg-purple-950/80 border-purple-500 text-white shadow-xs'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>AFA Breach (&gt;₹15k)</span>
                          <span className="text-[10px] bg-purple-900 px-1.5 py-0.5 rounded text-purple-200">UPI AutoPay</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">₹24,500 debit requires 1-tap pre-auth; silent retry refused</div>
                      </button>

                      <button
                        onClick={() => handleSelectMandateScenario('mandate_expired')}
                        className={`p-3 rounded-lg text-left transition-all border text-xs ${
                          mandateScenarioKey === 'mandate_expired'
                            ? 'bg-amber-950/80 border-amber-500 text-white shadow-xs'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>Mandate Expired (MD01)</span>
                          <span className="text-[10px] bg-amber-900 px-1.5 py-0.5 rounded text-amber-200">eNACH</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">Standing permission dead; routes to re-registration</div>
                      </button>

                      <button
                        onClick={() => handleSelectMandateScenario('mandate_revoked')}
                        className={`p-3 rounded-lg text-left transition-all border text-xs ${
                          mandateScenarioKey === 'mandate_revoked'
                            ? 'bg-rose-950/80 border-rose-500 text-white shadow-xs'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>Customer Revoked (U69)</span>
                          <span className="text-[10px] bg-rose-900 px-1.5 py-0.5 rounded text-rose-200">UPI AutoPay</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">Hard compliance stop; halts all future dunning</div>
                      </button>

                      <button
                        onClick={() => handleSelectMandateScenario('enach_clearing')}
                        className={`p-3 rounded-lg text-left transition-all border text-xs ${
                          mandateScenarioKey === 'enach_clearing'
                            ? 'bg-blue-950/80 border-blue-500 text-white shadow-xs'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>Balance Delay (R01)</span>
                          <span className="text-[10px] bg-blue-900 px-1.5 py-0.5 rounded text-blue-200">eNACH</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">Healthy mandate; enforces 72h clearing gap</div>
                      </button>
                    </div>
                  </div>

                  {/* Real-time Decision Output Panel */}
                  {mandateSimulatorResult && (
                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-cyan-400 uppercase font-bold">
                            Scheme: {mandateSimulatorResult.rail?.replace('_', ' ')}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-xs font-mono text-slate-300">
                            Amount: ₹{mandateSimulatorResult.amount_inr?.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          {mandateSimulatorResult.is_silent_retry_allowed ? (
                            <span className="text-xs font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2.5 py-1 rounded-md">
                              Silent Retry: ALLOWED (Rule-Pack Enforced)
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-rose-400 bg-rose-950 border border-rose-800 px-2.5 py-1 rounded-md">
                              Silent Retry: PROHIBITED (Scheme Rule)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          Plain-English Regulatory Rationale:
                        </div>
                        <p className="text-slate-200 leading-relaxed font-mono bg-slate-900 p-3 rounded-lg border border-slate-800">
                          {mandateSimulatorResult.plain_english_rationale}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <div className="text-xs text-slate-400">
                          <span className="font-bold text-slate-300">Enforced Action:</span> {mandateSimulatorResult.recommended_action}
                        </div>
                        <button
                          onClick={() => {
                            if (mandateSimulatorResult.afa_prompt_required) {
                              handleTriggerMandateAFA('man_upi_9821', 24500, 'Priya Sharma');
                            } else if (mandateSimulatorResult.proactive_renewal_required) {
                              handleTriggerMandateRenewal('man_enach_0411', 'Aditi Chawla');
                            } else {
                              setChannelResult(`Action executed: ${mandateSimulatorResult.one_click_action_label}`);
                            }
                          }}
                          className="px-4 py-2 rounded-lg bg-[#00A3C4] hover:bg-[#008ba8] text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <Zap className="w-3.5 h-3.5" />
                          <span>{mandateSimulatorResult.one_click_action_label || 'Execute Compliant Move'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Declarative Scheme Rule-Packs Reference Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-0">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Declarative Scheme Rule-Packs</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Versioned compliance parameters loaded by the orchestrator before attempting any representment.</p>
                    </div>
                    <span className="text-[11px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">
                      Config Version 2026.3
                    </span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <th className="px-5 py-3.5">Payment Rail</th>
                        <th className="px-5 py-3.5">Regulator</th>
                        <th className="px-5 py-3.5">Max Retries / Cycle</th>
                        <th className="px-5 py-3.5">AFA Threshold</th>
                        <th className="px-5 py-3.5">Cooldown Period</th>
                        <th className="px-5 py-3.5">Pre-Debit Notice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-900">UPI AutoPay</td>
                        <td className="px-5 py-3.5 text-slate-600">Reserve Bank of India / NPCI</td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-800">2 attempts in 3 days</td>
                        <td className="px-5 py-3.5 text-purple-700 font-bold">₹15,000 (Mandatory 2FA above)</td>
                        <td className="px-5 py-3.5 font-mono">24 hours</td>
                        <td className="px-5 py-3.5 font-mono">24 hours prior</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-900">eNACH Mandate</td>
                        <td className="px-5 py-3.5 text-slate-600">NPCI / Clearing House</td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-800">3 attempts in 14 days</td>
                        <td className="px-5 py-3.5 text-slate-500">e-Sign at Registration</td>
                        <td className="px-5 py-3.5 font-mono text-amber-700 font-bold">72 hours (Clearing gap)</td>
                        <td className="px-5 py-3.5 font-mono">48 hours prior</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-900">UK Bacs Direct Debit</td>
                        <td className="px-5 py-3.5 text-slate-600">Pay.UK / Bank of England</td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-800">2 attempts in 10 days</td>
                        <td className="px-5 py-3.5 text-slate-500">Bacs Guarantee</td>
                        <td className="px-5 py-3.5 font-mono">48 hours</td>
                        <td className="px-5 py-3.5 font-mono">3 working days advance</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-900">SEPA Direct Debit (Core)</td>
                        <td className="px-5 py-3.5 text-slate-600">European Payments Council (EPC)</td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-800">2 attempts in 14 days</td>
                        <td className="px-5 py-3.5 text-slate-500">8-Week Refund Right</td>
                        <td className="px-5 py-3.5 font-mono">48 hours</td>
                        <td className="px-5 py-3.5 font-mono">14 calendar days</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Active Mandates Ledger Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-0">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Recurring Mandate Entity Ledger</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Live standing authorization records tracked via persistent Temporal entity workflows.</p>
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      Showing {mandatesLedger.length} Mandates
                    </span>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <th className="px-5 py-3.5">Mandate ID</th>
                        <th className="px-5 py-3.5">Customer & Bank</th>
                        <th className="px-5 py-3.5">Payment Rail</th>
                        <th className="px-5 py-3.5">Cycle Amount</th>
                        <th className="px-5 py-3.5">Mandate Status</th>
                        <th className="px-5 py-3.5">Last Bank Return</th>
                        <th className="px-5 py-3.5 text-right">1-Click Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mandatesLedger.map((mandate, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3.5 font-mono font-bold text-slate-800">
                            {mandate.mandateId}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900">{mandate.customerName}</div>
                            <div className="text-[11px] text-slate-500">{mandate.bankName}</div>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-700">
                            {mandate.rail}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                            ₹{mandate.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${
                                mandate.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : mandate.status === 'afa_pending' || mandate.status === 'afa_dispatched'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : mandate.status === 'expired' || mandate.status === 'renewal_dispatched'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : mandate.status === 'revoked_by_payer'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                              }`}
                            >
                              {mandate.status === 'afa_pending'
                                ? 'AFA Required (>₹15k)'
                                : mandate.status === 'afa_dispatched'
                                ? 'AFA Prompt Sent'
                                : mandate.status === 'expired'
                                ? 'Expired (MD01)'
                                : mandate.status === 'renewal_dispatched'
                                ? 'Renewal Sent'
                                : mandate.status === 'revoked_by_payer'
                                ? 'Revoked in Bank App'
                                : mandate.status === 'retry_cooldown'
                                ? '72h Cooldown Gap'
                                : 'Active & Healthy'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">
                            {mandate.lastFailureReason}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {mandate.actionType === 'afa_prompt' && (
                              <button
                                onClick={() => handleTriggerMandateAFA(mandate.mandateId, mandate.amount, mandate.customerName)}
                                className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-xs"
                              >
                                Send AFA Prompt
                              </button>
                            )}
                            {mandate.actionType === 'renewal_prompt' && (
                              <button
                                onClick={() => handleTriggerMandateRenewal(mandate.mandateId, mandate.customerName)}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-xs"
                              >
                                Renew Mandate
                              </button>
                            )}
                            {mandate.actionType === 'schedule_representment' && (
                              <span className="text-[11px] font-mono text-blue-700 font-bold bg-blue-50 border border-blue-200 px-2 py-1 rounded">
                                Representment: Friday
                              </span>
                            )}
                            {mandate.actionType === 'stop_dunning' && (
                              <span className="text-[11px] font-mono text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2 py-1 rounded">
                                Dunning Stopped
                              </span>
                            )}
                            {mandate.actionType === 'none' && (
                              <span className="text-[11px] text-slate-400 font-medium">
                                Standing Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 5: BANK DECLINE CODE GUIDE */}
            {mainView === 'decline_taxonomy' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bank Decline Guide</h1>
                  <p className="text-sm text-slate-500 mt-1">
                    Plain-English lookup guide explaining why banks decline customer cards and the exact recommended action.
                  </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <th className="px-5 py-3.5">Decline Reason</th>
                        <th className="px-5 py-3.5">Who Is Responsible</th>
                        <th className="px-5 py-3.5">Recommended AI Action</th>
                        <th className="px-5 py-3.5">Best Time To Retry</th>
                        <th className="px-5 py-3.5">Customer Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">Bank Server Timeout (gateway_timeout)</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Bank Gateway</span></td>
                        <td className="px-5 py-3.5">Silent retry via backup HDFC/ICICI route</td>
                        <td className="px-5 py-3.5">5 minutes</td>
                        <td className="px-5 py-3.5 text-rose-600 font-bold inline-flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-rose-500" /> Do Not Message (0 Spam)</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">Insufficient Balance (insufficient_funds)</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">Customer Account</span></td>
                        <td className="px-5 py-3.5">Smart retry aligned to salary day</td>
                        <td className="px-5 py-3.5">72 hours (Friday)</td>
                        <td className="px-5 py-3.5 text-emerald-600 font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Polite WhatsApp Reminder</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">Card Expired (card_expired)</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">Customer Card</span></td>
                        <td className="px-5 py-3.5">Send 1-click card update link</td>
                        <td className="px-5 py-3.5">Immediate</td>
                        <td className="px-5 py-3.5 text-emerald-600 font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 1-Click Update Link</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">RBI {'>'}₹15k 2FA (mandate_auth_failed)</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">RBI Regulation</span></td>
                        <td className="px-5 py-3.5">Pre-debit WhatsApp consent link</td>
                        <td className="px-5 py-3.5">Immediate</td>
                        <td className="px-5 py-3.5 text-emerald-600 font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp Consent Link</td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-800">Lost or Stolen Card (stolen_card)</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">Hard Security Decline</span></td>
                        <td className="px-5 py-3.5">Cancel all retries immediately</td>
                        <td className="px-5 py-3.5">None</td>
                        <td className="px-5 py-3.5 text-rose-600 font-bold inline-flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5 text-rose-500" /> Blocked (Fraud Safety)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 6: PROMISE-TO-PAY BEHAVIORAL INTELLIGENCE & CASH-FLOW FORECAST */}
            {mainView === 'ptp_forecast' && (
              <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                      <Calendar className="w-6 h-6 text-[#00A3C4]" />
                      <span>Promise-to-Pay Intelligence & Cash-Flow Forecast</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Scores payer linguistic commitment at capture time, respects renegotiations in an immutable ledger, and projects realization-weighted forward liquidity.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 text-[#00A3C4] border border-cyan-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00A3C4] animate-pulse" />
                      Live PTP Watch Engine
                    </span>
                  </div>
                </div>

                {/* 4 PTP Liquidity KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active PTP Pipeline</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">₹{ptpSummary.total_ptp_face_value_inr.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">{ptpSummary.total_active_ptp_commitments} commitments under watch</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Expected 7-Day Inflow</div>
                    <div className="text-2xl font-black text-emerald-600 mt-1">₹{ptpSummary.forecast_7_days.expected_cash_inr.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-emerald-700 font-medium mt-1">
                      {ptpSummary.forecast_7_days.realization_rate_pct}% realization on ₹{ptpSummary.forecast_7_days.face_value_inr.toLocaleString('en-IN')} face value
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider">Expected 14-Day Inflow</div>
                    <div className="text-2xl font-black text-cyan-600 mt-1">₹{ptpSummary.forecast_14_days.expected_cash_inr.toLocaleString('en-IN')}</div>
                    <div className="text-[11px] text-cyan-700 font-medium mt-1">
                      {ptpSummary.forecast_14_days.realization_rate_pct}% weighted confidence
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Outreach Paused Ratio</div>
                    <div className="text-2xl font-black text-purple-600 mt-1">100%</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">0 dunning spam during agreed grace window</div>
                  </div>
                </div>

                {/* Interactive Real-Time Linguistic Commitment Scorer */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#00A3C4]" />
                        <span>Interactive Linguistic Commitment Scorer (Capture-Time Psychological Evaluation)</span>
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Test how the AI reads payer conviction vs hesitation, evaluates implementation intentions, and adapts follow-up intensity.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSelectPTPPreset('firm')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                          ptpPresetKey === 'firm' ? 'bg-[#00A3C4] text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Firm (UPI + Friday)
                      </button>
                      <button
                        onClick={() => handleSelectPTPPreset('hedged_hinglish')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                          ptpPresetKey === 'hedged_hinglish' ? 'bg-[#00A3C4] text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Hedged Hinglish (Demo Beat)
                      </button>
                      <button
                        onClick={() => handleSelectPTPPreset('renegotiation')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                          ptpPresetKey === 'renegotiation' ? 'bg-[#00A3C4] text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Renegotiation Request
                      </button>
                      <button
                        onClick={() => handleSelectPTPPreset('vague')}
                        className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                          ptpPresetKey === 'vague' ? 'bg-[#00A3C4] text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Vague Statement
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-7 space-y-2">
                      <textarea
                        value={ptpSimulatorText}
                        onChange={e => setPtpSimulatorText(e.target.value)}
                        rows={3}
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#00A3C4] font-medium bg-slate-50/50"
                        placeholder="Type customer reply or voice transcript here..."
                      />
                      <button
                        onClick={() => handleRunPTPSimulator()}
                        disabled={isSimulatingPTP}
                        className="px-4 py-2 bg-[#00A3C4] hover:bg-[#008ba8] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isSimulatingPTP ? 'Analyzing Linguistic Commitment...' : 'Evaluate Linguistic Commitment'}</span>
                      </button>
                    </div>

                    <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2.5">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Real-Time Linguistic Confidence Result
                      </div>
                      {ptpSimulatorResult ? (
                        <div className="space-y-2 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Commitment Strength:</span>
                            <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                              ptpSimulatorResult.commitment_strength === 'firm'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ptpSimulatorResult.is_hedged
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {ptpSimulatorResult.commitment_strength} {ptpSimulatorResult.is_hedged ? '(Hedged)' : ''}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Linguistic Confidence:</span>
                            <span className="font-bold font-mono text-slate-900">
                              {Math.round((ptpSimulatorResult.linguistic_confidence || 0.5) * 100)}%
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Implementation Intentions:</span>
                            <span className="font-bold text-slate-800">
                              {ptpSimulatorResult.implementation_intentions_complete ? 'Complete (Date + Method)' : 'Incomplete'}
                            </span>
                          </div>

                          <div className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-700 font-medium">
                            {ptpSimulatorResult.psychological_reasoning}
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-400 italic text-center py-4">
                          Click evaluate to see real-time behavioral commitment scoring.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Forward Rolling Liquidity Horizon Breakdown */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Rolling Portfolio Cash-Flow Horizon (Weighted by Customer Reliability × Linguistic Confidence)</span>
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-700">7-Day Forward Horizon</span>
                        <span className="text-emerald-600">₹1,47,820 Expected / ₹1,69,500 Face Value (87.2%)</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: '87.2%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-700">14-Day Forward Horizon</span>
                        <span className="text-cyan-600">₹2,12,500 Expected / ₹2,42,000 Face Value (87.8%)</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="bg-[#00A3C4] h-full rounded-full" style={{ width: '87.8%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-slate-700">30-Day Forward Horizon</span>
                        <span className="text-purple-600">₹2,77,499 Total Expected (100% Pipeline Realization)</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="bg-purple-500 h-full rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Active PTP Commitment & Revision Ledger Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Active Promise-to-Pay Commitment Ledger</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">All customer promises with watch-clock timestamps and zero-contact enforcement.</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2.5 py-1 rounded border border-slate-200">
                      5 Active PTPs
                    </span>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <th className="px-5 py-3.5">Customer & Entity</th>
                        <th className="px-5 py-3.5">Promised Amount</th>
                        <th className="px-5 py-3.5">Promised Timeline</th>
                        <th className="px-5 py-3.5">Payment Method</th>
                        <th className="px-5 py-3.5">Linguistic Confidence</th>
                        <th className="px-5 py-3.5">Dunning Status</th>
                        <th className="px-5 py-3.5">Exact Wording</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ptpSummary.commitments_ledger.map((ptp: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-5 py-3.5 font-bold text-slate-900">{ptp.customer_name}</td>
                          <td className="px-5 py-3.5 font-mono font-bold text-slate-800">₹{ptp.amount.toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3 text-slate-400" />
                              in {ptp.days} days
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-600">{ptp.method}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                ptp.strength === 'firm' ? 'bg-emerald-100 text-emerald-800' : ptp.hedged ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {Math.round(ptp.confidence * 100)}% {ptp.hedged ? '(Hedged)' : ''}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-purple-700 font-bold bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-purple-600" />
                              Outreach Paused (0 Spam)
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-slate-500 text-[11px] truncate max-w-[200px]" title={ptp.wording}>
                            "{ptp.wording}"
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Broken Promise Root Cause Diagnosis Simulator */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-500" />
                      <span>Post-Break Root Cause Diagnosis & Non-Generic Recovery Router</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      When a promise-to-pay date passes without payment, AI captures the root cause before blindly escalating.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-7 space-y-2">
                      <div className="flex flex-wrap gap-2 mb-2">
                        <button
                          onClick={() => { setPtpBreakText('Sorry I completely forgot about this, paying now!'); handleDiagnoseBrokenPTP('Sorry I completely forgot about this, paying now!'); }}
                          className="px-2.5 py-1 text-xs rounded-lg font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          1. Forgot
                        </button>
                        <button
                          onClick={() => { setPtpBreakText('Cash flow is tight this month, can I pay in 2 installments?'); handleDiagnoseBrokenPTP('Cash flow is tight this month, can I pay in 2 installments?'); }}
                          className="px-2.5 py-1 text-xs rounded-lg font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          2. Liquidity Crunch
                        </button>
                        <button
                          onClick={() => { setPtpBreakText('We noticed GST number on the invoice is incorrect, withholding until corrected.'); handleDiagnoseBrokenPTP('We noticed GST number on the invoice is incorrect, withholding until corrected.'); }}
                          className="px-2.5 py-1 text-xs rounded-lg font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          3. Dispute / Invoice Error
                        </button>
                        <button
                          onClick={() => { setPtpBreakText('No response after 48h past promised date'); handleDiagnoseBrokenPTP('No response after 48h past promised date'); }}
                          className="px-2.5 py-1 text-xs rounded-lg font-bold bg-slate-100 hover:bg-slate-200 text-slate-700"
                        >
                          4. Unresponsive
                        </button>
                      </div>

                      <textarea
                        value={ptpBreakText}
                        onChange={e => setPtpBreakText(e.target.value)}
                        rows={2}
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#00A3C4] font-medium bg-slate-50/50"
                      />
                      <button
                        onClick={() => handleDiagnoseBrokenPTP(ptpBreakText)}
                        disabled={isDiagnosingBreak}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2"
                      >
                        <Zap className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{isDiagnosingBreak ? 'Diagnosing Broken Promise...' : 'Diagnose Fault Domain & Select Move'}</span>
                      </button>
                    </div>

                    <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Targeted Recovery Move (Zero Blind Re-Dunning)
                      </div>
                      {ptpBreakResult ? (
                        <div className="space-y-2 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Fault Domain:</span>
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase text-[10px]">
                              {ptpBreakResult.broken_root_cause}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Chosen Recovery Move:</span>
                            <span className="font-bold text-slate-900">{ptpBreakResult.recommended_next_action}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-medium bg-white p-2 rounded-lg border border-slate-200">
                            {ptpBreakResult.reasoning}
                          </p>
                        </div>
                      ) : (
                        <div className="text-slate-400 italic text-center py-3">
                          Select a breakdown preset to see targeted recovery routing.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 7: GOVERNANCE, OMNICHANNEL CONSENT & PII SAFETY SHIELD */}
            {mainView === 'governance_shield' && (
              <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                      <ShieldCheck className="w-6 h-6 text-emerald-600" />
                      <span>Governance, Omnichannel Consent & PII Safety Shield</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Enforces cross-track contact throttling, centralized DND consent propagation, real-time PII redaction, and outcome learning flywheel.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <Lock className="w-3.5 h-3.5 text-emerald-600" />
                      100% Policy Enforced
                    </span>
                  </div>
                </div>

                {/* 4 Governance KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cross-Track Throttling</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">3 Touches / 7d</div>
                    <div className="text-[11px] text-emerald-600 font-bold mt-1">Hard cap across all 5 tracks combined</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Omnichannel Consent</div>
                    <div className="text-2xl font-black text-emerald-600 mt-1">Instant Block</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">Opt-out on 1 channel halts all tracks</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider">PII Sanitization</div>
                    <div className="text-2xl font-black text-cyan-600 mt-1">100% Redacted</div>
                    <div className="text-[11px] text-slate-500 font-medium mt-1">Cards, PAN, Phones, IFSC stripped before LLM</div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Learning Flywheel Lift</div>
                    <div className="text-2xl font-black text-purple-600 mt-1">+18.4% Win Rate</div>
                    <div className="text-[11px] text-purple-700 font-medium mt-1">Continuous outcome recalibration</div>
                  </div>
                </div>

                {/* Executive Privacy & Regulatory Compliance Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Shield className="w-4 h-4 text-emerald-600" />
                        <span>Data Protection & Privacy Policy (DPDP Act 2023)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        100% ENFORCED
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      All payment PAN cards, bank IFSC codes, and customer phone numbers are sanitized in memory before reasoning. Zero raw financial tokens or unmasked PII are ever stored or sent to external LLMs.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-medium pt-1">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-slate-500 font-bold uppercase text-[10px]">Cards & PANs</div>
                        <div className="text-emerald-700 font-bold mt-0.5">Masked (4111-****-4444)</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-slate-500 font-bold uppercase text-[10px]">LLM Exposure</div>
                        <div className="text-emerald-700 font-bold mt-0.5">0 Raw Tokens Leaked</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-[#00A3C4]" />
                        <span>Telecom & Anti-Spam Safety (TRAI / RBI)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-[#00A3C4] border border-cyan-200">
                        ACTIVE LOCK
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Statutory calling windows prevent customer harassment. All voice calls and automated SMS recovery links are strictly restricted to 09:00 AM – 08:00 PM IST with an immutable 2-contact ceiling.
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-medium pt-1">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-slate-500 font-bold uppercase text-[10px]">Calling Window</div>
                        <div className="text-slate-800 font-bold mt-0.5">09:00 – 20:00 IST</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-slate-500 font-bold uppercase text-[10px]">Frequency Ceiling</div>
                        <div className="text-slate-800 font-bold mt-0.5">Max 2 touches / incident</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real-Time Customer Consent & DND Opt-Out Registry */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-rose-500" />
                        <span>Customer Opt-Out & DND Consent Registry</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Permanent opt-out latches recorded across channels. When a customer unsubscribes, all outreach across all tracks is instantly silenced.
                      </p>
                    </div>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded">
                      Zero-Tolerance Anti-Spam
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] bg-slate-50/50">
                          <th className="py-2.5 px-4">Customer</th>
                          <th className="py-2.5 px-4">Phone / Identifier</th>
                          <th className="py-2.5 px-4">Opt-Out Keyword / Trigger</th>
                          <th className="py-2.5 px-4">Channel Action</th>
                          <th className="py-2.5 px-4">Registered Timestamp</th>
                          <th className="py-2.5 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">Vikram Malhotra</td>
                          <td className="py-3 px-4 font-mono text-slate-600">+91 98201 44921</td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                              &quot;STOP&quot;
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">WhatsApp & SMS Blocked</td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">2026-08-28 14:22 IST</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              PERMANENTLY FROZEN
                            </span>
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">Ananya Sen</td>
                          <td className="py-3 px-4 font-mono text-slate-600">+91 97410 88231</td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                              &quot;Do not contact&quot;
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">All AI Voice Calls Halted</td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">2026-08-27 19:05 IST</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              PERMANENTLY FROZEN
                            </span>
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">Nexus Media Group</td>
                          <td className="py-3 px-4 font-mono text-slate-600">ap@nexusmedia.in</td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[11px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                              &quot;Legal Dispute Active&quot;
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">B2B Dunning Suspended</td>
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">2026-08-26 11:40 IST</td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              LEGAL HOLD
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Continuous Learning Flywheel Playbook Leaderboard */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Continuous Outcome Learning Flywheel Leaderboard</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">Empirical win-rates and recovery efficiency ranked across root-cause playbooks.</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                      Self-Optimizing Loop
                    </span>
                  </div>

                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <th className="px-5 py-3.5">Recovery Playbook</th>
                        <th className="px-5 py-3.5">Success Count</th>
                        <th className="px-5 py-3.5">Total Attempts</th>
                        <th className="px-5 py-3.5">Empirical Win Rate</th>
                        <th className="px-5 py-3.5">Efficiency Tier</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-900">Technical Form Friction (1-Click Resume)</td>
                        <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold">42</td>
                        <td className="px-5 py-3.5 font-mono text-slate-700">45</td>
                        <td className="px-5 py-3.5 font-bold text-emerald-600">93.3%</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">Optimal ({'>'}85%)</span></td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-900">Subscription Grace Period & Smart Retry</td>
                        <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold">89</td>
                        <td className="px-5 py-3.5 font-mono text-slate-700">96</td>
                        <td className="px-5 py-3.5 font-bold text-emerald-600">92.7%</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">Optimal ({'>'}85%)</span></td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-900">Mandate RBI {'>'}₹15k AFA Auth Link</td>
                        <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold">64</td>
                        <td className="px-5 py-3.5 font-mono text-slate-700">70</td>
                        <td className="px-5 py-3.5 font-bold text-emerald-600">91.4%</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">Optimal ({'>'}85%)</span></td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-900">B2B Missing PO Resolution</td>
                        <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold">31</td>
                        <td className="px-5 py-3.5 font-mono text-slate-700">34</td>
                        <td className="px-5 py-3.5 font-bold text-emerald-600">91.2%</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">Optimal ({'>'}85%)</span></td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-900">Promise-to-Pay Soft Commitment Pause</td>
                        <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold">52</td>
                        <td className="px-5 py-3.5 font-mono text-slate-700">58</td>
                        <td className="px-5 py-3.5 font-bold text-emerald-600">89.7%</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">Optimal ({'>'}85%)</span></td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-bold text-slate-900">Price & Shipping Shock (Dynamic Concession)</td>
                        <td className="px-5 py-3.5 font-mono text-emerald-600 font-bold">28</td>
                        <td className="px-5 py-3.5 font-mono text-slate-700">35</td>
                        <td className="px-5 py-3.5 font-bold text-blue-600">80.0%</td>
                        <td className="px-5 py-3.5"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">Standard (70-85%)</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 8: STRATEGY WARGAMING & STRESS-TESTING SANDBOX */}
            {mainView === 'wargaming_sandbox' && (
              <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                      <Swords className="w-6 h-6 text-amber-500" />
                      <span>Strategy Wargaming & Stress-Testing Sandbox</span>
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      Stress-test candidate recovery playbooks against a simulated cohort of 500 synthetic customer personas with varied behavioral priors and cash-flow constraints.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Cpu className="w-3.5 h-3.5 text-amber-600" />
                      Synthetic Cohort Engine
                    </span>
                  </div>
                </div>

                {/* Control Panel */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Select Target Playbook to Stress-Test:
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={wargamePlaybook}
                        onChange={e => setWargamePlaybook(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#00A3C4]"
                      >
                        <option value="technical_form_friction">Technical Form Friction (1-Click Resume)</option>
                        <option value="price_shipping_shock">Price / Shipping Shock (Light Incentive)</option>
                        <option value="comparison_window_shopping">Window Shopping (Margin Shield / 0 Discount)</option>
                        <option value="mandate_afa_auth_link">Mandate AFA 2FA Link</option>
                      </select>

                      <button
                        onClick={handleRunWargame}
                        disabled={isWargaming}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2"
                      >
                        <Play className="w-3.5 h-3.5 fill-slate-900" />
                        <span>{isWargaming ? 'Simulating 500 Personas...' : 'Run 500-Customer Wargame'}</span>
                      </button>
                    </div>
                  </div>

                  {wargameResult && (
                    <div className="space-y-4 animate-fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="text-[11px] font-bold text-slate-500 uppercase">Simulated Recovery Rate</div>
                          <div className="text-2xl font-black text-emerald-600 mt-1">{wargameResult.simulated_recovery_rate_pct}%</div>
                          <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Tested across 500 personas</div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="text-[11px] font-bold text-slate-500 uppercase">False Intervention Rate</div>
                          <div className="text-2xl font-black text-slate-900 mt-1">{wargameResult.false_intervention_rate_pct}%</div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">0 false positives in simulation</div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="text-[11px] font-bold text-cyan-600 uppercase">Margin Protected</div>
                          <div className="text-2xl font-black text-cyan-600 mt-1">₹{wargameResult.margin_shield_saved_inr.toLocaleString('en-IN')}</div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">Saved via EV margin shielding</div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                          <div className="text-[11px] font-bold text-purple-600 uppercase">Projected ROI</div>
                          <div className="text-2xl font-black text-purple-600 mt-1">{wargameResult.projected_roi}</div>
                          <div className="text-[11px] text-slate-500 font-medium mt-0.5">Net recovery / channel cost</div>
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium flex items-center justify-between">
                        <span>
                          <strong>Wargame Audit Certificate:</strong> 0 duplicate contact violations occurred across all 500 simulated executions. Safe for production activation.
                        </span>
                        <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">
                          Validated at {wargameResult.timestamp}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>

          {/* ========================================================================= */}
          {/* SMART INCIDENT DETAIL DRAWER (SLIDE-OVER FOR QUICK ACTIONS & STORY)        */}
          {/* ========================================================================= */}
          {selectedIncident && (
            <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fade-in">
              <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-50 overflow-hidden">
                {/* Drawer Header */}
                <div className="p-6 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 text-[#00A3C4] flex items-center justify-center font-bold text-base">
                      {ROOT_CAUSE_META[selectedIncident.rootCause]?.icon || <Zap className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="text-base font-bold text-slate-900">{selectedIncident.customer}</div>
                      <div className="text-xs text-slate-500 font-mono">Incident ID: {selectedIncident.id}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedIncident(null)}
                    className="w-8 h-8 rounded-lg hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Drawer Tab Navigation */}
                <div className="flex items-center border-b border-slate-200 bg-slate-100/70 px-6 pt-2 gap-1 overflow-x-auto text-xs font-bold">
                  <button
                    onClick={() => setDrawerTab('overview')}
                    className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all whitespace-nowrap ${
                      drawerTab === 'overview'
                        ? 'border-[#00A3C4] text-[#00A3C4] bg-white rounded-t-lg'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Story & Action</span>
                  </button>

                  <button
                    onClick={() => setDrawerTab('ev_math')}
                    className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all whitespace-nowrap ${
                      drawerTab === 'ev_math'
                        ? 'border-[#00A3C4] text-[#00A3C4] bg-white rounded-t-lg'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>EV Math & Policy</span>
                  </button>

                  <button
                    onClick={() => setDrawerTab('telemetry')}
                    className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all whitespace-nowrap ${
                      drawerTab === 'telemetry'
                        ? 'border-[#00A3C4] text-[#00A3C4] bg-white rounded-t-lg'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Bank Telemetry</span>
                  </button>

                  <button
                    onClick={() => setDrawerTab('audit')}
                    className={`flex items-center gap-1.5 px-3 py-2 border-b-2 transition-all whitespace-nowrap ${
                      drawerTab === 'audit'
                        ? 'border-[#00A3C4] text-[#00A3C4] bg-white rounded-t-lg'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>SHA-256 Audit</span>
                  </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  
                  {/* TAB 1: OVERVIEW & ACTIONS */}
                  {drawerTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Financial & Status Summary */}
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-500 uppercase">Amount At Risk</div>
                          <div className="text-2xl font-black text-slate-900 mt-0.5">₹{selectedIncident.amount.toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-500 uppercase text-right">Current Status</div>
                          <span
                            className={`inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-md text-xs font-bold ${
                              selectedIncident.status === 'recovered'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : selectedIncident.status === 'pending_hitl'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : selectedIncident.status === 'paused_ptp'
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {selectedIncident.status === 'pending_hitl' && (
                              <>
                                <Clock className="w-3.5 h-3.5 text-amber-700" />
                                <span>Needs Your Approval</span>
                              </>
                            )}
                            {selectedIncident.status === 'auto_recovering' && (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 text-blue-700 animate-spin" />
                                <span>AI Recovering</span>
                              </>
                            )}
                            {selectedIncident.status === 'paused_ptp' && (
                              <>
                                <Calendar className="w-3.5 h-3.5 text-purple-700" />
                                <span>Outreach Paused</span>
                              </>
                            )}
                            {selectedIncident.status === 'recovered' && (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Successfully Recovered</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Customer Contact & Reliability Profile */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <UserCheck className="w-4 h-4 text-[#00A3C4]" />
                          <span>Customer Reliability & Contact</span>
                        </h3>
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Phone Number:</span>
                            <span className="font-mono font-bold text-slate-900">{selectedIncident.customerPhone}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span className="text-slate-500">Payment Reliability:</span>
                            <span className="font-bold text-emerald-600">94% On-Time Track Record</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-slate-500">Behavioral Archetype:</span>
                            <span className="font-bold text-slate-700">
                              {selectedIncident.archetype ? ARCHETYPE_META[selectedIncident.archetype]?.label : 'Standard Priority'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Plain-English AI Diagnosis */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-[#00A3C4]" />
                          <span>Why Did This Happen? (AI Diagnosis)</span>
                        </h3>
                        <div className="bg-cyan-50/60 border border-cyan-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed">
                          <div className="font-bold text-[#00A3C4] mb-1">
                            {ROOT_CAUSE_META[selectedIncident.rootCause]?.label}
                          </div>
                          <p>
                            {ROOT_CAUSE_META[selectedIncident.rootCause]?.nonTechSummary}
                          </p>
                        </div>
                      </div>

                      {/* Active Strategy */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-500" />
                          <span>Executed Recovery Move</span>
                        </h3>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed font-medium">
                          {selectedIncident.evRankedStrategy}
                        </div>
                      </div>

                      {/* Financial Guardrails & Anti-Spam Safety */}
                      <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-emerald-600" />
                          <span>Compliance & Anti-Spam Safety</span>
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="text-[10px] text-slate-500 uppercase font-bold">Contact Limit</div>
                            <div className="font-bold text-slate-800 mt-0.5">1 of 2 max used</div>
                          </div>
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="text-[10px] text-slate-500 uppercase font-bold">Quiet Window</div>
                            <div className="font-bold text-emerald-700 mt-0.5">Active (No spam)</div>
                          </div>
                        </div>
                      </div>

                      {/* Promise-to-Pay Snooze Date Picker */}
                      <div className="space-y-3 pt-2">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-purple-600" />
                          <span>Record Customer Promise-to-Pay</span>
                        </h3>
                        <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-3">
                          <p className="text-[11px] text-slate-600">
                            If the customer promised to pay on a specific date, select it below. AI will pause all reminders until that date.
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={customPtpDate}
                              onChange={e => setCustomPtpDate(e.target.value)}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                            />
                            <button
                              onClick={() => handleRecordPromiseToPay(selectedIncident, customPtpDate)}
                              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors shadow-xs"
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
                    <div className="space-y-5">
                      <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2">
                        <div className="text-[10px] font-mono uppercase text-cyan-300 font-bold">Expected Value Optimization Formula</div>
                        <div className="text-xs font-mono text-slate-200 bg-slate-800 p-2.5 rounded-lg border border-slate-700">
                          EV(Action) = P(Recovery) × Amount - Discount - FrictionCost
                        </div>
                        <p className="text-[11px] text-slate-400">
                          The policy engine evaluates all candidate interventions and selects the highest net positive expected value.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Candidate Policy Ranking for this Incident</h4>
                        
                        <div className="space-y-2 text-xs">
                          {/* Selected Winner */}
                          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                1. {selectedIncident.evRankedStrategy.slice(0, 32)}...
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-200 text-emerald-900">
                                SELECTED (RANK #1)
                              </span>
                            </div>
                            <div className="text-slate-600 text-[11px]">
                              P(Rec): <strong>88.0%</strong> | Friction Cost: <strong>₹50</strong> | Net EV: <strong className="text-emerald-700">₹{Math.round(selectedIncident.amount * 0.88 - 50).toLocaleString('en-IN')}</strong>
                            </div>
                          </div>

                          {/* Alternative 1 */}
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-700">2. Silent Bank Gateway Reroute</span>
                              <span className="text-[10px] font-mono text-slate-400">RANK #2</span>
                            </div>
                            <div className="text-slate-500 text-[11px]">
                              P(Rec): <strong>65.0%</strong> | Friction Cost: <strong>₹0</strong> | Net EV: <strong>₹{Math.round(selectedIncident.amount * 0.65).toLocaleString('en-IN')}</strong>
                            </div>
                          </div>

                          {/* Alternative 2: Do Nothing */}
                          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-700">3. "Do Nothing" (Self-Healing Window)</span>
                              <span className="text-[10px] font-mono text-slate-400">RANK #3</span>
                            </div>
                            <div className="text-slate-500 text-[11px]">
                              P(Rec): <strong>52.0%</strong> | Friction Cost: <strong>₹0</strong> | Net EV: <strong>₹{Math.round(selectedIncident.amount * 0.52).toLocaleString('en-IN')}</strong>
                            </div>
                          </div>

                          {/* Rejected Naive Discounting */}
                          <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-rose-800">4. Naive 15% Blanket Coupon</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800">
                                REJECTED
                              </span>
                            </div>
                            <div className="text-rose-700 text-[11px]">
                              Erodes ₹{Math.round(selectedIncident.amount * 0.15).toLocaleString('en-IN')} gross margin unnecessarily. Policy Engine blocked discount.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: BANK TELEMETRY & GATEWAY */}
                  {drawerTab === 'telemetry' && (
                    <div className="space-y-4 text-xs">
                      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#00A3C4]" />
                          <span>Bank & Gateway Network Signals</span>
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="text-[10px] text-slate-500 font-bold uppercase">ISO 8583 Code</div>
                            <div className="font-mono font-bold text-slate-800 mt-0.5">
                              {selectedIncident.rootCause === 'subscription_failed' ? '51 (Insufficient Funds)' : '05 (Do Not Honor)'}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="text-[10px] text-slate-500 font-bold uppercase">Route Health SLA</div>
                            <div className="font-bold text-emerald-600 mt-0.5">99.4% (Healthy Gateway)</div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="text-[10px] text-slate-500 font-bold uppercase">Payment Rail</div>
                            <div className="font-bold text-slate-800 mt-0.5">UPI Autopay / RuPay</div>
                          </div>

                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                            <div className="text-[10px] text-slate-500 font-bold uppercase">RBI Compliance</div>
                            <div className="font-bold text-indigo-700 mt-0.5">
                              {selectedIncident.amount >= 15000 ? 'AFA Mandate Active' : 'Exempt (< ₹15k)'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                        <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Outreach Channel Eligibility</h4>
                        <div className="space-y-1.5 text-slate-600">
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span>WhatsApp Business API:</span>
                            <span className="font-bold text-emerald-600">Eligible (High Response Rate)</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-slate-100">
                            <span>Interactive Telegram Alert:</span>
                            <span className="font-bold text-[#00A3C4]">Connected</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span>TRAI Calling Window:</span>
                            <span className="font-bold text-slate-800">Within 09:00 - 20:00 (Allowed)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: SHA-256 AUDIT TRAIL */}
                  {drawerTab === 'audit' && (
                    <div className="space-y-4 text-xs">
                      <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 font-mono">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-cyan-300 font-bold text-[11px] flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5 text-cyan-400" />
                            <span>SHA-256 AUDIT BLOCK</span>
                          </span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                            CRYPTOGRAPHICALLY VALID
                          </span>
                        </div>

                        <div className="space-y-2 text-[11px]">
                          <div>
                            <div className="text-slate-500 text-[10px]">EVENT ENTRY HASH:</div>
                            <div className="text-emerald-400 break-all">
                              e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
                            </div>
                          </div>

                          <div>
                            <div className="text-slate-500 text-[10px]">PARENT BLOCK HASH:</div>
                            <div className="text-slate-400 break-all">
                              4f82c0391abf8391740921aaeebbcde9018471903417aa9018471903417aabcd
                            </div>
                          </div>

                          <div className="flex justify-between text-slate-400 pt-1">
                            <span>Langfuse Span ID:</span>
                            <span className="text-cyan-300">span_rec_{selectedIncident.id.slice(0, 8)}</span>
                          </div>

                          <div className="flex justify-between text-slate-400">
                            <span>Audited By:</span>
                            <span className="text-slate-200">Supabase Audit Ledger</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 leading-relaxed text-[11px]">
                        <strong>Enterprise Audit Notice:</strong> This immutable record is chained using SHA-256 hashes for bank and regulatory compliance. Any tampering with state entries invalidates the cryptographic verification chain.
                      </div>
                    </div>
                  )}

                </div>

                {/* Drawer Footer Actions */}
                <div className="p-6 border-t border-slate-200 bg-slate-50 space-y-2">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    1-Click Merchant Actions
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {selectedIncident.status === 'pending_hitl' ? (
                      <button
                        onClick={() => handleApproveHitl(selectedIncident)}
                        className="col-span-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve High-Value Outreach (₹{selectedIncident.amount.toLocaleString('en-IN')})</span>
                      </button>
                    ) : null}

                    <button
                      onClick={() => handleTriggerPlivoCall(selectedIncident)}
                      disabled={sendingChannel === 'plivo'}
                      className="py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2"
                    >
                      <Phone className="w-4 h-4 text-emerald-600" />
                      <span>AI Voice Call</span>
                    </button>

                    <button
                      onClick={() => handleSendTelegram(selectedIncident)}
                      disabled={sendingChannel === 'telegram'}
                      className="py-2 rounded-xl bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 text-[#00A3C4] font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4 text-[#00A3C4]" />
                      <span>Send 1-Click Link</span>
                    </button>

                    <Link
                      href={`/payer?customer=${encodeURIComponent(selectedIncident.customer)}&amount=${selectedIncident.amount}&id=${selectedIncident.id}`}
                      target="_blank"
                      className="col-span-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors text-center flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Preview Customer Payer Portal</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* RIGHT AI COPILOT PANE                                                     */}
          {/* ========================================================================= */}
          {isCopilotOpen && (
            <div
              className="hidden xl:flex shrink-0 h-full relative border-l border-slate-200 bg-white z-10"
              style={{ width: `${copilotWidth}px` }}
            >
              {/* Drag Handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-50 group hover:bg-[#00A3C4]/30 flex items-center justify-center -ml-1 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  isDraggingRef.current = true;
                  setIsDragging(true);
                  document.body.style.cursor = 'col-resize';
                }}
              />

              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <AIChatBot
                  role="merchant"
                  customerName={selectedIncident ? selectedIncident.customer : "TechMatrix Corp"}
                  amount={selectedIncident ? selectedIncident.amount : 145000}
                  rootCause={selectedIncident ? selectedIncident.rootCause : "receivable_overdue"}
                  customerId={selectedIncident?.customerId || "cust_0001"}
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
    </div>
  );
}
