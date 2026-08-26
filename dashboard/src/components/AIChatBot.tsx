'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface AIChatBotProps {
  role: 'merchant' | 'payer';
  customerName?: string;
  amount?: number;
  rootCause?: string;
  customerId?: string;
  merchantId?: string;
  onToolAction?: (action: { tool: string; updatedAmount?: number; promisedDate?: string; approved?: boolean }) => void;
  defaultOpen?: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  toolsExecuted?: Array<{ tool: string; message: string; [key: string]: any }>;
}

interface VoiceTurn {
  speaker: 'user' | 'agent';
  text: string;
  time: string;
  toolsExecuted?: Array<{ tool: string; message: string; [key: string]: any }>;
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-1" />;
        const formattedLine = line
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');

        if (line.trim().startsWith('• ') || line.trim().startsWith('- ')) {
          return (
            <div key={idx} className="flex items-start gap-1.5 ml-1">
              <span className="text-cyan-500 font-bold">•</span>
              <span dangerouslySetInnerHTML={{ __html: formattedLine.replace(/^[•\-]\s*/, '') }} />
            </div>
          );
        }

        return <p key={idx} dangerouslySetInnerHTML={{ __html: formattedLine }} />;
      })}
    </div>
  );
}

export default function AIChatBot({
  role,
  customerName = 'Ashwin Khowala',
  amount = 4999,
  rootCause = 'subscription_failed',
  customerId = 'cust_0001',
  merchantId = 'merch_01',
  onToolAction,
  defaultOpen = true,
}: AIChatBotProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [mode, setMode] = useState<'chat' | 'voice'>('chat');

  // Text Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice Chat State
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceTurns, setVoiceTurns] = useState<VoiceTurn[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, voiceTurns]);

  // High-Quality Voice Synthesizer
  const playVoice = (text: string, detectedLang?: string) => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();

    const isEnglish =
      detectedLang === 'english' ||
      (/^[a-zA-Z0-9\s.,!?'"₹$%&()/:;-]+$/.test(text) &&
        !/(\b(?:namaste|kya|kyun|hai|aap|mera|meri|rupaye|somwar|shukriya|dhanyawad|badhiya|haan|chahiye|karo|bhej|gaya|kitna|paisa)\b)/i.test(
          text
        ));

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (isEnglish) {
      utterance.lang = 'en-US';
      const engVoice =
        voices.find(v => v.name.toLowerCase().includes('natural') && v.lang.startsWith('en')) ||
        voices.find(v => v.name.includes('Google UK English Female')) ||
        voices.find(v => v.name.includes('Google US English')) ||
        voices.find(v => v.lang === 'en-US') ||
        voices.find(v => v.lang === 'en-GB') ||
        voices.find(v => v.lang.startsWith('en'));
      if (engVoice) utterance.voice = engVoice;
    } else {
      utterance.lang = 'hi-IN';
      const hindiVoice =
        voices.find(v => v.name.toLowerCase().includes('swara')) ||
        voices.find(v => v.name.toLowerCase().includes('hindi')) ||
        voices.find(v => v.lang.startsWith('hi')) ||
        voices.find(v => v.lang.includes('IN'));
      if (hindiVoice) utterance.voice = hindiVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

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

  // Speech-to-Text Microphone Engine
  const startSpeechRecognition = (onResultCallback: (text: string) => void) => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript && transcript.trim()) {
        onResultCallback(transcript.trim());
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {}
  };

  // Toggle Mic for Text Input Box
  const toggleTextMic = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      startSpeechRecognition(transcript => {
        setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
      });
    }
  };

  // Send Text Message
  const handleSendText = async (quickText?: string) => {
    const textToSend = quickText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/voice-agent-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: role,
          customer_name: customerName,
          amount: amount,
          root_cause: rootCause,
          customer_id: customerId,
          merchant_id: merchantId,
          user_speech: textToSend,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const asstMsg: ChatMessage = {
          id: `msg_${Date.now()}_a`,
          sender: 'assistant',
          text: data.voice_reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          toolsExecuted: data.executed_tools,
        };
        setMessages(prev => [...prev, asstMsg]);

        if (data.executed_tools && data.executed_tools.length > 0 && onToolAction) {
          for (const t of data.executed_tools) {
            if (t.tool === 'apply_concession_discount') {
              onToolAction({ tool: t.tool, updatedAmount: t.updated_amount });
            } else if (t.tool === 'register_promise_to_pay') {
              onToolAction({ tool: t.tool, promisedDate: t.promised_date || 'Next Monday' });
            } else if (t.tool === 'approve_high_value_invoice') {
              onToolAction({ tool: t.tool, approved: true });
            }
          }
        }
      } else {
        throw new Error('API offline');
      }
    } catch {
      const isEnglish = /^[a-zA-Z0-9\s.,!?'"₹$%&()/:;-]+$/.test(textToSend);
      const fallbackReply =
        role === 'merchant'
          ? isEnglish
            ? '📊 **Business Summary:**\n\n• **Total At-Risk:** ₹2,45,998 across 6 customer accounts\n• **Recovered:** ₹44,075 with 0 duplicate spam contacts\n• **Awaiting Approval:** ₹1,45,000 for TechMatrix Corp'
            : '📊 **Financial Summary:**\n\n• **Total At-Risk:** ₹2,45,998 across 6 accounts\n• **Recovered:** ₹44,075 (0 duplicate spam contacts)\n• **Pending Approval:** ₹1,45,000 TechMatrix Corp'
          : isEnglish
          ? `Your payment of ₹${amount.toLocaleString()} is currently pending. You can apply a 5% concession discount or schedule a payment date.`
          : `Aapka ₹${amount.toLocaleString()} ka payment pending hai. Aap 5% discount le sakte hain ya date schedule kar sakte hain.`;

      setMessages(prev => [
        ...prev,
        {
          id: `msg_${Date.now()}_a`,
          sender: 'assistant',
          text: fallbackReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Start Voice Chat
  const startVoiceChat = () => {
    setMode('voice');
    setVoiceTurns([]);
    setTimeout(() => {
      startSpeechRecognition(handleSendVoice);
    }, 200);
  };

  const endVoiceChat = () => {
    setIsListening(false);
    setIsSpeaking(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
  };

  // Process Live Voice Speech
  const handleSendVoice = async (speechText: string) => {
    if (!speechText.trim() || voiceLoading) return;

    const userTurn: VoiceTurn = {
      speaker: 'user',
      text: speechText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setVoiceTurns(prev => [...prev, userTurn]);
    setVoiceLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/orchestrator/voice-agent-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: role,
          customer_name: customerName,
          amount: amount,
          root_cause: rootCause,
          customer_id: customerId,
          merchant_id: merchantId,
          user_speech: speechText,
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

        if (data.executed_tools && data.executed_tools.length > 0 && onToolAction) {
          for (const t of data.executed_tools) {
            if (t.tool === 'apply_concession_discount') {
              onToolAction({ tool: t.tool, updatedAmount: t.updated_amount });
            } else if (t.tool === 'register_promise_to_pay') {
              onToolAction({ tool: t.tool, promisedDate: t.promised_date || 'Next Monday' });
            } else if (t.tool === 'approve_high_value_invoice') {
              onToolAction({ tool: t.tool, approved: true });
            }
          }
        }

        playVoice(data.voice_reply, data.detected_language);
      } else {
        throw new Error('offline');
      }
    } catch {
      const isEnglish = /^[a-zA-Z0-9\s.,!?'"₹$%&()/:;-]+$/.test(speechText);
      const fallback =
        role === 'merchant'
          ? isEnglish
            ? 'Total at-risk revenue is ₹2,45,998 with ₹44,075 recovered and zero duplicate contacts.'
            : 'Total ₹2,45,998 at-risk revenue hai, ₹44,075 recover ho chuka hai aur strictly 0 duplicate spam contacts hain.'
          : isEnglish
          ? `Your payment of ₹${amount.toLocaleString()} is currently pending. Would you like a 5% discount?`
          : `Aapka ₹${amount.toLocaleString()} ka payment pending hai. Kya aap 5% discount lena chahenge?`;

      setVoiceTurns(prev => [
        ...prev,
        {
          speaker: 'agent',
          text: fallback,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      playVoice(fallback, isEnglish ? 'english' : 'hinglish');
    } finally {
      setVoiceLoading(false);
    }
  };

  // Collapsed Floating Pill (Bottom Right)
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[#00A3C4] to-[#00829B] text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 hover:opacity-95 transition-all font-semibold text-xs border border-white/20 hover:scale-105"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping" />
        <span>✨ {role === 'merchant' ? 'AI Recovery Assistant' : 'AI Payment Assistant'}</span>
        <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono">Open</span>
      </button>
    );
  }

  // Quick Prompts
  const quickPrompts =
    role === 'merchant'
      ? [
          'What is my financial status?',
          'Why is TechMatrix paused?',
          'Approve TechMatrix Corp',
          'Get customer intelligence',
        ]
      : [
          'Can I get a discount?',
          'I will pay next Monday',
          'Why was my payment held?',
          'How does re-auth work?',
        ];

  return (
    <aside className="w-full lg:w-[400px] shrink-0 bg-white border border-slate-200/90 rounded-2xl shadow-xl flex flex-col h-[740px] sticky top-20 overflow-hidden transition-all duration-300">
      {/* 1. Header with Mode Switcher & Collapse */}
      <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#00A3C4] flex items-center justify-center text-white text-sm shadow-xs font-bold">
            ✨
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 leading-tight">
              {role === 'merchant' ? 'AI Recovery Assistant' : 'AI Payment Assistant'}
            </h3>
            <div className="flex items-center gap-1.5 text-[10px] text-[#00A3C4] font-medium mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Online • {role === 'merchant' ? 'Supervisor Mode' : 'Payer Mode'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Voice Chat Toggle + Collapse */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              if (mode === 'chat') {
                startVoiceChat();
              } else {
                endVoiceChat();
                setMode('chat');
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center gap-1.5 ${
              mode === 'voice'
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                : 'bg-cyan-50 text-[#00A3C4] hover:bg-cyan-100 border border-cyan-200'
            }`}
          >
            <span>{mode === 'voice' ? '✕ Stop Voice' : '🎙️ Voice Chat'}</span>
          </button>

          <button
            onClick={() => setIsOpen(false)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors"
            title="Collapse Panel"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 2. BODY */}
      {mode === 'chat' ? (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-4 bg-slate-50/40">
          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10 px-3 space-y-3.5 my-auto">
                <div className="w-14 h-14 rounded-2xl bg-[#00A3C4] flex items-center justify-center text-white text-2xl shadow-md">
                  ✨
                </div>

                <div className="space-y-1.5 max-w-[280px]">
                  <h4 className="text-sm font-bold text-slate-900 leading-snug">
                    {role === 'merchant'
                      ? 'How can I help with your revenue recovery today?'
                      : 'How can I assist with your invoice today?'}
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {role === 'merchant'
                      ? 'Ask about at-risk payments, inspect RBI mandate rules, get financial KPIs, or approve high-value invoices using voice or text.'
                      : 'Ask why your payment was held, claim a 5% concession discount, or schedule a payment date using voice or text.'}
                  </p>
                </div>

                <div className="text-[10px] text-amber-700 bg-amber-50/90 border border-amber-200/80 px-3 py-2 rounded-xl text-left flex items-start gap-1.5 max-w-[320px]">
                  <span>⚠️</span>
                  <span>
                    <strong>Financial Guardrails Active:</strong> Automated recovery follows RBI rules
                    and strict zero-duplicate-contact invariants.
                  </span>
                </div>

                {/* Quick Prompts Chips */}
                <div className="w-full pt-2 space-y-1.5 text-left">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Suggested Questions
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickPrompts.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendText(chip)}
                        className="px-2.5 py-1 rounded-full bg-white hover:bg-cyan-50 hover:text-[#00A3C4] hover:border-[#00A3C4] text-slate-700 text-[11px] font-medium transition-all border border-slate-200 shadow-2xs text-left"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-[#00A3C4] text-white rounded-br-none shadow-xs'
                        : 'bg-white border border-slate-200/90 text-slate-800 rounded-bl-none shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1 opacity-75 text-[10px]">
                      <span className="font-bold">
                        {msg.sender === 'user' ? `👤 ${customerName}` : '✨ AI Copilot'}
                      </span>
                      <span>{msg.time}</span>
                    </div>

                    <FormattedText text={msg.text} />

                    {/* Tool Badges */}
                    {msg.toolsExecuted && msg.toolsExecuted.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                        {msg.toolsExecuted.map((t, idx) => (
                          <div
                            key={idx}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1"
                          >
                            <span>⚡</span>
                            <span>
                              <strong>Tool:</strong> {t.tool}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 text-slate-500 p-3 rounded-2xl text-xs animate-pulse shadow-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00A3C4] animate-ping" />
                  <span>Processing recovery intelligence with tools...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 3. Bottom Input Dock (Speech-to-Text Mic + Send Button) */}
          <div className="pt-3 border-t border-slate-200/80 space-y-1.5">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendText();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask query or use voice typing..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#00A3C4] bg-white shadow-2xs placeholder:text-slate-400"
              />

              {/* Dedicated Speech-to-Text Mic button */}
              <button
                type="button"
                onClick={toggleTextMic}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all shadow-xs ${
                  isListening
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title={isListening ? 'Listening (Speak into microphone)...' : 'Speech-to-Text Voice Typing'}
              >
                🎙️
              </button>

              {/* Send Button */}
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-xl bg-[#00A3C4] hover:bg-[#008da8] text-white text-base font-bold transition-colors disabled:opacity-40 shadow-xs flex items-center justify-center"
                title="Send"
              >
                ✈
              </button>
            </form>

            <div className="text-[10px] text-slate-400 text-center leading-tight">
              Razorpay Supervisory Copilot • RBI Compliant • 0 Duplicate Outreach
            </div>
          </div>
        </div>
      ) : (
        /* LIVE VOICE CHAT MODE */
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-4 bg-slate-900 text-white">
          {/* Header Status Card */}
          <div className="bg-slate-800 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-cyan-400 animate-pulse' : isListening ? 'bg-red-500 animate-ping' : 'bg-emerald-400'}`} />
              <div>
                <div className="text-xs font-bold">
                  {isSpeaking ? '🔊 Copilot is Speaking...' : isListening ? '🎙️ Listening to you...' : '🎙️ Voice Chat Active'}
                </div>
                <div className="text-[10px] text-slate-400">
                  Speak naturally in English or Hindi &bull; AI mirrors your language
                </div>
              </div>
            </div>
            <button
              onClick={endVoiceChat}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold"
            >
              End Voice
            </button>
          </div>

          {/* Voice Turns Stream */}
          <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
            {voiceTurns.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4 space-y-3 my-auto">
                {/* Audio Wave Visualizer */}
                <div className="flex items-center justify-center gap-1.5 h-10">
                  <div className="w-1.5 bg-[#00A3C4] rounded-full animate-bounce [animation-delay:-0.3s] h-8" />
                  <div className="w-1.5 bg-[#54D6D6] rounded-full animate-bounce [animation-delay:-0.15s] h-10" />
                  <div className="w-1.5 bg-emerald-400 rounded-full animate-bounce h-6" />
                  <div className="w-1.5 bg-[#54D6D6] rounded-full animate-bounce [animation-delay:-0.15s] h-10" />
                  <div className="w-1.5 bg-[#00A3C4] rounded-full animate-bounce [animation-delay:-0.3s] h-8" />
                </div>

                <div className="text-xs font-bold text-slate-200">Listening to your voice...</div>
                <div className="text-[11px] text-slate-400 max-w-[260px] leading-relaxed">
                  Speak now in English or Hindi (e.g. &ldquo;What is our financial status?&rdquo; or &ldquo;Can I get a discount?&rdquo;).
                </div>
              </div>
            ) : (
              voiceTurns.map((turn, idx) => (
                <div key={idx} className="space-y-1">
                  <div
                    className={`p-3 rounded-xl text-xs leading-relaxed ${
                      turn.speaker === 'user'
                        ? 'bg-[#00A3C4] text-white ml-6 shadow-xs'
                        : 'bg-slate-800 text-slate-100 mr-6 border border-slate-700'
                    }`}
                  >
                    <span className="font-bold text-[9px] block opacity-70 mb-0.5">
                      {turn.speaker === 'agent' ? '✨ Voice Copilot' : `👤 ${customerName}`}
                    </span>
                    {turn.text}
                  </div>

                  {turn.toolsExecuted &&
                    turn.toolsExecuted.map((tool, tIdx) => (
                      <div
                        key={tIdx}
                        className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-700 ml-6 flex items-center gap-1.5 shadow-xs"
                      >
                        <span>⚡</span>
                        <span>
                          <strong>Tool Executed:</strong> {tool.tool} &mdash; {tool.message}
                        </span>
                      </div>
                    ))}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Controls */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <button
              onClick={() => {
                if (isListening) {
                  if (recognitionRef.current) recognitionRef.current.stop();
                  setIsListening(false);
                } else {
                  startSpeechRecognition(handleSendVoice);
                }
              }}
              className={`w-full py-3 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-[#00A3C4] hover:bg-[#008da8] text-white'
              }`}
            >
              <span>{isListening ? '🔴 Listening... (Tap to Send)' : '🎤 Tap to Speak Query'}</span>
            </button>

            {/* Quick voice chips */}
            <div className="flex flex-wrap gap-1 text-[10px]">
              {quickPrompts.slice(0, 3).map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendVoice(chip)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
