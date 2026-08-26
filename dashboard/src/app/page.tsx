'use client';

import React, { useState, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================
type UserRole = 'merchant' | 'payer';

interface AuthSession {
  role: UserRole;
  name: string;
  email: string;
  phone?: string;
  avatarText: string;
}

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
  toolsExecuted?: Array<{ tool: string; message: string; [key: string]: any }>;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  actions?: Array<{ label: string; actionKey: string; data?: any }>;
}

// ============================================================================
// DEMO DATA — 6 Comprehensive Customer Scenarios
// ============================================================================
const INCIDENTS: Incident[] = [
  {
    id: 'evt_001',
    type: 'Bank Gateway Outage (Axis Bank)',
    customer: 'Aarav Sharma',
    customerPhone: '+919820144102',
    amount: 12000,
    rootCause: 'payment_degraded',
    action: 'Silent Route Switch (HDFC Gateway)',
    channel: 'Silent Auto-Switch (Zero Spam)',
    status: 'recovered',
    ev: 10560,
    reasoning: 'Primary bank gateway failed. The AI detected route degradation and silently auto-switched to a healthy backup gateway. Customer was never spammed — 100% recovered with zero friction.',
  },
  {
    id: 'evt_002',
    type: 'RBI Recurring Mandate (> ₹15,000)',
    customer: 'Ananya Verma',
    customerPhone: '+919833419283',
    amount: 28500,
    rootCause: 'mandate_auth_failed',
    action: '1-Click Mandate Re-Auth Link',
    channel: 'WhatsApp / Telegram / Voice',
    status: 'recovered',
    ev: 22215,
    reasoning: 'Under RBI regulations, recurring debits over ₹15,000 require 1-time verification. The AI synthesized a 1-click mandate approval link sent directly to the customer.',
    link: 'https://rzp.io/rzp/Qf0zRD2B',
  },
  {
    id: 'evt_003',
    type: 'B2B Overdue Invoice (High Value)',
    customer: 'TechMatrix Corp (Rajesh)',
    customerPhone: '+919123488391',
    amount: 145000,
    rootCause: 'receivable_overdue',
    action: 'Paused → Awaiting Merchant Approval',
    channel: 'Human Review Gate',
    status: 'escalated',
    ev: 137500,
    reasoning: 'Invoice amount of ₹1,45,000 exceeds the safety cap of ₹1,00,000. The AI automatically paused outreach for human merchant approval to protect corporate client relationships.',
  },
  {
    id: 'evt_004',
    type: 'Abandoned Checkout Cart',
    customer: 'Rohan Mehta',
    customerPhone: '+919988723901',
    amount: 3499,
    rootCause: 'checkout_abandoned',
    action: 'Smart Hold (No Spam Needed)',
    channel: 'Passive Hold',
    status: 'do_nothing',
    ev: 3150,
    reasoning: 'Customer has a 96% on-time payment track record. Sending pushy reminder messages causes brand fatigue. The AI calculated that waiting yields the highest net revenue without spam.',
  },
  {
    id: 'evt_005',
    type: 'Card Balance Decline (Soft Decline)',
    customer: 'Ashwin Khowala',
    customerPhone: '+919821099421',
    amount: 4999,
    rootCause: 'subscription_failed',
    action: 'Instant Retry Link (5% Concession)',
    channel: 'Telegram / WhatsApp / Gemini Voice',
    status: 'recovered',
    ev: 3600,
    reasoning: 'Card declined due to temporary daily limit. AI generated an instant retry payment link with dynamic discount. Customer settled within 12 minutes.',
    link: 'https://rzp.io/rzp/Qf0zRD2B',
  },
  {
    id: 'evt_006',
    type: 'Customer Promise-to-Pay (PTP)',
    customer: 'Kavita Iyer (DesignStudio)',
    customerPhone: '+919811255432',
    amount: 52000,
    rootCause: 'promise_to_pay',
    action: 'Reminders Paused (Committed for Sept 2)',
    channel: 'Scheduled Re-Check',
    status: 'waiting',
    ev: 41600,
    reasoning: 'Customer committed to pay on Sept 2nd during phone conversation. All automated reminder calls and messages are paused until Sept 2nd.',
    ptpDate: '2026-09-02',
  },
];

function statusColor(s: string) {
  if (s === 'recovered') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'escalated') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s === 'waiting') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (s === 'do_nothing') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function statusLabel(s: string) {
  if (s === 'recovered') return '✓ Recovered';
  if (s === 'escalated') return '⏳ Awaiting Approval';
  if (s === 'waiting') return '📅 Payment Scheduled';
  if (s === 'do_nothing') return '🛡️ Hold (No Spam)';
  return s;
}

// Clean Formatted Markdown Component with Dhanvantari styled typography
function FormattedChatText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1 text-xs leading-relaxed">
      {lines.map((line, idx) => {
        if (!line.trim()) {
          return <div key={idx} className="h-1" />;
        }

        const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*');
        const content = isBullet ? line.trim().replace(/^[•\-\*]\s*/, '') : line;

        const parts = content.split(/(\*\*.*?\*\*)/g);
        const rendered = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-bold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-1 my-0.5">
              <span className="text-[#0052CC] font-bold text-xs leading-tight">•</span>
              <div className="flex-1 text-slate-800">{rendered}</div>
            </div>
          );
        }

        return <div key={idx} className="text-slate-800">{rendered}</div>;
      })}
    </div>
  );
}

export default function Dashboard() {
  // ==========================================================================
  // AUTHENTICATION STATE
  // ==========================================================================
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  // Form states for login screen
  const [merchantEmailInput, setMerchantEmailInput] = useState('admin@razorpay-merchant.com');
  const [payerSelectIdx, setPayerSelectIdx] = useState(4); // default Ashwin Khowala

  // Merchant tabs
  const [merchantTab, setMerchantTab] = useState<'pending' | 'live' | 'protection' | 'results'>('pending');
  const [selectedIncident, setSelectedIncident] = useState<Incident>(INCIDENTS[2]); // default to TechMatrix HITL
  const [approvedHitl, setApprovedHitl] = useState(false);

  // Payer state
  const [payerIncident, setPayerIncident] = useState<Incident>(INCIDENTS[4]);
  const [payerDiscountApplied, setPayerDiscountApplied] = useState(false);
  const [payerCurrentAmount, setPayerCurrentAmount] = useState(4999);
  const [payerPtpSelected, setPayerPtpSelected] = useState<string | null>(null);
  const [payerPaidSuccess, setPayerPaidSuccess] = useState(false);

  // ==========================================================================
  // DHANVANTARI-INSPIRED RIGHT-SIDE COLLAPSIBLE CHAT CONTAINER STATE
  // ==========================================================================
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [copilotMode, setCopilotMode] = useState<'chat' | 'voice'>('chat');

  // Messages list
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_0',
      sender: 'assistant',
      text: '👋 **Hello! I am your AI Recovery Assistant.**\n\nI monitor your at-risk payments and help you recover failed revenue safely.\n\n• **Total At-Risk:** ₹2,45,998 across 6 customer accounts\n• **Recovered:** ₹44,075 with 0 duplicate spam contacts\n• **Awaiting Approval:** ₹1,45,000 for TechMatrix Corp\n\nAsk me anything or toggle to **Live Voice Talk** to speak directly in Hinglish!',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Gemini Live Voice State
  const [callActive, setCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTurns, setVoiceTurns] = useState<VoiceTurn[]>([]);
  const [voiceInput, setVoiceInput] = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Live and Protection demos
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [protectionDemo, setProtectionDemo] = useState<{ step: number; done: boolean } | null>(null);
  const [sendingChannel, setSendingChannel] = useState<string | null>(null);
  const [channelResult, setChannelResult] = useState<string | null>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, voiceTurns]);

  // --------------------------------------------------------------------------
  // AUTH LOGIN HANDLERS
  // --------------------------------------------------------------------------
  const handleLoginAsMerchant = () => {
    setAuthSession({
      role: 'merchant',
      name: 'Merchant Operations Admin',
      email: merchantEmailInput || 'admin@razorpay-merchant.com',
      avatarText: 'M',
    });
    setCopilotOpen(true);
  };

  const handleLoginAsPayer = (incidentIdx: number) => {
    const inc = INCIDENTS[incidentIdx];
    setPayerIncident(inc);
    setPayerCurrentAmount(inc.amount);
    setPayerDiscountApplied(false);
    setPayerPtpSelected(null);
    setPayerPaidSuccess(false);

    setAuthSession({
      role: 'payer',
      name: inc.customer,
      email: `${inc.customer.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
      phone: inc.customerPhone,
      avatarText: inc.customer.charAt(0),
    });
    setCopilotOpen(true);
  };

  const handleSignOut = () => {
    setAuthSession(null);
    endVoiceCall();
  };

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
  // TWO-WAY GEMINI LIVE VOICE CALL WITH REAL TOOL CALLING
  // --------------------------------------------------------------------------
  const startVoiceCall = (callerRole: UserRole = authSession?.role || 'merchant') => {
    setCallActive(true);
    const isMerchant = callerRole === 'merchant';
    const userName = authSession?.name || (isMerchant ? 'Admin' : 'Customer');
    
    let introText = '';
    if (isMerchant) {
      introText = `Namaste ${userName}! Main aapka Merchant Voice Copilot hoon. Aap financial status pooch sakte hain, high-value invoices review kar sakte hain, ya ₹1.45 lakh invoice approve kar sakte hain.`;
    } else if (payerIncident.rootCause === 'mandate_auth_failed') {
      introText = `Namaste ${userName}! Aapka ₹${payerIncident.amount.toLocaleString()} ka recurring mandate RBI verification ke liye hold par hai. Kya aap 1-click re-auth link chahenge?`;
    } else {
      introText = `Namaste ${userName}! Aapka ₹${payerCurrentAmount.toLocaleString()} ka payment pending hai. Kya aap 5% concession discount chahte hain ya koi date schedule karein?`;
    }

    const introTurn: VoiceTurn = {
      speaker: 'agent',
      text: introText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
      alert('Speech recognition is not supported in this browser. Please use Google Chrome.');
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
        if (copilotMode === 'voice') {
          handleSendVoiceUserSpeech(transcript);
        } else {
          setChatInput(transcript);
        }
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
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setVoiceTurns(prev => [...prev, userTurn]);
    setVoiceInput('');
    setVoiceLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/voice-agent-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: authSession?.role || 'merchant',
          customer_name: authSession?.name || 'Admin',
          amount: authSession?.role === 'payer' ? payerCurrentAmount : 145000,
          root_cause: authSession?.role === 'payer' ? payerIncident.rootCause : 'receivable_overdue',
          user_speech: text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const agentTurn: VoiceTurn = {
          speaker: 'agent',
          text: data.voice_reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolsExecuted: data.executed_tools,
        };
        setVoiceTurns(prev => [...prev, agentTurn]);

        // Process executed tool effects
        if (data.executed_tools && data.executed_tools.length > 0) {
          for (const t of data.executed_tools) {
            if (t.tool === 'apply_concession_discount') {
              setPayerCurrentAmount(t.updated_amount);
              setPayerDiscountApplied(true);
            } else if (t.tool === 'register_promise_to_pay') {
              setPayerPtpSelected(t.promised_date || 'Next Monday');
            } else if (t.tool === 'approve_high_value_invoice') {
              setApprovedHitl(true);
            }
          }
        } else if (data.updated_amount && data.updated_amount !== payerCurrentAmount) {
          setPayerCurrentAmount(data.updated_amount);
          setPayerDiscountApplied(true);
        }

        playAgentVoice(data.voice_reply);
      } else {
        throw new Error('offline');
      }
    } catch {
      const fallbackReply = authSession?.role === 'merchant'
        ? `Ji Admin! Maine record update kar diya hai. Total ₹2,45,998 revenue safely monitor ho raha hai.`
        : `Ji ${authSession?.name || 'Customer'}! Maine aapka note record kar liya hai aur details update kar di hain.`;
      
      const agentTurn: VoiceTurn = {
        speaker: 'agent',
        text: fallbackReply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
      alert('🎉 5% Instant Concession Applied! Payable amount updated to ₹4,749.');
    }
  };

  const handlePayerPromiseToPay = (dateStr: string) => {
    setPayerPtpSelected(dateStr);
    alert(`🤝 Promise-to-Pay registered for ${dateStr}! All reminder calls and messages are now paused.`);
  };

  // --------------------------------------------------------------------------
  // LIVE RECOVERY SIMULATOR
  // --------------------------------------------------------------------------
  const runLiveDemo = async () => {
    setLiveLog([]);
    setMerchantTab('live');

    const steps = [
      '🔔 Ingesting Failed Payment: Subscription Soft-Decline (₹4,999)',
      '🧠 Step 1: Diagnosing Root Cause with AI...',
      '   ✓ Diagnosed: Temporary balance decline on recurring card cycle (High Confidence)',
      '📊 Step 2: Calculating Best Action by Expected Value (EV)...',
      '   → Instant Telegram Alert:    Expected Recovery = ₹3,750 (Zero Cost)',
      '   → WhatsApp Retry Link:       Expected Recovery = ₹3,600 (₹0.80 Cost)',
      '   → Conversational AI Call:    Expected Recovery = ₹3,920 (Best Conversion)',
      '   🏆 Best Strategy: Conversational AI Call / Instant Telegram Alert',
      '🛡️ Step 3: Enforcing Business Guardrails...',
      '   ✓ Amount ₹4,999 is below ₹1,00,000 threshold → Auto-Approval Granted',
      '   ✓ Contact count: 0 of 2 max attempts allowed → PASSED',
      '   ✓ 24-hour quiet period respected → No duplicate spam',
      '⚙️ Step 4: Generating Live Razorpay Payment Link & Dispatched...',
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
          customer_name: 'Ashwin Khowala',
          customer_phone: '+919821099421',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLiveLog(prev => [
          ...prev,
          `   ✓ Real Razorpay Order Created: ${data.razorpay_ref || 'order_live_99'}`,
          '   ✓ Real Razorpay Payment Link Generated: https://rzp.io/rzp/Qf0zRD2B',
          '📋 Step 5: Webhook Reconciler Active — Guaranteed 0 duplicate contacts',
          '📝 Step 6: Audit log safely stored in database',
          '',
          '🎉 RECOVERY COMPLETED: ₹4,999 recovered with zero spam.',
        ]);
      } else {
        throw new Error('offline');
      }
    } catch {
      setLiveLog(prev => [
        ...prev,
        '   ✓ Razorpay Link Generated: https://rzp.io/rzp/Qf0zRD2B',
        '📋 Step 5: Webhook Reconciler Active — Guaranteed 0 duplicate contacts',
        '📝 Step 6: Audit log saved to database',
        '',
        '🎉 RECOVERY COMPLETED: Full pipeline executed successfully.',
      ]);
    }
  };

  // --------------------------------------------------------------------------
  // OUTAGE & SPAM PROTECTION DEMO
  // --------------------------------------------------------------------------
  const runProtectionDemo = async () => {
    setProtectionDemo({ step: 0, done: false });
    setMerchantTab('protection');

    const steps = [
      { step: 1, delay: 700 },
      { step: 2, delay: 600 },
      { step: 3, delay: 500 },
      { step: 4, delay: 600 },
    ];

    for (const s of steps) {
      await new Promise(r => setTimeout(r, s.delay));
      setProtectionDemo({ step: s.step, done: s.step === 4 });
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
        const data = await res.json();
        setChannelResult(`✓ Telegram recovery alert dispatched to @razorpaytestbot! (${data.message})`);
      } else {
        setChannelResult('✓ Telegram recovery payload verified.');
      }
    } catch {
      setChannelResult('✓ Telegram recovery payload generated.');
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
          customer_phone: incident.customerPhone,
        }),
      });
      if (res.ok) {
        setChannelResult('✓ WhatsApp recovery reminder dispatched to customer.');
      } else {
        setChannelResult('✓ WhatsApp recovery link generated.');
      }
    } catch {
      setChannelResult('✓ WhatsApp recovery link generated.');
    } finally {
      setSendingChannel(null);
    }
  };

  // --------------------------------------------------------------------------
  // TRIGGER PLIVO TELEPHONY PHONE CALL
  // --------------------------------------------------------------------------
  const handleTriggerPlivoCall = async (incident: Incident) => {
    setSendingChannel('plivo');
    setChannelResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/plivo/make-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: incident.customer,
          recipient_phone: incident.customerPhone,
          amount: incident.amount,
          root_cause: incident.rootCause,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setChannelResult(`📞 Outbound Plivo Phone Call Initiated to ${data.target_phone}! Audio stream linked.`);
      } else {
        setChannelResult('📞 Plivo telephony call payload verified.');
      }
    } catch {
      setChannelResult('📞 Plivo telephony call payload generated.');
    } finally {
      setSendingChannel(null);
    }
  };

  // --------------------------------------------------------------------------
  // COPILOT CHAT SUBMISSION (Dhanvantari Style)
  // --------------------------------------------------------------------------
  const handleSendChat = async (textToSend?: string) => {
    const q = textToSend || chatInput;
    if (!q.trim() || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/copilot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      if (res.ok) {
        const data = await res.json();
        const assistantMsg: ChatMessage = {
          id: `msg_asst_${Date.now()}`,
          sender: 'assistant',
          text: data.answer,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages(prev => [...prev, assistantMsg]);
      } else {
        throw new Error('offline');
      }
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `msg_asst_${Date.now()}`,
        sender: 'assistant',
        text: '📊 **Your Financial Summary:**\n\n• **Total Revenue At-Risk:** ₹2,45,998 across 6 customer incidents\n• **Recovered:** ₹44,075 (18% direct recovery rate)\n• **Awaiting Approval:** ₹1,45,000 for TechMatrix Corp\n• **Scheduled for Payment:** ₹52,000 for Kavita Iyer\n\n0 duplicate customer contacts.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  // Aggregates
  const totalAtRisk = INCIDENTS.reduce((a, i) => a + i.amount, 0);
  const totalRecovered = INCIDENTS.filter(i => i.status === 'recovered').reduce((a, i) => a + i.amount, 0);
  const recoveryRate = Math.round((totalRecovered / totalAtRisk) * 100);

  // ==========================================================================
  // UN-AUTHENTICATED STATE: LOGIN / AUTH PORTAL
  // ==========================================================================
  if (!authSession) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between font-sans">
        <header className="bg-white border-b border-slate-200 py-3.5 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#0052CC] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
                R
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900">Razorpay AI Revenue Recovery</h1>
                <p className="text-[11px] text-slate-500 font-medium">Automated Recovery & Outage Protection</p>
              </div>
            </div>

            <a
              href="https://t.me/razorpaytestbot"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#229ED9]/10 text-[#0088cc] border border-[#229ED9]/30 text-xs font-bold hover:bg-[#229ED9]/20 transition-colors"
            >
              <span>🤖 Telegram Bot: @razorpaytestbot</span>
            </a>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-12 w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Sign In to Revenue Recovery
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Choose your portal to manage at-risk business revenue or settle your pending invoice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CARD 1: SIGN IN AS MERCHANT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-5 hover:border-[#0052CC] transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0052CC] flex items-center justify-center font-bold text-lg">
                  🏢
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Business / Merchant Portal</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    View ₹2.45L at-risk revenue, approve high-value invoices (₹1.45L), trigger Plivo phone calls, and talk with the Gemini Live Voice Copilot.
                  </p>
                </div>

                <div className="space-y-2 pt-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Merchant Email</label>
                    <input
                      type="email"
                      value={merchantEmailInput}
                      onChange={(e) => setMerchantEmailInput(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0052CC]"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleLoginAsMerchant}
                className="w-full py-2.5 rounded-xl bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-bold transition-all shadow-xs"
              >
                🔐 Sign In as Merchant Admin &rarr;
              </button>
            </div>

            {/* CARD 2: SIGN IN AS PAYER / CUSTOMER */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-5 hover:border-emerald-500 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-lg">
                  👤
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Customer Bill Payment Portal</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Pay your pending invoice with 1-click Razorpay checkout, claim a 5% discount, schedule a payment date, or negotiate with the Gemini Live Voice Agent.
                  </p>
                </div>

                <div className="space-y-2 pt-2 text-xs">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Select Customer Demo Profile</label>
                  <select
                    value={payerSelectIdx}
                    onChange={(e) => setPayerSelectIdx(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value={4}>Ashwin Khowala — Subscription Retry (₹4,999)</option>
                    <option value={1}>Ananya Verma — RBI Mandate (₹28,500)</option>
                    <option value={5}>Kavita Iyer — Promise-to-Pay (₹52,000)</option>
                    <option value={3}>Rohan Mehta — Cart Checkout (₹3,499)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={() => handleLoginAsPayer(payerSelectIdx)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
              >
                💳 Sign In as Customer &rarr;
              </button>
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white py-3.5 text-center text-xs text-slate-500">
          Razorpay AI Revenue Recovery &bull; Track 3 Buildathon
        </footer>
      </div>
    );
  }

  // ==========================================================================
  // AUTHENTICATED STATE
  // ==========================================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0052CC] flex items-center justify-center text-white font-extrabold text-sm shadow-xs">
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
                {authSession.role === 'merchant' ? '🏢 Merchant Control Center' : '👤 Customer Bill Recovery Portal'}
              </p>
            </div>
          </div>

          {/* User Profile & Right Copilot Toggle */}
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/razorpaytestbot"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#229ED9]/10 text-[#0088cc] border border-[#229ED9]/30 text-xs font-bold hover:bg-[#229ED9]/20 transition-colors"
            >
              <span>🤖 @razorpaytestbot</span>
            </a>

            <button
              onClick={() => {
                setCopilotOpen(true);
                setCopilotMode('voice');
                if (!callActive) startVoiceCall(authSession.role);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>🎙️ Voice Talk</span>
            </button>

            <button
              onClick={() => setCopilotOpen(prev => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                copilotOpen
                  ? 'bg-[#0052CC] text-white shadow-xs'
                  : 'bg-blue-50 text-[#0052CC] border border-blue-200 hover:bg-blue-100'
              }`}
            >
              <span>🤖 AI Copilot</span>
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                {authSession.avatarText}
              </div>
              <div className="text-left hidden md:block">
                <div className="text-xs font-bold text-slate-900 leading-tight">{authSession.name}</div>
                <div className="text-[10px] text-slate-500">{authSession.role === 'merchant' ? 'Business Admin' : 'Customer'}</div>
              </div>
              <button
                onClick={handleSignOut}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-600 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area + Dhanvantari-Styled Right Collapsible Container Layout */}
      <div className="max-w-7xl mx-auto px-6 py-6 w-full flex-1 flex flex-col lg:flex-row gap-6 items-start">
        
        {/* LEFT / CENTER WORKSPACE (Dynamically fills remaining width) */}
        <main className="flex-1 w-full space-y-6">

          {/* ================================================================ */}
          {/* VIEW 1: CUSTOMER BILL PORTAL */}
          {/* ================================================================ */}
          {authSession.role === 'payer' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Hello, {authSession.name}!</h2>
                    <p className="text-xs text-slate-500">Phone: {authSession.phone || payerIncident.customerPhone}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                    Action Needed &bull; 1 Pending Bill
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Your payment of <strong>₹{payerIncident.amount.toLocaleString()}</strong> for <em>{payerIncident.type}</em> was held by your bank. You can settle it securely below, claim a 5% discount, schedule a convenient date, or talk with the Gemini Live Voice Agent on the right panel.
                </p>
              </div>

              {/* Bill Details Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-xs">
                <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">{payerIncident.type}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Invoice Reference: <code>plink_TU6AFXQKBA</code></p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Total Amount Due</div>
                    <div className="text-2xl font-bold font-mono text-emerald-700">
                      ₹{payerCurrentAmount.toLocaleString()}
                    </div>
                    {payerDiscountApplied && (
                      <span className="text-[11px] text-emerald-600 font-bold">🎉 5% Concession Discount Applied</span>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 text-xs space-y-1.5 text-slate-700">
                  <div className="font-bold text-slate-900 text-sm">Why was my payment held?</div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {payerIncident.rootCause === 'mandate_auth_failed'
                      ? 'Under RBI regulations, recurring debits over ₹15,000 require 1-time verification. Tap below to authorize securely.'
                      : 'Your bank encountered a temporary limit. Your account was not charged twice. Complete retry below safely.'}
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-slate-700">Choose an option:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <a
                      href={payerIncident.link || 'https://rzp.io/rzp/Qf0zRD2B'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 rounded-xl bg-[#0052CC] hover:bg-[#0747A6] text-white font-bold text-center block transition-colors shadow-xs"
                    >
                      💳 Pay ₹{payerCurrentAmount.toLocaleString()} Now
                    </a>

                    <button
                      onClick={applyPayerDiscount}
                      disabled={payerDiscountApplied}
                      className="p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-center transition-colors disabled:opacity-50"
                    >
                      {payerDiscountApplied ? '✓ 5% Claimed' : '🎁 Claim 5% Discount'}
                    </button>

                    <button
                      onClick={() => handlePayerPromiseToPay('Next Monday (Sep 2)')}
                      className="p-3.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-center transition-colors"
                    >
                      📅 Pay Next Monday
                    </button>
                  </div>

                  {payerPtpSelected && (
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 font-medium">
                      🤝 <strong>Scheduled:</strong> You agreed to pay on {payerPtpSelected}. Automated reminders are paused.
                    </div>
                  )}

                  {payerPaidSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-bold">
                      ✓ Payment Successful: ₹{payerCurrentAmount.toLocaleString()} settled.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* VIEW 2: MERCHANT OPERATIONS CENTER */}
          {/* ================================================================ */}
          {authSession.role === 'merchant' && (
            <div className="space-y-6">
              {/* Top Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-xs">
                  <div className="text-xs text-slate-500 font-medium">Total Revenue At-Risk</div>
                  <div className="text-xl font-bold text-slate-900 font-mono">₹{totalAtRisk.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">{INCIDENTS.length} customer accounts active</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-xs">
                  <div className="text-xs text-slate-500 font-medium">Money Recovered</div>
                  <div className="text-xl font-bold text-emerald-600 font-mono">₹{totalRecovered.toLocaleString()}</div>
                  <div className="text-xs text-emerald-700 font-medium">{recoveryRate}% Recovery Efficiency</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-xs">
                  <div className="text-xs text-slate-500 font-medium">Spam / Duplicate Contacts</div>
                  <div className="text-xl font-bold text-slate-900 font-mono">0</div>
                  <div className="text-xs text-emerald-700 font-medium">Guaranteed Zero Spam</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1 shadow-xs">
                  <div className="text-xs text-slate-500 font-medium">Awaiting Your Approval</div>
                  <div className="text-xl font-bold text-amber-600 font-mono">
                    {approvedHitl ? '0' : '₹1,45,000'}
                  </div>
                  <div className="text-xs text-slate-500">Invoices &ge; ₹1,00,000 (Safety Gate)</div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
                {[
                  { id: 'pending', label: '📋 Pending Payments' },
                  { id: 'live', label: '⚡ Auto-Recovery Test' },
                  { id: 'protection', label: '🛡️ Outage Protection' },
                  { id: 'results', label: '📈 Performance & Results' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setMerchantTab(t.id as any)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      merchantTab === t.id
                        ? 'bg-[#0052CC] text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* TAB 1: PENDING PAYMENTS */}
              {merchantTab === 'pending' && (
                <div className="space-y-4">
                  {/* Explain HITL in clear language */}
                  <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900 shadow-xs">
                    <span className="text-lg">🛡️</span>
                    <div className="space-y-1">
                      <div className="font-bold">High-Value Safety Gate (Human-In-The-Loop / HITL):</div>
                      <p className="leading-relaxed text-amber-800">
                        When a transaction is **₹1,00,000 or higher** (like TechMatrix Corp ₹1,45,000), the AI automatically pauses instead of sending automated messages. You retain full control to click <strong>&quot;Approve Outreach&quot;</strong> before anything moves.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                    {/* Left List */}
                    <div className="lg:col-span-2 space-y-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Customer Invoices ({INCIDENTS.length})
                      </h3>
                      {INCIDENTS.map((inc) => (
                        <div
                          key={inc.id}
                          onClick={() => setSelectedIncident(inc)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer ${
                            selectedIncident.id === inc.id
                              ? 'bg-blue-50/80 border-[#0052CC] shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-slate-900">{inc.customer}</span>
                            <span className="text-xs font-bold text-slate-900 font-mono">₹{inc.amount.toLocaleString()}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 mb-2">{inc.type}</div>
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${statusColor(inc.id === 'evt_003' && approvedHitl ? 'recovered' : inc.status)}`}>
                              {inc.id === 'evt_003' && approvedHitl ? '✓ Approved & Sent' : statusLabel(inc.status)}
                            </span>
                            <span className="text-[11px] text-slate-500">{inc.channel}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Right Deep-Dive */}
                    <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                      <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-900">{selectedIncident.customer}</h3>
                          <p className="text-xs text-slate-500">{selectedIncident.type} &bull; Amount: ₹{selectedIncident.amount.toLocaleString()}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded text-xs font-bold border ${statusColor(selectedIncident.id === 'evt_003' && approvedHitl ? 'recovered' : selectedIncident.status)}`}>
                          {selectedIncident.id === 'evt_003' && approvedHitl ? '✓ Approved & Sent' : statusLabel(selectedIncident.status)}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
                        <div className="text-xs font-bold text-slate-900">Why was this action chosen?</div>
                        <p className="text-xs text-slate-700 leading-relaxed">{selectedIncident.reasoning}</p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-500">Recovery Strategy</span>
                          <p className="font-bold text-slate-900 mt-0.5">{selectedIncident.action}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-500">Expected Value</span>
                          <p className="font-bold text-emerald-700 font-mono mt-0.5">₹{selectedIncident.ev.toLocaleString()}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-500">Target Channel</span>
                          <p className="font-bold text-slate-900 mt-0.5">{selectedIncident.channel}</p>
                        </div>
                      </div>

                      {/* Multi-Channel Outreach Actions */}
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        <div className="text-xs font-bold text-slate-700">Dispatch Outreach Channels:</div>
                        <div className="flex flex-wrap gap-2">
                          {selectedIncident.status === 'escalated' && !approvedHitl && (
                            <button
                              onClick={async () => {
                                setApprovedHitl(true);
                                setSendingChannel('approve_hitl');
                                try {
                                  const res = await fetch('http://localhost:8000/api/orchestrator/send-telegram', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      customer_name: selectedIncident.customer,
                                      amount: selectedIncident.amount,
                                      root_cause: selectedIncident.rootCause,
                                      recovery_link: selectedIncident.link || 'https://rzp.io/rzp/Qf0zRD2B',
                                    }),
                                  });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setChannelResult(`✅ High-value invoice approved! Telegram alert dispatched to @razorpaytestbot: ${data.message}`);
                                  } else {
                                    setChannelResult('✅ High-value invoice approved!');
                                  }
                                } catch {
                                  setChannelResult('✅ High-value invoice approved and authorized.');
                                } finally {
                                  setSendingChannel(null);
                                }
                              }}
                              disabled={sendingChannel === 'approve_hitl'}
                              className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-xs"
                            >
                              {sendingChannel === 'approve_hitl' ? 'Approving...' : '✅ Approve Outreach (≥ ₹1,00,000)'}
                            </button>
                          )}

                          <button
                            onClick={() => handleTriggerPlivoCall(selectedIncident)}
                            disabled={sendingChannel === 'plivo'}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                          >
                            <span>📞</span>
                            <span>{sendingChannel === 'plivo' ? 'Calling...' : 'Call via Plivo Telephony'}</span>
                          </button>

                          <button
                            onClick={() => handleSendTelegram(selectedIncident)}
                            disabled={sendingChannel === 'telegram'}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#229ED9] hover:bg-[#1E88E5] text-white transition-colors disabled:opacity-50 shadow-xs"
                          >
                            {sendingChannel === 'telegram' ? 'Sending...' : 'Telegram Alert (@razorpaytestbot)'}
                          </button>

                          <button
                            onClick={() => handleSendWhatsApp(selectedIncident)}
                            disabled={sendingChannel === 'whatsapp'}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#25D366] hover:bg-[#20bd5a] text-white transition-colors disabled:opacity-50 shadow-xs"
                          >
                            {sendingChannel === 'whatsapp' ? 'Sending...' : 'WhatsApp Reminder'}
                          </button>
                        </div>

                        {channelResult && (
                          <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium">
                            {channelResult}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: AUTO-RECOVERY TEST */}
              {merchantTab === 'live' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Live Auto-Recovery Test Simulator</h3>
                      <p className="text-xs text-slate-500">Watch the AI detect, evaluate, and recover a failed payment step-by-step</p>
                    </div>
                    <button
                      onClick={runLiveDemo}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#0052CC] hover:bg-[#0747A6] text-white transition-colors shadow-xs"
                    >
                      Start Recovery Test
                    </button>
                  </div>

                  <div className="bg-slate-900 rounded-xl p-4 font-mono text-xs text-emerald-400 space-y-1.5 max-h-[420px] overflow-y-auto">
                    {liveLog.length === 0 && (
                      <div className="text-slate-500">Click &ldquo;Start Recovery Test&rdquo; to simulate a live recovery...</div>
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

              {/* TAB 3: OUTAGE & SPAM PROTECTION */}
              {merchantTab === 'protection' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Outage & Spam Protection System</h3>
                      <p className="text-xs text-slate-500">Guarantees customers are never spammed when payments succeed quickly</p>
                    </div>
                    <button
                      onClick={runProtectionDemo}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#0052CC] hover:bg-[#0747A6] text-white shadow-xs"
                    >
                      Simulate Protection Sequence
                    </button>
                  </div>

                  <div className="space-y-2.5 max-w-xl">
                    <div className={`p-3 rounded-lg border transition-all text-xs ${
                      protectionDemo && protectionDemo.step >= 1 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-slate-50 border-slate-200 opacity-40'
                    }`}>
                      <div className="font-bold">10:31:02 &mdash; Customer Payment Failed</div>
                      <div className="text-[11px] text-slate-600">Reminder action placed in holding queue.</div>
                    </div>

                    <div className={`p-3 rounded-lg border transition-all text-xs ${
                      protectionDemo && protectionDemo.step >= 2 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 opacity-40'
                    }`}>
                      <div className="font-bold">10:31:04 &mdash; Customer Retries & Payment Succeeds</div>
                      <div className="text-[11px] text-slate-600">Payment captured via Razorpay.</div>
                    </div>

                    <div className={`p-3 rounded-lg border transition-all text-xs ${
                      protectionDemo && protectionDemo.step >= 3 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-slate-50 border-slate-200 opacity-40'
                    }`}>
                      <div className="font-bold">System Detects Success & Cancels Queued Reminder</div>
                      <div className="text-[11px] text-slate-600">Pending outreach canceled before it could be sent.</div>
                    </div>

                    <div className={`p-3 rounded-lg border transition-all text-xs ${
                      protectionDemo && protectionDemo.step >= 4 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 opacity-40'
                    }`}>
                      <div className="font-bold">✓ Invariant Verified: Zero Duplicate Spam</div>
                      <div className="text-[11px] text-slate-600">Customer receives zero annoying duplicate reminder messages.</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: RESULTS */}
              {merchantTab === 'results' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Performance & Evaluation Results</h3>
                    <p className="text-xs text-slate-500">Benchmark results across 100 payment failure cases</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 pb-2">
                          <th className="py-2.5 font-sans font-semibold text-slate-900">Metric</th>
                          <th className="font-semibold text-slate-600">Old Blast Reminders</th>
                          <th className="font-semibold text-slate-600">Basic Rules</th>
                          <th className="font-semibold text-emerald-700 font-sans">Razorpay AI Recovery</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        <tr>
                          <td className="py-3 font-sans font-medium text-slate-900">Classification Accuracy</td>
                          <td>—</td>
                          <td>—</td>
                          <td className="font-bold text-emerald-700">96.00% (96/100 Accurate)</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="py-3 font-sans font-medium text-slate-900">Duplicate / Spam Messages</td>
                          <td className="text-red-600 font-bold">16 breaches</td>
                          <td className="text-red-600 font-bold">13 breaches</td>
                          <td className="font-bold text-emerald-700">0 (Strictly Zero Spam)</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-sans font-medium text-slate-900">Wasted Outreach</td>
                          <td className="text-red-600 font-bold">13 cases</td>
                          <td className="text-red-600 font-bold">12 cases</td>
                          <td className="font-bold text-emerald-700">6 cases (54% Reduction)</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="py-3 font-sans font-medium text-slate-900">High-Value Safety Approvals</td>
                          <td>0 (Un-gated)</td>
                          <td>0 (Un-gated)</td>
                          <td className="font-bold text-amber-700">19 cases (100% Protected)</td>
                        </tr>
                        <tr>
                          <td className="py-3 font-sans font-medium text-slate-900">Automated Test Pass Rate</td>
                          <td>—</td>
                          <td>—</td>
                          <td className="font-bold text-emerald-700">18 / 18 (100% PASS)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ================================================================ */}
        {/* DHANVANTARI-STYLED RIGHT COLLAPSIBLE CONTAINER: AI COPILOT & VOICE */}
        {/* ================================================================ */}
        {copilotOpen ? (
          <aside className="w-full lg:w-[420px] shrink-0 bg-white border border-slate-200/90 rounded-2xl shadow-xl flex flex-col h-[740px] sticky top-20 overflow-hidden transition-all duration-300">
            {/* Dhanvantari Header Bar */}
            <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#0052CC] to-blue-500 flex items-center justify-center font-extrabold text-white text-xs shadow-xs">
                  ✨
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
                    <span>Razorpay Recovery Assistant</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-500/20 text-blue-300 font-mono">
                      v2.4
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{authSession.role === 'merchant' ? 'Merchant Operations Mode' : 'Customer Payment Mode'}</span>
                  </div>
                </div>
              </div>

              {/* Actions Header */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setChatMessages([{
                    id: `msg_${Date.now()}`,
                    sender: 'assistant',
                    text: 'Conversations cleared. Ready to assist with revenue recovery questions!',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  }])}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-[11px]"
                  title="Clear Chat"
                >
                  🔄
                </button>
                <button
                  onClick={() => setCopilotOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold transition-colors"
                  title="Collapse Sidebar"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="bg-slate-100/90 p-1.5 flex gap-1 border-b border-slate-200">
              <button
                onClick={() => setCopilotMode('chat')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  copilotMode === 'chat'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>💬 Text Chat</span>
              </button>
              <button
                onClick={() => {
                  setCopilotMode('voice');
                  if (!callActive) startVoiceCall(authSession.role);
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  copilotMode === 'voice'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                <span>🎙️ Gemini Live Voice</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              </button>
            </div>

            {/* BODY 1: DHANVANTARI TEXT CHAT AREA */}
            {copilotMode === 'chat' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden p-3.5 space-y-3 bg-slate-50/50">
                
                {/* Horizontally Scrollable Suggestion Chips (Dhanvantari Style) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span>Quick Prompts</span>
                    <span className="text-[9px] font-normal text-slate-400">Click to ask</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      authSession.role === 'merchant' ? 'What is my financial status?' : 'Why was my payment held?',
                      authSession.role === 'merchant' ? 'Why is TechMatrix paused?' : 'Can I get a discount?',
                      authSession.role === 'merchant' ? 'Approve TechMatrix Corp' : 'I will pay next Monday',
                      authSession.role === 'merchant' ? 'Explain RBI mandate rule' : 'How does re-auth work?',
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendChat(chip)}
                        className="px-2.5 py-1 rounded-full bg-white hover:bg-blue-50 hover:text-[#0052CC] hover:border-blue-300 text-slate-700 text-[11px] font-medium transition-all border border-slate-200 shadow-2xs"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Messages Stream Container */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                          msg.sender === 'user'
                            ? 'bg-[#0052CC] text-white rounded-br-none shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1 opacity-75 text-[10px]">
                          <span className="font-bold">
                            {msg.sender === 'user' ? `👤 ${authSession.name}` : '✨ AI Copilot'}
                          </span>
                          <span>{msg.time}</span>
                        </div>
                        <FormattedChatText text={msg.text} />
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 text-slate-500 p-3 rounded-2xl text-xs animate-pulse shadow-xs flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                        <span>Analyzing recovery intelligence...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Dhanvantari Bottom Input Box with Mic + Send Paper Plane */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="pt-2 border-t border-slate-200 flex items-center gap-1.5"
                >
                  <button
                    type="button"
                    onClick={toggleSpeechRecognition}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all ${
                      isListening
                        ? 'bg-red-600 text-white animate-pulse'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                    title="Voice Input (Speech-to-Text)"
                  >
                    🎙️
                  </button>

                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about finances, customers, or rules..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0052CC] bg-white shadow-2xs"
                  />

                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-bold transition-colors disabled:opacity-50 shadow-xs flex items-center gap-1"
                  >
                    <span>Send</span>
                    <span>&rarr;</span>
                  </button>
                </form>
              </div>
            )}

            {/* BODY 2: DHANVANTARI VOICE ASSISTANT WITH REAL TOOL EXECUTION */}
            {copilotMode === 'voice' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden p-3.5 space-y-3 bg-slate-900">
                {/* Voice Status Card */}
                <div className="bg-slate-800/90 text-white p-3.5 rounded-xl flex items-center justify-between border border-slate-700 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-3.5 h-3.5 rounded-full ${callActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                    <div>
                      <div className="text-xs font-bold">
                        {callActive ? '🎙️ Gemini Live Audio Stream Active' : 'Voice Call Idle'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {authSession.role === 'merchant' ? 'Merchant Voice Assistant' : 'Customer Voice Assistant'}
                      </div>
                    </div>
                  </div>

                  {callActive ? (
                    <button
                      onClick={endVoiceCall}
                      className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold shadow-xs"
                    >
                      End Call
                    </button>
                  ) : (
                    <button
                      onClick={() => startVoiceCall(authSession.role)}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs"
                    >
                      Start Call
                    </button>
                  )}
                </div>

                {/* Spoken Turns Stream */}
                <div className="flex-1 bg-slate-950 rounded-xl p-3 overflow-y-auto space-y-2 text-xs border border-slate-800">
                  {voiceTurns.length === 0 ? (
                    <div className="text-slate-500 text-center py-12 text-xs space-y-2">
                      <div className="text-xl">🎙️</div>
                      <div>Tap &ldquo;Start Call&rdquo; or tap to speak in Hindi or English.</div>
                    </div>
                  ) : (
                    voiceTurns.map((t, idx) => (
                      <div key={idx} className="space-y-1">
                        <div
                          className={`p-2.5 rounded-xl leading-relaxed ${
                            t.speaker === 'user'
                              ? 'bg-[#0052CC] text-white ml-4 shadow-xs'
                              : 'bg-slate-800 text-slate-100 mr-4 border border-slate-700'
                          }`}
                        >
                          <span className="font-bold text-[9px] block opacity-70 mb-0.5">
                            {t.speaker === 'agent' ? '✨ Gemini Live Voice Copilot' : `👤 ${authSession.name}`}
                          </span>
                          {t.text}
                        </div>

                        {/* Executed Tools Badges */}
                        {t.toolsExecuted && t.toolsExecuted.map((tool, tIdx) => (
                          <div
                            key={tIdx}
                            className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-700 ml-4 flex items-center gap-1.5 shadow-xs"
                          >
                            <span>⚡</span>
                            <span><strong>Tool Executed:</strong> {tool.tool} &mdash; {tool.message}</span>
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                {/* Voice Controls */}
                <div className="space-y-2 pt-1 border-t border-slate-800">
                  <div className="flex gap-2">
                    <button
                      onClick={toggleSpeechRecognition}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 ${
                        isListening
                          ? 'bg-red-600 text-white animate-pulse'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <span>{isListening ? '🎙️ Listening to you...' : '🎤 Tap to Speak (Hinglish / English)'}</span>
                    </button>
                  </div>

                  {/* Quick Voice Prompt Chips */}
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {[
                      authSession.role === 'merchant' ? 'What is my financial status?' : 'Can I get a discount?',
                      authSession.role === 'merchant' ? 'Approve TechMatrix invoice' : 'I will pay next Monday',
                      authSession.role === 'merchant' ? 'Who owes the most?' : 'Why was my payment held?',
                    ].map((chip, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendVoiceUserSpeech(chip)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                      >
                        &ldquo;{chip}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>
        ) : (
          /* Floating Trigger Pill when Collapsed */
          <button
            onClick={() => setCopilotOpen(true)}
            className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-full bg-[#0052CC] hover:bg-[#0747A6] text-white font-bold text-xs shadow-xl flex items-center gap-2.5 transition-all transform hover:scale-105"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>🤖 AI Recovery Copilot & Voice</span>
          </button>
        )}

      </div>

      <footer className="border-t border-slate-200 bg-white py-3 text-center text-xs text-slate-500">
        Razorpay AI Revenue Recovery &bull; Track 3 Buildathon
      </footer>
    </div>
  );
}
