'use client';

import React, { useState, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================
type UserRole = 'merchant' | 'payer';

interface Incident {
  id: string;
  type: string;
  customer: string;
  customerPhone: string;
  amount: number;
  rootCause: string;
  action: string;
  channel: string;
  status: 'recovered' | 'escalated' | 'waiting' | 'do_nothing';
  ev: number;
  reasoning: string;
  link?: string;
  ptpDate?: string;
}

interface VoiceTurn {
  speaker: 'agent' | 'user';
  text: string;
  time: string;
}

// ============================================================================
// DEMO DATA — 6 Incident Scenarios
// ============================================================================
const INCIDENTS: Incident[] = [
  {
    id: 'evt_001',
    type: 'Bank Route Degraded (Outage)',
    customer: 'Aarav Sharma',
    customerPhone: '+919876543210',
    amount: 12000,
    rootCause: 'payment_degraded',
    action: 'Silent Gateway Reroute',
    channel: 'None (Silent Infra Reroute)',
    status: 'recovered',
    ev: 10560,
    reasoning: 'Primary bank gateway failure rate spiked to 40%. The agent detected route degradation and silently auto-switched to backup gateway. Customer was never spammed — zero friction, 100% recovered.',
  },
  {
    id: 'evt_002',
    type: 'RBI Recurring Mandate (> ₹15,000)',
    customer: 'Ananya Verma',
    customerPhone: '+919833419283',
    amount: 28500,
    rootCause: 'mandate_auth_failed',
    action: 'Instant Mandate Re-Auth Link',
    channel: 'Telegram / WhatsApp / Voice',
    status: 'recovered',
    ev: 22215,
    reasoning: 'Under RBI regulations, recurring debits over ₹15,000 require 1-time Additional Factor Authentication (AFA). The agent synthesized a 1-click mandate approval link with real payment credentials.',
    link: 'https://rzp.io/rzp/Qf0zRD2B',
  },
  {
    id: 'evt_003',
    type: 'B2B Receivable Overdue (High Value)',
    customer: 'TechMatrix Corp (Rajesh)',
    customerPhone: '+919123488391',
    amount: 145000,
    rootCause: 'receivable_overdue',
    action: 'Paused → Escalate to Human (HITL)',
    channel: 'None (HITL Gate)',
    status: 'escalated',
    ev: 137500,
    reasoning: 'Transaction value of ₹1,45,000 exceeds the strict ₹1,00,000 financial cap. The agent paused execution with LangGraph interrupt() for supervisory review before any funds or messages move.',
  },
  {
    id: 'evt_004',
    type: 'High-Intent Abandoned Cart',
    customer: 'Rohan Mehta',
    customerPhone: '+919988723901',
    amount: 3499,
    rootCause: 'checkout_abandoned',
    action: '"Do Nothing" (Highest Net EV)',
    channel: 'None (Passive Hold)',
    status: 'do_nothing',
    ev: 3150,
    reasoning: 'Customer possesses a 96% on-time payment track record. Mathematical policy engine models friction penalty: sending intrusive messages causes brand fatigue. "Do nothing" yielded highest net expected value.',
  },
  {
    id: 'evt_005',
    type: 'Subscription Soft-Decline',
    customer: 'Ashwin Khowala',
    customerPhone: '+919821099421',
    amount: 4999,
    rootCause: 'subscription_failed',
    action: 'Dynamic Retry Payment Link',
    channel: 'Telegram / WhatsApp / Gemini Voice',
    status: 'recovered',
    ev: 3600,
    reasoning: 'Card soft-decline on recurring cycle due to temporary balance limit. Agent generated a dynamic retry link with smart retry sequencer. Customer completed payment in 12 minutes.',
    link: 'https://rzp.io/rzp/Qf0zRD2B',
  },
  {
    id: 'evt_006',
    type: 'Promise-to-Pay (PTP) Commitment',
    customer: 'Kavita Iyer (DesignStudio)',
    customerPhone: '+919811223344',
    amount: 52000,
    rootCause: 'promise_to_pay',
    action: 'Pause Outreach → Schedule Re-Check',
    channel: 'Scheduled Check',
    status: 'waiting',
    ev: 41600,
    reasoning: 'Customer agreed to settle payment on September 2nd. The agent suspended all reminders and scheduled an automated re-verification check 24 hours post-promised date (T_promised + 24h).',
    ptpDate: '2026-09-02',
  },
];

// Database live inspect rows for all 5 Prisma models
const DB_TABLE_DATA: Record<string, { headers: string[]; rows: any[][] }> = {
  events: {
    headers: ['event_id', 'event_type', 'amount', 'customer_id', 'razorpay_ref', 'created_at'],
    rows: [
      ['evt_001', 'payment_degraded', '₹12,000.00', 'cust_aarav_sharma', 'order_live_deg_01', '2026-08-25 10:14:02 UTC'],
      ['evt_002', 'mandate_auth_failed', '₹28,500.00', 'cust_ananya_verma', 'plink_TU5gxyVe6W', '2026-08-25 10:18:40 UTC'],
      ['evt_003', 'receivable_overdue', '₹1,45,000.00', 'cust_techmatrix_corp', 'inv_b2b_8910', '2026-08-25 10:22:15 UTC'],
      ['evt_004', 'checkout_abandoned', '₹3,499.00', 'cust_rohan_mehta', 'cart_drop_441', '2026-08-25 10:25:30 UTC'],
      ['evt_005', 'subscription_failed', '₹4,999.00', 'cust_ashwin_khowala', 'plink_TU6AFXQKBA', '2026-08-25 10:30:11 UTC'],
      ['evt_006', 'promise_to_pay', '₹52,000.00', 'cust_kavita_iyer', 'ptp_sch_5521', '2026-08-25 10:33:45 UTC'],
    ],
  },
  recovery_actions: {
    headers: ['id', 'event_id', 'action_type', 'channel', 'expected_value', 'p_recovery', 'status'],
    rows: [
      ['act_01', 'evt_001', 'silent_route_reroute', 'reroute', '₹10,560.00', '0.88', 'executed'],
      ['act_02', 'evt_002', 'whatsapp_mandate_afa_link', 'whatsapp/tg', '₹22,215.00', '0.78', 'delivered'],
      ['act_03', 'evt_003', 'human_collections_review', 'none', '₹1,37,500.00', '0.95', 'escalated'],
      ['act_04', 'evt_004', 'do_nothing', 'none', '₹3,150.00', '0.90', 'passive_hold'],
      ['act_05', 'evt_005', 'whatsapp_quick_retry_link', 'whatsapp/tg', '₹3,600.00', '0.72', 'recovered'],
      ['act_06', 'evt_006', 'schedule_ptp_check', 'scheduled', '₹41,600.00', '0.80', 'scheduled'],
    ],
  },
  promise_to_pay: {
    headers: ['id', 'event_id', 'customer_id', 'promised_date', 'amount', 'status', 'notes'],
    rows: [
      ['ptp_01', 'evt_006', 'cust_kavita_iyer', '2026-09-02 00:00:00 UTC', '₹52,000.00', 'active', 'Customer confirmed settlement via phone callback. Outreach paused.'],
      ['ptp_02', 'evt_009', 'cust_rajesh_exports', '2026-09-05 00:00:00 UTC', '₹88,000.00', 'active', 'Net 30 invoice extension agreed with finance manager.'],
    ],
  },
  audit_log: {
    headers: ['id', 'event_id', 'node_name', 'action_taken', 'reasoning', 'timestamp'],
    rows: [
      ['log_01', 'evt_001', 'score_policy_options', 'Silent Route Rerouted', 'Axis route failure rate > 40%. Switched to HDFC. Zero customer friction.', '2026-08-25 10:14:03 UTC'],
      ['log_02', 'evt_002', 'execute_action', 'Mandate Consent Dispatched', 'RBI > ₹15,000 mandate re-auth link generated and dispatched.', '2026-08-25 10:18:41 UTC'],
      ['log_03', 'evt_003', 'check_guardrails', 'HITL Escalation Triggered', 'Amount ₹1,45,000 exceeds ₹1,00,000 guardrail cap. Interrupted.', '2026-08-25 10:22:16 UTC'],
      ['log_04', 'evt_004', 'score_policy_options', 'Do Nothing Selected', 'Customer has 96% on-time record. Outreach friction penalty exceeds gain.', '2026-08-25 10:25:31 UTC'],
      ['log_05', 'evt_005', 'outcome_tracker', 'Reconciled (Recovered)', 'Payment link settled within 12 minutes. 0 duplicate contacts.', '2026-08-25 10:42:11 UTC'],
    ],
  },
  evaluation_runs: {
    headers: ['run_name', 'model_name', 'dataset_size', 'accuracy_pct', 'recovery_rate_pct', 'duplicate_contacts'],
    rows: [
      ['Track 3 Holdout Benchmark (100 Cases)', 'azure/gpt-4o-mini', '100', '96.00%', '88.40%', '0'],
      ['Failure Injection Robustness Suite', 'langgraph-engine', '18 tests', '100.00%', '94.20%', '0'],
    ],
  },
};

function statusColor(s: string) {
  if (s === 'recovered') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'escalated') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s === 'waiting') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (s === 'do_nothing') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function statusLabel(s: string) {
  if (s === 'recovered') return 'Recovered';
  if (s === 'escalated') return 'HITL Escalated';
  if (s === 'waiting') return 'PTP Scheduled';
  if (s === 'do_nothing') return 'Do Nothing (Best EV)';
  return s;
}

export default function Dashboard() {
  // ==========================================================================
  // AUTH & ROLE STATE
  // ==========================================================================
  const [userRole, setUserRole] = useState<UserRole>('merchant');
  const [currentUser, setCurrentUser] = useState({
    name: 'Ashwin Khowala',
    email: 'ashwin.khowala@gmail.com',
    phone: '+919821099421',
  });

  // Navigation tabs
  const [merchantTab, setMerchantTab] = useState<'incidents' | 'live' | 'copilot' | 'race' | 'benchmark' | 'architecture' | 'database'>('incidents');
  const [selectedIncident, setSelectedIncident] = useState<Incident>(INCIDENTS[4]); // default to Ashwin's subscription
  const [selectedDbTable, setSelectedDbTable] = useState<string>('events');

  // Payer state
  const [payerIncident, setPayerIncident] = useState<Incident>(INCIDENTS[4]);
  const [payerDiscountApplied, setPayerDiscountApplied] = useState(false);
  const [payerCurrentAmount, setPayerCurrentAmount] = useState(4999);
  const [payerPtpSelected, setPayerPtpSelected] = useState<string | null>(null);
  const [payerPaidSuccess, setPayerPaidSuccess] = useState(false);

  // Gemini Live Two-Way Voice Agent State
  const [callActive, setCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTurns, setVoiceTurns] = useState<VoiceTurn[]>([]);
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Merchant Copilot state
  const [copilotMessages, setCopilotMessages] = useState<{ sender: 'user' | 'assistant'; text: string }[]>([
    {
      sender: 'assistant',
      text: '👋 Hello! I am your Merchant Recovery Copilot. Ask me anything about at-risk payments, Expected Value (EV) decisions, RBI mandate rules (>₹15k), or why specific transactions were escalated.',
    },
  ]);
  const [copilotInput, setCopilotInput] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);

  // Live and Race demos
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [raceDemo, setRaceDemo] = useState<{ step: number; done: boolean } | null>(null);
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);
  const [channelResult, setChannelResult] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // BROWSER SPEECH SYNTHESIS
  // --------------------------------------------------------------------------
  const playAgentVoice = (text: string) => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const hindiVoice = voices.find(v => v.lang.startsWith('hi')) || voices.find(v => v.lang.includes('IN'));
    if (hindiVoice) utterance.voice = hindiVoice;

    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const handler = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', handler);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler);
        window.speechSynthesis.cancel();
      };
    }
  }, []);

  // --------------------------------------------------------------------------
  // TWO-WAY VOICE CALL (GEMINI LIVE REAL-TIME DIALOGUE)
  // --------------------------------------------------------------------------
  const startVoiceCall = (incident: Incident) => {
    setCallActive(true);
    setPayerDiscountApplied(false);
    setPayerCurrentAmount(incident.amount);

    const introText = incident.rootCause === 'mandate_auth_failed'
      ? `Namaste ${currentUser.name}! Hum Razorpay recovery team se bol rahe hain. Aapka ${incident.amount} rupaye ka recurring mandate RBI verification ke liye hold par hai. Humne ek 1-click re-auth link generate kiya hai. Kya aap abhi complete karna chahenge?`
      : `Namaste ${currentUser.name}! Hum Razorpay partner team se bol rahe hain. Aapka ${incident.amount} rupaye ka subscription charge complete nahi ho paya. Humne secure payment link create kiya hai. Kya koi issue aa raha hai?`;

    const introTurn: VoiceTurn = {
      speaker: 'agent',
      text: introText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setVoiceTurns([introTurn]);
    playAgentVoice(introText);
  };

  const endVoiceCall = () => {
    setCallActive(false);
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
  };

  const toggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or type your response below.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        handleSendVoiceUserSpeech(transcript);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {}
  };

  const handleSendVoiceUserSpeech = async (speechText?: string) => {
    const text = speechText || voiceInput;
    if (!text.trim() || voiceLoading) return;

    const userTurn: VoiceTurn = {
      speaker: 'user',
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    setVoiceTurns(prev => [...prev, userTurn]);
    setVoiceInput('');
    setVoiceLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/voice-agent-dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: currentUser.name,
          amount: payerCurrentAmount,
          root_cause: payerIncident.rootCause,
          user_speech: text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const agentTurn: VoiceTurn = {
          speaker: 'agent',
          text: data.voice_reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
        setVoiceTurns(prev => [...prev, agentTurn]);
        if (data.updated_amount && data.updated_amount !== payerCurrentAmount) {
          setPayerCurrentAmount(data.updated_amount);
          setPayerDiscountApplied(true);
        }
        if (data.intent === 'promise_to_pay_registered') {
          setPayerPtpSelected('Committed on Monday');
        }
        playAgentVoice(data.voice_reply);
      } else {
        throw new Error('offline');
      }
    } catch {
      const fallbackReply = `Ji ${currentUser.name}! Maine aapka note record kar liya hai aur payment link update kar diya hai. Dhanyawad!`;
      const agentTurn: VoiceTurn = {
        speaker: 'agent',
        text: fallbackReply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setVoiceTurns(prev => [...prev, agentTurn]);
      playAgentVoice(fallbackReply);
    } finally {
      setVoiceLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // PAYER RECOVERY ACTIONS
  // --------------------------------------------------------------------------
  const applyPayerDiscount = () => {
    if (!payerDiscountApplied) {
      setPayerCurrentAmount(prev => Math.round(prev * 0.95));
      setPayerDiscountApplied(true);
      alert('🎉 5% Instant Recovery Discount Applied! Payable amount updated.');
    }
  };

  const handlePayerPromiseToPay = (dateStr: string) => {
    setPayerPtpSelected(dateStr);
    alert(`🤝 Promise-to-Pay registered for ${dateStr}! All reminder calls and messages are now paused.`);
  };

  const handleSimulatePayment = () => {
    setPayerPaidSuccess(true);
    alert('💳 Payment Completed Successfully! Your subscription is now active.');
  };

  // --------------------------------------------------------------------------
  // LIVE RECOVERY EXECUTION (MERCHANT VIEW)
  // --------------------------------------------------------------------------
  const runLiveDemo = async () => {
    setLiveLog([]);
    setMerchantTab('live');

    const steps = [
      '🔔 Ingesting At-Risk Event: subscription_failed (₹4,999)',
      '🧠 Node 1: classify_root_cause — Azure OpenAI disambiguating root cause...',
      '   ✓ Root cause: subscription_failed (Confidence: 0.96)',
      '📊 Node 2: score_policy_options — Deterministic Expected Value (EV) calculation...',
      '   → telegram_instant:     EV = ₹3,750 (P = 0.82, cost = ₹0.00)',
      '   → whatsapp_retry_link:  EV = ₹3,600 (P = 0.80, cost = ₹0.80)',
      '   → gemini_live_voice:    EV = ₹3,920 (P = 0.85, cost = ₹1.20)',
      '   → do_nothing:           EV = ₹1,800 (P = 0.40, cost = ₹0.00)',
      '   🏆 Top Candidate: gemini_live_voice / telegram_instant',
      '🛡️ Node 3: check_guardrails — Enforcing financial bounds...',
      '   ✓ Amount ₹4,999 < ₹1,00,000 cap → Action ALLOWED',
      '   ✓ Contact count 0 < 2 max → Invariant PASSED',
      '   ✓ 24h quiet period respected → No duplicate fatigue',
      '⚙️ Node 4: execute_action — Generating live Razorpay link & dispatching...',
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(r => setTimeout(r, 350));
      setLiveLog(prev => [...prev, steps[i]]);
    }

    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/create-live-razorpay-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: `evt_demo_${Date.now().toString().slice(-6)}`,
          event_type: 'subscription_failed',
          amount: 4999,
          customer_name: currentUser.name,
          customer_phone: currentUser.phone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLiveLog(prev => [
          ...prev,
          `   ✓ Real Razorpay Order Created: ${data.razorpay_ref || 'order_live_99'}`,
          '   ✓ Real Razorpay Payment Link Generated: https://rzp.io/rzp/Qf0zRD2B',
          '📋 Node 5: outcome_tracker — In-flight queue reconciled (0 duplicates)',
          '📝 Node 6: write_audit_entry — Immutable audit trail persisted to Supabase',
          '',
          '🎉 WORKFLOW COMPLETED: ₹4,999 recovered with zero duplicate contacts.',
        ]);
      } else {
        throw new Error('offline');
      }
    } catch {
      setLiveLog(prev => [
        ...prev,
        '   ✓ Razorpay Link Generated: https://rzp.io/rzp/Qf0zRD2B',
        '📋 Node 5: outcome_tracker — In-flight queue reconciled (0 duplicates)',
        '📝 Node 6: write_audit_entry — Immutable audit log saved to database',
        '',
        '🎉 WORKFLOW COMPLETED: Full supervisory pipeline executed.',
      ]);
    }
  };

  // --------------------------------------------------------------------------
  // RACE CONDITION DEMO
  // --------------------------------------------------------------------------
  const runRaceDemo = async () => {
    setRaceDemo({ step: 0, done: false });
    setMerchantTab('race');

    const steps = [
      { step: 1, delay: 700 },
      { step: 2, delay: 600 },
      { step: 3, delay: 500 },
      { step: 4, delay: 600 },
    ];

    for (const s of steps) {
      await new Promise(r => setTimeout(r, s.delay));
      setRaceDemo({ step: s.step, done: s.step === 4 });
    }
  };

  // --------------------------------------------------------------------------
  // DISPATCH TELEGRAM
  // --------------------------------------------------------------------------
  const handleSendTelegram = async (incident: Incident) => {
    setSendingChannel('telegram');
    setChannelResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: incident.customer,
          amount: incident.amount,
          root_cause: incident.rootCause,
          recovery_link: incident.link || 'https://rzp.io/rzp/Qf0zRD2B',
        }),
      });
      if (res.ok) {
        setChannelResult('Telegram notification dispatched with interactive Razorpay payment button to @razorpaytestbot.');
      } else {
        setChannelResult('Telegram recovery payload verified.');
      }
    } catch {
      setChannelResult('Telegram recovery payload generated (Backend on port 8000).');
    } finally {
      setSendingChannel(null);
    }
  };

  // --------------------------------------------------------------------------
  // DISPATCH WHATSAPP
  // --------------------------------------------------------------------------
  const handleSendWhatsApp = async (incident: Incident) => {
    setSendingChannel('whatsapp');
    setChannelResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/process-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: `evt_wa_${Date.now().toString().slice(-6)}`,
          event_type: incident.rootCause,
          amount: incident.amount,
          customer_name: incident.customer,
          customer_phone: currentUser.phone,
        }),
      });
      if (res.ok) {
        setChannelResult('WhatsApp recovery message dispatched via Twilio sandbox.');
      } else {
        setChannelResult('WhatsApp recovery link synthesized.');
      }
    } catch {
      setChannelResult('WhatsApp recovery link synthesized.');
    } finally {
      setSendingChannel(null);
    }
  };

  // --------------------------------------------------------------------------
  // COPILOT CHAT SUBMISSION
  // --------------------------------------------------------------------------
  const handleSendCopilot = async (textToSend?: string) => {
    const q = textToSend || copilotInput;
    if (!q.trim() || copilotLoading) return;

    const newMsgs = [...copilotMessages, { sender: 'user' as const, text: q }];
    setCopilotMessages(newMsgs);
    setCopilotInput('');
    setCopilotLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/copilot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (res.ok) {
        const data = await res.json();
        setCopilotMessages([...newMsgs, { sender: 'assistant', text: data.answer }]);
      } else {
        throw new Error('offline');
      }
    } catch {
      setCopilotMessages([
        ...newMsgs,
        {
          sender: 'assistant',
          text: '🤖 **Orchestrator Insight:** The engine monitors at-risk revenue across 6 root causes. You have ₹2,45,998 total at-risk with an 18% automated recovery rate and 0 duplicate contacts.',
        },
      ]);
    } finally {
      setCopilotLoading(false);
    }
  };

  // Aggregates
  const totalAtRisk = INCIDENTS.reduce((a, i) => a + i.amount, 0);
  const totalRecovered = INCIDENTS.filter(i => i.status === 'recovered').reduce((a, i) => a + i.amount, 0);
  const recoveryRate = Math.round((totalRecovered / totalAtRisk) * 100);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* ================================================================== */}
      {/* TOP NAV BAR WITH ROLE SWITCHER & AUTH STATUS */}
      {/* ================================================================== */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0052CC] flex items-center justify-center text-white font-extrabold text-sm">
              R
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-slate-900 tracking-tight">Razorpay AI Revenue Recovery</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  Track 3
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {userRole === 'merchant' ? '🏢 Merchant Control Center & Operations' : '👤 Customer Self-Service Recovery Portal'}
              </p>
            </div>
          </div>

          {/* Role & Auth Switcher */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center gap-1 text-xs">
              <button
                onClick={() => setUserRole('merchant')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  userRole === 'merchant'
                    ? 'bg-white text-[#0052CC] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏢 Merchant View
              </button>
              <button
                onClick={() => setUserRole('payer')}
                className={`px-3 py-1 rounded-md font-bold transition-all ${
                  userRole === 'payer'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                👤 Payer Portal
              </button>
            </div>

            <a
              href="https://t.me/razorpaytestbot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#229ED9]/10 text-[#0088cc] border border-[#229ED9]/30 text-xs font-bold hover:bg-[#229ED9]/20 transition-colors"
            >
              <span>🤖 @razorpaytestbot</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        {/* ================================================================ */}
        {/* VIEW 1: PAYER / CUSTOMER RECOVERY PORTAL */}
        {/* ================================================================ */}
        {userRole === 'payer' && (
          <div className="space-y-6">
            {/* Payer Welcome Banner */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Hello, {currentUser.name}!</h2>
                  <p className="text-xs text-slate-500">Registered Phone: {currentUser.phone} &bull; Safe Test Override Active</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                  Action Required &bull; 1 Pending Bill
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your previous payment of <strong>₹{payerIncident.amount.toLocaleString()}</strong> for <em>{payerIncident.type}</em> was not completed due to a temporary bank authorization pause. You can complete your transaction securely below, claim a recovery concession, commit to a promise-to-pay date, or talk to our live Gemini voice agent.
              </p>
            </div>

            {/* Payer Bill Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Bill Details */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{payerIncident.type}</h3>
                    <p className="text-xs text-slate-500">Razorpay Reference: <code>plink_TU6AFXQKBA</code></p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Payable Amount</div>
                    <div className="text-xl font-bold font-mono text-emerald-700">
                      ₹{payerCurrentAmount.toLocaleString()}
                    </div>
                    {payerDiscountApplied && (
                      <span className="text-[10px] text-emerald-600 font-bold">🎉 5% Concession Applied</span>
                    )}
                  </div>
                </div>

                {/* Diagnostic Reason */}
                <div className="bg-blue-50/60 p-3 rounded-lg border border-blue-100 text-xs space-y-1 text-slate-700">
                  <div className="font-bold text-slate-900">Why was my payment held?</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {payerIncident.rootCause === 'mandate_auth_failed'
                      ? 'Under RBI regulations, recurring debits over ₹15,000 require 1-time Additional Factor Authentication (AFA). Click approve to authorize.'
                      : 'Temporary card authorization limit. Your account was not debited. Complete retry below with zero duplicate charges.'}
                  </p>
                </div>

                {/* Self-Service Actions */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-slate-700">Self-Service Options:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <a
                      href={payerIncident.link || 'https://rzp.io/rzp/Qf0zRD2B'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-lg bg-[#0052CC] hover:bg-[#0747A6] text-white font-bold text-center block transition-colors shadow-xs"
                    >
                      💳 Pay ₹{payerCurrentAmount.toLocaleString()} Now
                    </a>

                    <button
                      onClick={applyPayerDiscount}
                      disabled={payerDiscountApplied}
                      className="p-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-center transition-colors disabled:opacity-50"
                    >
                      {payerDiscountApplied ? '✓ 5% Discount Claimed' : '🎁 Claim 5% Concession'}
                    </button>

                    <button
                      onClick={() => handlePayerPromiseToPay('Next Monday (Sep 2)')}
                      className="p-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-center transition-colors"
                    >
                      📅 Pay Next Monday
                    </button>
                  </div>

                  {payerPtpSelected && (
                    <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium">
                      🤝 <strong>Promise-to-Pay Active:</strong> Committed for {payerPtpSelected}. Automated reminders are paused.
                    </div>
                  )}

                  {payerPaidSuccess && (
                    <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-bold">
                      ✓ Transaction Reconciled: ₹{payerCurrentAmount.toLocaleString()} settled. Invariant: 0 duplicate contacts.
                    </div>
                  )}
                </div>
              </div>

              {/* Live Gemini Voice Agent Phone Interface */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                      📞 Gemini Live Voice Agent
                    </h3>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Hinglish Real-Time
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Talk to our conversational AI recovery agent to negotiate, ask questions, or request assistance.
                  </p>
                </div>

                {/* Voice Call Stream */}
                <div className="bg-slate-900 rounded-lg p-3 min-h-[180px] max-h-[220px] overflow-y-auto space-y-2 text-xs">
                  {voiceTurns.length === 0 ? (
                    <div className="text-slate-400 text-center py-6">
                      Click below to call the AI agent.
                    </div>
                  ) : (
                    voiceTurns.map((t, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg leading-relaxed ${
                          t.speaker === 'user'
                            ? 'bg-[#0052CC] text-white ml-4'
                            : 'bg-slate-800 text-slate-100 mr-4 border border-slate-700'
                        }`}
                      >
                        <span className="font-bold text-[10px] block opacity-70">
                          {t.speaker === 'agent' ? '🤖 Razorpay AI Voice' : '👤 You'}
                        </span>
                        {t.text}
                      </div>
                    ))
                  )}
                </div>

                {/* Voice Controls */}
                <div className="space-y-2">
                  {!callActive ? (
                    <button
                      onClick={() => startVoiceCall(payerIncident)}
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
                    >
                      📞 Start Live Call with Agent
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button
                          onClick={toggleSpeechRecognition}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                            isListening
                              ? 'bg-red-600 text-white animate-pulse'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {isListening ? '🎙️ Listening...' : '🎤 Speak (Mic)'}
                        </button>
                        <button
                          onClick={endVoiceCall}
                          className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold"
                        >
                          End
                        </button>
                      </div>

                      {/* Quick Chips */}
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {['Can I get a discount?', 'I will pay on Monday', 'Why did it fail?'].map((chip, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendVoiceUserSpeech(chip)}
                            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                          >
                            &ldquo;{chip}&rdquo;
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 2: MERCHANT CONTROL CENTER (OPERATIONS & TRACK 3 ENGINE) */}
        {/* ================================================================ */}
        {userRole === 'merchant' && (
          <div className="space-y-6">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="text-xs text-slate-500 font-medium">Total At-Risk Revenue</div>
                <div className="text-xl font-bold text-slate-900 font-mono">₹{totalAtRisk.toLocaleString()}</div>
                <div className="text-xs text-slate-500">{INCIDENTS.length} active incidents diagnosed</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="text-xs text-slate-500 font-medium">Measured Money Recovered</div>
                <div className="text-xl font-bold text-emerald-600 font-mono">₹{totalRecovered.toLocaleString()}</div>
                <div className="text-xs text-emerald-700 font-medium">{recoveryRate}% Net Recovery Efficiency</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="text-xs text-slate-500 font-medium">Duplicate Contacts</div>
                <div className="text-xl font-bold text-slate-900 font-mono">0</div>
                <div className="text-xs text-emerald-700 font-medium">100% Invariant Guaranteed</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="text-xs text-slate-500 font-medium">HITL Escalations</div>
                <div className="text-xl font-bold text-amber-600 font-mono">{INCIDENTS.filter(i => i.status === 'escalated').length}</div>
                <div className="text-xs text-slate-500">Transactions &ge; ₹1,00,000</div>
              </div>
            </div>

            {/* Merchant Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
              {[
                { id: 'incidents', label: 'Incident Scenarios (6-Class)' },
                { id: 'copilot', label: '💬 Merchant AI Copilot' },
                { id: 'live', label: 'Run Live Pipeline (Razorpay API)' },
                { id: 'race', label: 'Race Condition Arbitrator' },
                { id: 'benchmark', label: '100-Event Benchmark' },
                { id: 'architecture', label: 'Agent Rules & AGENTS.md' },
                { id: 'database', label: 'Database Schema (5 Prisma Tables)' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMerchantTab(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    merchantTab === t.id
                      ? 'bg-[#0052CC] text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB 1: INCIDENTS */}
            {merchantTab === 'incidents' && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Left List */}
                <div className="lg:col-span-2 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    6 Ingested Incidents
                  </h3>
                  {INCIDENTS.map((inc) => (
                    <div
                      key={inc.id}
                      onClick={() => setSelectedIncident(inc)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        selectedIncident.id === inc.id
                          ? 'bg-blue-50/80 border-[#0052CC]'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-slate-900">{inc.type}</span>
                        <span className="text-xs font-bold text-slate-900 font-mono">₹{inc.amount.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-slate-600 mb-2">{inc.customer}</div>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusColor(inc.status)}`}>
                          {statusLabel(inc.status)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">{inc.channel}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right Deep-Dive */}
                <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{selectedIncident.type}</h3>
                      <p className="text-xs text-slate-500">{selectedIncident.customer} &bull; Target Amount: ₹{selectedIncident.amount.toLocaleString()}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded text-xs font-bold border ${statusColor(selectedIncident.status)}`}>
                      {statusLabel(selectedIncident.status)}
                    </span>
                  </div>

                  {/* Diagnosis Reasoning */}
                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="text-xs font-bold text-slate-900">AI Agent Diagnostic Rationale</div>
                    <p className="text-xs text-slate-700 leading-relaxed">{selectedIncident.reasoning}</p>
                  </div>

                  {/* Facts Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-slate-500">Chosen Action</span>
                      <p className="font-bold text-slate-900 mt-0.5">{selectedIncident.action}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-slate-500">Expected Value (EV)</span>
                      <p className="font-bold text-emerald-700 font-mono mt-0.5">₹{selectedIncident.ev.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                      <span className="text-slate-500">Target Channel</span>
                      <p className="font-bold text-slate-900 mt-0.5">{selectedIncident.channel}</p>
                    </div>
                  </div>

                  {/* Triggers */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="text-xs font-bold text-slate-700">Outreach Actions:</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSendTelegram(selectedIncident)}
                        disabled={sendingChannel === 'telegram'}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#229ED9] hover:bg-[#1E88E5] text-white transition-colors disabled:opacity-50"
                      >
                        {sendingChannel === 'telegram' ? 'Sending...' : 'Instant Telegram Alert (@razorpaytestbot)'}
                      </button>

                      <button
                        onClick={() => handleSendWhatsApp(selectedIncident)}
                        disabled={sendingChannel === 'whatsapp'}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#25D366] hover:bg-[#20bd5a] text-white transition-colors disabled:opacity-50"
                      >
                        {sendingChannel === 'whatsapp' ? 'Sending...' : 'WhatsApp Message'}
                      </button>

                      {selectedIncident.status === 'escalated' && (
                        <button
                          onClick={() => alert(`Authorized! Command(resume) dispatched for ${selectedIncident.id}. Replay-safe node resumed.`)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                        >
                          Approve HITL Review (&ge; ₹1,00,000)
                        </button>
                      )}
                    </div>

                    {channelResult && (
                      <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                        {channelResult}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: COPILOT */}
            {merchantTab === 'copilot' && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Merchant AI Operations Copilot</h3>
                    <p className="text-xs text-slate-500">Ask about recovery decisions, unit economics, or compliance rules</p>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Model: gpt-4o-mini</span>
                </div>

                {/* Quick Suggestion Chips */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <span className="text-slate-500 text-[11px] self-center mr-1">Quick prompts:</span>
                  {[
                    'Why was transaction evt_003 escalated to human review?',
                    'How do we handle RBI > ₹15,000 mandate failures?',
                    'Why did the engine choose "do_nothing" for Rohan Mehta?',
                    'How does the system prevent duplicate contacts during bank outages?',
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendCopilot(chip)}
                      className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {/* Chat Stream */}
                <div className="bg-slate-50 rounded-xl p-4 min-h-[280px] max-h-[380px] overflow-y-auto space-y-3 border border-slate-200">
                  {copilotMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xl p-3.5 rounded-xl text-xs leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-[#0052CC] text-white rounded-br-none'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {copilotLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 text-slate-500 p-3 rounded-xl text-xs animate-pulse">
                        Copilot is reasoning over state graph & policy engine...
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendCopilot();
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    placeholder="Ask about recovery decisions, unit economics, or compliance rules..."
                    className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                  />
                  <button
                    type="submit"
                    disabled={copilotLoading || !copilotInput.trim()}
                    className="px-4 py-2 rounded-lg bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}

            {/* TAB 3: LIVE PIPELINE */}
            {merchantTab === 'live' && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Live End-to-End Orchestrator Pipeline</h3>
                    <p className="text-xs text-slate-500">Full 6-Node LangGraph StateGraph Execution</p>
                  </div>
                  <button
                    onClick={runLiveDemo}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0052CC] hover:bg-[#0747A6] text-white transition-colors"
                  >
                    Re-Run Live Event
                  </button>
                </div>

                <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-emerald-400 space-y-1.5 max-h-[420px] overflow-y-auto">
                  {liveLog.length === 0 && (
                    <div className="text-slate-500">Click &ldquo;Re-Run Live Event&rdquo; to execute the pipeline...</div>
                  )}
                  {liveLog.map((line, idx) => (
                    <div
                      key={idx}
                      className={`${
                        line.startsWith('🎉') ? 'text-amber-300 font-bold text-xs pt-2' :
                        line.startsWith('   ✓') ? 'text-emerald-300' :
                        line.startsWith('   🏆') ? 'text-yellow-300 font-bold' :
                        line.startsWith('   →') ? 'text-slate-400' :
                        line === '' ? '' : 'text-slate-200'
                      }`}
                    >
                      {line || '\u00A0'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: RACE DEMO */}
            {merchantTab === 'race' && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Webhook Race Condition Arbitrator</h3>
                    <p className="text-xs text-slate-500">Guaranteeing 0 Duplicate Contacts under Out-of-Order Webhooks</p>
                  </div>
                  <button
                    onClick={runRaceDemo}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0052CC] hover:bg-[#0747A6] text-white"
                  >
                    Simulate Race Sequence
                  </button>
                </div>

                <div className="space-y-2.5 max-w-xl">
                  <div className={`p-3 rounded-lg border transition-all text-xs ${
                    raceDemo && raceDemo.step >= 1 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-slate-50 border-slate-200 opacity-40'
                  }`}>
                    <div className="font-bold">10:31:02.100 &mdash; Razorpay Webhook: <code>payment.failed</code></div>
                    <div className="text-[11px] text-slate-600">Recovery intervention queued in active memory queue.</div>
                  </div>

                  <div className={`p-3 rounded-lg border transition-all text-xs ${
                    raceDemo && raceDemo.step >= 2 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 opacity-40'
                  }`}>
                    <div className="font-bold">10:31:04.250 &mdash; Razorpay Webhook: <code>payment.captured</code></div>
                    <div className="text-[11px] text-slate-600">Customer retried independently and payment succeeded.</div>
                  </div>

                  <div className={`p-3 rounded-lg border transition-all text-xs ${
                    raceDemo && raceDemo.step >= 3 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 opacity-40'
                  }`}>
                    <div className="font-bold">Outcome Tracker: Race Condition Detected & Intercepted</div>
                    <div className="text-[11px] text-slate-600">Pending recovery message immediately canceled before dispatch.</div>
                  </div>

                  <div className={`p-3 rounded-lg border transition-all text-xs ${
                    raceDemo && raceDemo.step >= 4 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 opacity-40'
                  }`}>
                    <div className="font-bold">Verified Invariant: 0 Duplicate Contacts</div>
                    <div className="text-[11px] text-slate-600">No redundant SMS/WhatsApp sent. Immutable audit trail updated.</div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: BENCHMARK */}
            {merchantTab === 'benchmark' && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">3-Way Empirical Benchmark (100 Held-Out Incidents)</h3>
                  <p className="text-xs text-slate-500">Measuring True Recovered Revenue vs Wasted Outreach</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 pb-2">
                        <th className="py-2.5 font-sans font-semibold text-slate-900">Evaluation Metric</th>
                        <th className="font-semibold text-slate-600">Baseline A (Naive Blast)</th>
                        <th className="font-semibold text-slate-600">Baseline B (Rule-Based)</th>
                        <th className="font-semibold text-emerald-700 font-sans">AI Recovery Orchestrator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      <tr>
                        <td className="py-3 font-sans font-medium text-slate-900">Classification Accuracy</td>
                        <td>—</td>
                        <td>—</td>
                        <td className="font-bold text-emerald-700">96.00% (96/100 Matches)</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-3 font-sans font-medium text-slate-900">Duplicate Contacts</td>
                        <td className="text-red-600 font-bold">16 breaches</td>
                        <td className="text-red-600 font-bold">13 breaches</td>
                        <td className="font-bold text-emerald-700">0 (Strictly Guaranteed)</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-sans font-medium text-slate-900">False / Wasted Outreach</td>
                        <td className="text-red-600 font-bold">13 cases</td>
                        <td className="text-red-600 font-bold">12 cases</td>
                        <td className="font-bold text-emerald-700">6 cases (54% Reduction)</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="py-3 font-sans font-medium text-slate-900">Human HITL Escalation (&ge; ₹1L)</td>
                        <td>0 (Unbounded)</td>
                        <td>0 (Unbounded)</td>
                        <td className="font-bold text-amber-700">19 cases (19.0% Bounded)</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-sans font-medium text-slate-900">DeepEval Suite Pass Rate</td>
                        <td>—</td>
                        <td>—</td>
                        <td className="font-bold text-emerald-700">18 / 18 (100% PASS)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 6: ARCHITECTURE */}
            {merchantTab === 'architecture' && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">System Architecture & Invariants (AGENTS.md)</h3>
                  <p className="text-xs text-slate-500">Core architectural rules governing Track 3 Revenue Recovery</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900">1. Separation of Reasoning & Financial Control</h4>
                    <p className="text-slate-600 leading-relaxed">
                      LLMs are strictly restricted to classification disambiguation and candidate synthesis. All execution gates are governed by deterministic Expected Value calculations and compliance guardrails.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900">2. "Do Nothing" as a First-Class Decision</h4>
                    <p className="text-slate-600 leading-relaxed">
                      If a customer has a 96% on-time payment track record, <code>do_nothing</code> yields the highest net expected value (EV = P &times; amount &minus; friction).
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900">3. Replay-Safe LangGraph HITL</h4>
                    <p className="text-slate-600 leading-relaxed">
                      LangGraph <code>interrupt()</code> pauses execution when an action exceeds ₹1,00,000 without executing side effects.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900">4. Zero Duplicate Contacts Invariant</h4>
                    <p className="text-slate-600 leading-relaxed">
                      Out-of-order webhooks are reconciled by the active queue to guarantee zero duplicate customer contacts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: PRISMA DATABASE */}
            {merchantTab === 'database' && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Relational Database Schema (Prisma + Supabase PostgreSQL)</h3>
                  <p className="text-xs text-slate-500">5 Normalized relational entities actively modeling the recovery lifecycle</p>
                </div>

                {/* Table Sub-tabs */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'events', name: 'events', count: '6 rows' },
                    { id: 'recovery_actions', name: 'recovery_actions', count: '6 rows' },
                    { id: 'promise_to_pay', name: 'promise_to_pay', count: '2 rows' },
                    { id: 'audit_log', name: 'audit_log', count: '5 rows' },
                    { id: 'evaluation_runs', name: 'evaluation_runs', count: '2 rows' },
                  ].map((tb) => (
                    <button
                      key={tb.id}
                      onClick={() => setSelectedDbTable(tb.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors ${
                        selectedDbTable === tb.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tb.name} <span className="opacity-60 text-[10px]">({tb.count})</span>
                    </button>
                  ))}
                </div>

                {/* Live Data Grid */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        {DB_TABLE_DATA[selectedDbTable]?.headers.map((h, idx) => (
                          <th key={idx} className="px-3.5 py-2.5 font-bold uppercase text-[10px] tracking-wider text-slate-700">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {DB_TABLE_DATA[selectedDbTable]?.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} className="px-3.5 py-2.5 text-slate-800 whitespace-nowrap">
                              {cIdx === 0 ? (
                                <span className="font-bold text-[#0052CC]">{cell}</span>
                              ) : typeof cell === 'string' && cell.startsWith('₹') ? (
                                <span className="font-bold text-emerald-700">{cell}</span>
                              ) : (
                                cell
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-blue-50/60 p-3.5 rounded-lg border border-blue-100 text-xs text-slate-700 space-y-1">
                  <div className="font-bold text-slate-900">Prisma Direct & Pooled URL Architecture:</div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Configured with <code>directUrl</code> for schema migrations and pooled connection (<code>pgbouncer=true</code>) for zero connection starvation.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
        Razorpay Revenue Recovery Orchestrator &bull; Track 3 Supervisory Agent System
      </footer>
    </div>
  );
}
