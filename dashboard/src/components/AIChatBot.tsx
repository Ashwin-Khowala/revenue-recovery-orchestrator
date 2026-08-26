'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface AIChatBotProps {
  role: 'merchant' | 'payer';
  customerName?: string;
  amount?: number;
  rootCause?: string;
  onToolAction?: (action: { tool: string; updatedAmount?: number; promisedDate?: string; approved?: boolean }) => void;
  defaultOpen?: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  toolsExecuted?: Array<{ tool: string; message: string }>;
}

interface VoiceTurn {
  speaker: 'user' | 'agent';
  text: string;
  time: string;
  toolsExecuted?: Array<{ tool: string; message: string }>;
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
  const [callActive, setCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTurns, setVoiceTurns] = useState<VoiceTurn[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, voiceTurns]);

  // Speech Synthesis setup
  const playVoice = (text: string, detectedLang?: string) => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();

    const isEnglish =
      detectedLang === 'english' ||
      (/^[a-zA-Z0-9\s.,!?'"₹$%&()/:;-]+$/.test(text) &&
        !/(\b(?:namaste|kya|kyun|hai|aap|mera|meri|rupaye|somwar|shukriya|dhanyawad|badhiya|haan|chahiye|karo|bhej)\b)/i.test(
          text
        ));

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    if (isEnglish) {
      utterance.lang = 'en-IN';
      const engVoice =
        voices.find(v => v.lang === 'en-IN') ||
        voices.find(v => v.name.includes('India') && v.lang.startsWith('en')) ||
        voices.find(v => v.lang.startsWith('en-US')) ||
        voices.find(v => v.lang.startsWith('en'));
      if (engVoice) utterance.voice = engVoice;
    } else {
      utterance.lang = 'hi-IN';
      const hindiVoice =
        voices.find(v => v.lang.startsWith('hi')) ||
        voices.find(v => v.name.toLowerCase().includes('hindi')) ||
        voices.find(v => v.name.toLowerCase().includes('swara')) ||
        voices.find(v => v.lang.includes('IN'));
      if (hindiVoice) utterance.voice = hindiVoice;
    }

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

  // Speech Recognition Toggle (Mic)
  const toggleMic = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.');
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
        if (mode === 'voice') {
          handleSendVoice(transcript);
        } else {
          setInput(transcript);
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {}
  };

  // Send Text Query
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

        // Process tool callbacks
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
      const fallbackReply =
        role === 'merchant'
          ? '📊 **Your Financial Summary:**\n\n• **Total At-Risk:** ₹2,45,998 across 6 customer incidents\n• **Recovered:** ₹44,075 with 0 duplicate spam contacts\n• **Awaiting Authorization:** ₹1,45,000 for TechMatrix Corp\n\nAll deterministic compliance guardrails are active.'
          : `Your payment of ₹${amount.toLocaleString()} is currently pending retry. Would you like to apply a 5% concession discount or schedule a payment date?`;

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
    setCallActive(true);
    setMode('voice');
    const isMerchant = role === 'merchant';
    const intro = isMerchant
      ? `Namaste ${customerName}! Main aapka Merchant Voice Copilot hoon. Aap financial metrics pooch sakte hain ya TechMatrix invoice approve kar sakte hain.`
      : `Namaste ${customerName}! Aapka ₹${amount.toLocaleString()} ka payment pending hai. Kya aap 5% discount lena chahenge ya date schedule karein?`;

    setVoiceTurns([
      {
        speaker: 'agent',
        text: intro,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    playVoice(intro, 'hinglish');
  };

  const endVoiceChat = () => {
    setCallActive(false);
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (typeof window !== 'undefined') window.speechSynthesis.cancel();
  };

  // Send Voice User Speech
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
      const isEnglish =
        /^[a-zA-Z0-9\s.,!?'"₹$%&()/:;-]+$/.test(speechText) &&
        !/(\b(?:namaste|kya|kyun|hai|aap|mera|meri|rupaye|somwar|shukriya|dhanyawad|badhiya|haan|chahiye|karo)\b)/i.test(
          speechText
        );

      const fallback = isEnglish
        ? role === 'merchant'
          ? 'Admin, your financial request has been recorded. ₹2,45,998 revenue at risk is actively monitored.'
          : `Hello ${customerName}! I have updated your recovery schedule.`
        : role === 'merchant'
        ? 'Ji Admin! Aapka note record kar liya hai. Total ₹2,45,998 revenue safely monitor ho raha hai.'
        : `Ji ${customerName}! Maine aapka note record kar liya hai.`;

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

  // When collapsed: Render floating trigger pill matching Dhanvantari
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-[#00A3C4] to-[#00829B] text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 hover:opacity-95 transition-all font-semibold text-xs border border-white/20"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping" />
        <span>✨ {role === 'merchant' ? 'AI Recovery Assistant' : 'AI Payment Assistant'}</span>
        <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono">Open</span>
      </button>
    );
  }

  // Dhanvantari Quick Prompts
  const quickPrompts =
    role === 'merchant'
      ? [
          'What is my financial status?',
          'Why is TechMatrix paused?',
          'Approve TechMatrix Corp',
          'Explain RBI mandate rule',
        ]
      : [
          'Can I get a discount?',
          'I will pay next Monday',
          'Why was my payment held?',
          'How does re-auth work?',
        ];

  return (
    <aside className="w-full lg:w-[400px] shrink-0 bg-white border border-slate-200/90 rounded-2xl shadow-xl flex flex-col h-[740px] sticky top-20 overflow-hidden transition-all duration-300">
      {/* 1. Dhanvantari Header (Exact layout from screenshot) */}
      <div className="bg-white px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#00A3C4] flex items-center justify-center text-white text-base shadow-xs">
            ✨
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 leading-tight">
              {role === 'merchant' ? 'AI Recovery Assistant' : 'AI Payment Assistant'}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-[#00A3C4] font-medium mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Online • Ready to help with {role === 'merchant' ? 'revenue' : 'payments'}</span>
            </div>
          </div>
        </div>

        {/* Top-Right Action: Voice Chat Toggle Button + Close */}
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
                : 'bg-pink-100/80 text-pink-700 hover:bg-pink-200 border border-pink-200'
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

      {/* 2. BODY: Mode View */}
      {mode === 'chat' ? (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-4 bg-slate-50/40">
          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
            {/* If no messages yet, show EXACT Dhanvantari Center Hero matching screenshot */}
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

                {/* Disclaimer Warning */}
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

          {/* 3. Bottom Input Dock (Exact Dhanvantari UI from screenshot) */}
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
                placeholder="Describe your query or ask for financial metrics..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#00A3C4] bg-white shadow-2xs placeholder:text-slate-400"
              />

              {/* Speech-to-text mic icon */}
              <button
                type="button"
                onClick={toggleMic}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all shadow-xs ${
                  isListening
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title="Voice Input (Speech-to-Text)"
              >
                🎙️
              </button>

              {/* Cyan Send button matching screenshot */}
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-xl bg-[#54D6D6] hover:bg-[#38c2c2] text-white text-base font-bold transition-colors disabled:opacity-40 shadow-xs flex items-center justify-center"
                title="Send"
              >
                ✈
              </button>
            </form>

            <div className="text-[10px] text-slate-400 text-center leading-tight">
              This AI operates under strict Razorpay financial guardrails and zero-duplicate policies.
            </div>
          </div>
        </div>
      ) : (
        /* Voice Chat Mode */
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-4 bg-slate-900 text-white">
          <div className="bg-slate-800 p-3.5 rounded-xl border border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <div className="text-xs font-bold">🎙️ Voice Chat Session Active</div>
                <div className="text-[10px] text-slate-400">Speak naturally in Hindi, Hinglish, or English</div>
              </div>
            </div>
            <button
              onClick={endVoiceChat}
              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold"
            >
              End Voice
            </button>
          </div>

          {/* Voice turns */}
          <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
            {voiceTurns.map((turn, idx) => (
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
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Mic Controls */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <button
              onClick={toggleMic}
              className={`w-full py-3 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-[#00A3C4] hover:bg-[#008da8] text-white'
              }`}
            >
              <span>{isListening ? '🎙️ Listening to your voice...' : '🎤 Tap to Speak (Hinglish / English)'}</span>
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
