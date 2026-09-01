import React from 'react';
import { theme } from '@/lib/theme';

export type RootCauseType =
  | 'payment_degraded'
  | 'mandate_auth_failed'
  | 'subscription_failed'
  | 'checkout_abandoned'
  | 'receivable_overdue'
  | 'promise_to_pay';

export type IncidentStatus = 'pending_hitl' | 'auto_recovering' | 'paused_ptp' | 'recovered';

export type MainView =
  | 'queue'
  | 'checkout_funnel'
  | 'subscription_churn'
  | 'b2b_receivables'
  | 'mandates_scheme'
  | 'ptp_forecast'
  | 'decline_taxonomy';

export type DrawerTab = 'overview' | 'ev_math' | 'telemetry' | 'audit';

export interface Incident {
  id: string;
  customer: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId?: string;
  merchantId?: string;
  amount: number;
  rootCause: RootCauseType;
  evRankedStrategy: string;
  status: IncidentStatus;
  maxAttempts: number;
  currentAttempts: number;
  duplicateContactBreaches: number;
  link?: string;
  paymentLink?: string;
  archetype?: string;
  dataSource?: string;
  synthetic?: boolean;
  createdAt?: string;
  metadata?: Record<string, any>;
  history?: Record<string, any>;
}


export interface RootCauseMeta {
  label: string;
  badgeColor: string;
  textColor: string;
  accentBg: string;
  description: string;
  nonTechSummary: string;
}

export interface ArchetypeMeta {
  label: string;
  tagColor: string;
  explanation: string;
}

// Domain-Specific Color Coding referencing centralized theme
export const ROOT_CAUSE_META: Record<RootCauseType, RootCauseMeta> = {
  payment_degraded: {
    label: 'Bank Route Outage',
    badgeColor: theme.badge.blue,
    textColor: 'text-blue-700',
    accentBg: 'bg-blue-500',
    description: 'Bank or gateway route degraded. Silent reroute triggered without contacting customer.',
    nonTechSummary: 'The customer’s bank server experienced a temporary drop. The AI automatically rerouted the payment through a healthy bank gateway without sending disturbing messages to the customer.',
  },
  mandate_auth_failed: {
    label: 'RBI >₹15k Approval Needed',
    badgeColor: theme.badge.indigo,
    textColor: 'text-indigo-700',
    accentBg: 'bg-indigo-500',
    description: 'RBI regulations require 2FA approval for recurring charges above ₹15,000.',
    nonTechSummary: 'Because this recurring charge is over ₹15,000, RBI regulations mandate customer authorization. A secure 1-click re-approval link was sent to their WhatsApp.',
  },
  subscription_failed: {
    label: 'Subscription Renewal Failed',
    badgeColor: theme.badge.purple,
    textColor: 'text-purple-700',
    accentBg: 'bg-purple-500',
    description: 'Recurring auto-debit declined (e.g. salary cycle timing or temporary card issue).',
    nonTechSummary: 'The customer’s recurring payment did not go through. Active users receive a 14-day grace period, while dormant accounts are offered a flexible pause option.',
  },
  checkout_abandoned: {
    label: 'Checkout Cart Dropped',
    badgeColor: theme.badge.amber,
    textColor: 'text-amber-700',
    accentBg: 'bg-amber-500',
    description: 'Customer left cart at checkout step. AI diagnoses if it was a technical glitch or window shopping.',
    nonTechSummary: 'The shopper left items in their cart. For technical glitches, a 1-click resume link is sent. For window shoppers, discounts are withheld to protect your profit margin.',
  },
  receivable_overdue: {
    label: 'Overdue B2B Invoice',
    badgeColor: theme.badge.rose,
    textColor: 'text-rose-700',
    accentBg: 'bg-rose-500',
    description: 'Unpaid corporate invoice past net payment terms.',
    nonTechSummary: 'An invoice is past its due date. Amounts under ₹1 Lakh receive automated polite reminders; amounts ₹1 Lakh and above are held for your 1-click supervisor approval.',
  },
  promise_to_pay: {
    label: 'Promise-to-Pay Scheduled',
    badgeColor: theme.badge.emerald,
    textColor: 'text-emerald-700',
    accentBg: 'bg-emerald-500',
    description: 'Customer agreed to pay on a specific date. All recovery reminders are paused.',
    nonTechSummary: 'The customer confirmed a date when they will make this payment. The AI has paused all automated messages to honor their commitment.',
  },
};

// Plain-English Behavioral Archetypes referencing centralized theme
export const ARCHETYPE_META: Record<string, ArchetypeMeta> = {
  involuntary_churn_engaged: {
    label: 'Active Subscriber (Grace Period)',
    tagColor: theme.badge.purple,
    explanation: 'Highly engaged customer. Granted a 14-day grace period with scheduled retry aligned to Friday salary cycle.',
  },
  voluntary_churn_disengaged: {
    label: 'Dormant Account (Off-Ramp)',
    tagColor: theme.badge.neutral,
    explanation: 'Inactive for >45 days. Offered a graceful pause or plan downgrade instead of aggressive payment reminders.',
  },
  comparison_window_shopping: {
    label: 'Window Shopper (Margin Shield)',
    tagColor: theme.badge.amber,
    explanation: 'Shopper frequently abandons carts looking for coupons. Zero discount given to protect your profit margin.',
  },
  technical_form_friction: {
    label: 'Mobile Form Glitch (1-Click Resume)',
    tagColor: theme.badge.blue,
    explanation: 'Encountered payment input field timeout on mobile. Received a 1-click Razorpay direct link.',
  },
};
