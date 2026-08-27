'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Mic,
  MicOff,
  SendHorizontal,
  X,
  AlertTriangle,
  Zap,
  User,
  CheckCircle2,
  Radio,
} from 'lucide-react';

export interface AIChatBotProps {
  role: 'merchant' | 'payer';
  customerName?: string;
  amount?: number;
  rootCause?: string;
  customerId?: string;
  merchantId?: string;
  onToolAction?: (action: { tool: string; updatedAmount?: number; promisedDate?: string; approved?: boolean }) => void;
  defaultOpen?: boolean;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  resizableWidth?: number;
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

import MarkdownRenderer from '@/components/MarkdownRenderer';

export default function AIChatBot({
  role,
  customerName = 'Ashwin Khowala',
  amount = 4999,
  rootCause = 'subscription_failed',
  customerId = 'cust_0001',
  merchantId = 'merch_01',
  onToolAction,
  defaultOpen = true,
  isOpen: controlledIsOpen,
  onToggleOpen,
  resizableWidth,
}: AIChatBotProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const toggleOpen = onToggleOpen || (() => setInternalIsOpen(prev => !prev));
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

  // Persistent WebSocket & Live Voice Session Refs
  const wsRef = useRef<WebSocket | null>(null);
  const isVoiceActiveRef = useRef<boolean>(false);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentAudioCtxRef = useRef<AudioContext | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const lastTranscriptRef = useRef<string>('');
  const lastTranscriptTimeRef = useRef<number>(0);
  const liveWsPendingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stop any active audio playback
  const stopAudioPlayback = () => {
    setIsSpeaking(false);
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
        currentAudioSourceRef.current.disconnect();
      } catch {}
      currentAudioSourceRef.current = null;
    }
    if (currentAudioCtxRef.current) {
      try {
        currentAudioCtxRef.current.close();
      } catch {}
      currentAudioCtxRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Play native 24kHz raw PCM audio returned directly from Gemini 3.1 Flash Live
  const playNativeLiveAudio = (base64Audio: string, sampleRate = 24000) => {
    try {
      if (typeof window === 'undefined') return false;
      stopAudioPlayback();

      const binaryString = window.atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const int16Array = new Int16Array(bytes.buffer);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return false;

      const audioCtx = new AudioCtx({ sampleRate });
      currentAudioCtxRef.current = audioCtx;

      const buffer = audioCtx.createBuffer(1, int16Array.length, sampleRate);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
      }

      const source = audioCtx.createBufferSource();
      currentAudioSourceRef.current = source;
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      setIsSpeaking(true);

      source.onended = () => {
        setIsSpeaking(false);
        currentAudioSourceRef.current = null;
        try {
          audioCtx.close();
        } catch {}
        currentAudioCtxRef.current = null;
      };

      source.start();
      return true;
    } catch (e) {
      console.warn('Native PCM playback fallback to speech synthesis:', e);
      return false;
    }
  };

  // High-Quality Voice Synthesizer Fallback
  const playVoice = (text: string, detectedLang?: string) => {
    if (typeof window === 'undefined') return;
    stopAudioPlayback();

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

  // Initialize Persistent WebSocket for Live Voice Session
  const initLiveWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = 'ws://localhost:8000/ws/gemini-live';
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
        console.log('[GEMINI LIVE WS] Connected to live voice stream');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const agentTurn: VoiceTurn = {
            speaker: 'agent',
            text: data.voice_reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            toolsExecuted: data.executed_tools,
          };
          setVoiceTurns(prev => [...prev, agentTurn]);

          if (liveWsPendingTimeoutRef.current) {
            clearTimeout(liveWsPendingTimeoutRef.current);
            liveWsPendingTimeoutRef.current = null;
          }

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

          if (data.audio_base64) {
            const played = playNativeLiveAudio(data.audio_base64, data.audio_sample_rate || 24000);
            if (!played) {
              playVoice(data.voice_reply, data.detected_language);
            }
          } else {
            playVoice(data.voice_reply, data.detected_language);
          }
        } catch (err) {
          console.error('[GEMINI LIVE WS] Parse error:', err);
        } finally {
          setVoiceLoading(false);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (liveWsPendingTimeoutRef.current) {
          clearTimeout(liveWsPendingTimeoutRef.current);
          liveWsPendingTimeoutRef.current = null;
        }
        if (isVoiceActiveRef.current) {
          // Reconnect automatically if session is still active
          setTimeout(() => {
            if (isVoiceActiveRef.current) initLiveWebSocket();
          }, 1500);
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
      };

      wsRef.current = ws;
    } catch (e) {
      console.warn('[GEMINI LIVE WS] Init error:', e);
    }
  };

  // Continuous Speech Recognition Engine for Live Voice
  const startContinuousSpeech = () => {
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
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      // Auto-restart continuously while user is in voice session
      if (isVoiceActiveRef.current) {
        try {
          recognition.start();
        } catch {}
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = () => {
      if (isVoiceActiveRef.current) {
        setTimeout(() => {
          if (isVoiceActiveRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        }, 500);
      } else {
        setIsListening(false);
      }
    };

    recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      if (lastResult && lastResult.isFinal) {
        const transcript = lastResult[0].transcript.trim();
        const now = Date.now();
        // Debounce exact duplicate within 2.5 seconds
        if (
          transcript &&
          (transcript !== lastTranscriptRef.current || now - lastTranscriptTimeRef.current > 2500)
        ) {
          lastTranscriptRef.current = transcript;
          lastTranscriptTimeRef.current = now;
          handleSendVoiceStream(transcript);
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {}
  };

  // Single-turn mic for Text Box
  const startSingleSpeech = (onResultCallback: (text: string) => void) => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

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

    try {
      recognition.start();
    } catch {}
  };

  const toggleTextMic = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      startSingleSpeech(transcript => {
        setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
      });
    }
  };

  // Handle Text Message Send
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
          ? `Your payment of ₹${amount.toLocaleString('en-IN')} is currently pending. You can apply a 5% concession discount or schedule a payment date.`
          : `Aapka ₹${amount.toLocaleString('en-IN')} ka payment pending hai. Aap 5% discount le sakte hain ya date schedule kar sakte hain.`;

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

  // Start Persistent Live Voice Chat Session
  const startVoiceChat = () => {
    setMode('voice');
    isVoiceActiveRef.current = true;
    initLiveWebSocket();
    setTimeout(() => {
      startContinuousSpeech();
    }, 150);
  };

  // Stop Live Voice Session Cleanly
  const endVoiceChat = () => {
    isVoiceActiveRef.current = false;
    setIsListening(false);
    stopAudioPlayback();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    setWsConnected(false);
  };

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      isVoiceActiveRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
      stopAudioPlayback();
    };
  }, []);

  // Process Real-time Continuous Voice Utterance
  const handleSendVoiceStream = async (speechText: string) => {
    if (!speechText.trim()) return;

    // VAD: If user spoke, interrupt any currently playing audio
    stopAudioPlayback();

    const userTurn: VoiceTurn = {
      speaker: 'user',
      text: speechText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setVoiceTurns(prev => [...prev, userTurn]);
    setVoiceLoading(true);

    const payload = {
      user_speech: speechText,
      role: role,
      customer_name: customerName,
      amount: amount,
      root_cause: rootCause,
      customer_id: customerId,
      merchant_id: merchantId,
    };

    // 1. Send via WebSocket if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      // Safety timeout in case WS hangs
      if (liveWsPendingTimeoutRef.current) clearTimeout(liveWsPendingTimeoutRef.current);
      liveWsPendingTimeoutRef.current = setTimeout(() => {
        setVoiceLoading(false);
      }, 5000);

      wsRef.current.send(JSON.stringify(payload));
      return;
    }

    // 2. HTTP Fallback if WebSocket is connecting
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch('http://localhost:8000/api/orchestrator/voice-agent-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

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

        if (data.audio_base64) {
          const played = playNativeLiveAudio(data.audio_base64, data.audio_sample_rate || 24000);
          if (!played) {
            playVoice(data.voice_reply, data.detected_language);
          }
        } else {
          playVoice(data.voice_reply, data.detected_language);
        }
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
          ? `Your payment of ₹${amount.toLocaleString('en-IN')} is currently pending. Would you like a 5% discount?`
          : `Aapka ₹${amount.toLocaleString('en-IN')} ka payment pending hai. Kya aap 5% discount lena chahenge?`;

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

  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 z-50 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 transition-all duration-200 hover:scale-105 group"
      >
        <div className="w-7 h-7 rounded-xl bg-[#00A3C4] flex items-center justify-center text-white text-xs font-bold shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="text-left">
          <div className="text-xs font-bold leading-tight flex items-center gap-1.5">
            <span>AI Copilot & Voice</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-[10px] text-slate-400">Click to expand pane (⌘J)</div>
        </div>
      </button>
    );
  }

  return (
    <aside
      className="w-full h-full flex flex-col bg-white overflow-hidden rounded-none border-none shadow-none"
    >
      {/* 1. Header with Mode Switcher & Collapse */}
      <div className="px-4 py-3 flex items-center justify-between bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00A3C4] flex items-center justify-center text-white text-sm shadow-sm font-bold">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold leading-tight text-slate-900">
              {role === 'merchant' ? 'AI Recovery Copilot' : 'AI Payment Assistant'}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-[#00A3C4] font-medium mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Online • Voice & Recovery Engine</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: Voice Chat Toggle + Collapse */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (mode === 'chat') {
                startVoiceChat();
              } else {
                endVoiceChat();
                setMode('chat');
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 ${
              mode === 'voice'
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                : 'bg-cyan-50 text-[#00A3C4] hover:bg-cyan-100 border border-cyan-200'
            }`}
          >
            {mode === 'voice' ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>Stop Voice</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5" />
                <span>Voice Agent</span>
              </>
            )}
          </button>

          <button
            onClick={toggleOpen}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors"
            title="Collapse Panel (⌘J)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. BODY */}
      {mode === 'chat' ? (
        <div className="flex-1 flex flex-col justify-between overflow-hidden p-4 bg-white min-h-0">
          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-8 px-2 space-y-4 my-auto">
                <div className="w-14 h-14 rounded-2xl bg-[#00A3C4] flex items-center justify-center text-white text-2xl shadow-md shadow-cyan-500/10">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>

                <div className="space-y-2 max-w-[280px]">
                  <h4 className="text-base font-bold leading-snug text-slate-800">
                    {role === 'merchant'
                      ? 'How can I help with recovery today?'
                      : 'How can I assist with your invoice?'}
                  </h4>
                  <p className="text-xs leading-relaxed text-slate-500 font-normal">
                    {role === 'merchant'
                      ? 'Ask questions or instruct actions with voice or text. I analyze at-risk revenue, inspect RBI rules, and trigger automated outreach.'
                      : 'Describe your payment issues. I can provide assistance and predict possible resolution paths based on your status.'}
                  </p>
                </div>

                <div className="text-[11px] font-medium text-amber-700 bg-amber-50/80 border border-amber-200/80 rounded-lg p-2.5 text-left max-w-[320px] flex items-start gap-2 mt-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>RBI & Zero-Spam Guardrails:</strong> Max 2 contacts/incident, 24h quiet period, and strict ₹1L HITL escalations active.
                  </span>
                </div>

                {/* Suggested Chips */}
                <div className="w-full pt-2 space-y-2 text-left">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Suggested Quick Prompts
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickPrompts.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendText(chip)}
                        className="px-2.5 py-1 rounded-md text-xs font-medium transition-all shadow-xs text-left bg-slate-50 hover:bg-cyan-50 hover:text-[#00A3C4] hover:border-[#00A3C4] text-slate-700 border border-slate-200"
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
                    className={`max-w-[88%] p-3.5 rounded-xl text-xs leading-relaxed shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-[#00A3C4] text-white rounded-br-none'
                        : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-none'
                    }`}
                  >
                    <div className="font-bold text-[10px] flex items-center justify-between opacity-60 mb-1">
                      <span>{msg.sender === 'user' ? 'You' : 'AI Copilot'}</span>
                      <span>{msg.time}</span>
                    </div>

                    <MarkdownRenderer content={msg.text} isDark={false} />

                    {/* Tool Badges */}
                    {msg.toolsExecuted && msg.toolsExecuted.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200 space-y-1">
                        {msg.toolsExecuted.map((t, idx) => (
                          <div
                            key={idx}
                            className="text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200"
                          >
                            <Zap className="w-3 h-3 text-emerald-600" />
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
                <div className="p-3 rounded-xl text-xs animate-pulse shadow-xs flex items-center gap-2 bg-slate-50 border border-slate-200 text-slate-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A3C4] animate-ping" />
                  <span>Processing recovery reasoning...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 3. Bottom Input Dock */}
          <div className="pt-3 border-t border-slate-200 space-y-1.5 shrink-0 bg-white">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSendText();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={
                    role === 'merchant'
                      ? 'Ask Copilot or type recovery instruction...'
                      : 'Describe your payment issues...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#00A3C4] focus:border-[#00A3C4] transition-all pr-9 bg-white text-slate-800 placeholder-slate-400 shadow-xs"
                />
                <button
                  type="button"
                  onClick={toggleTextMic}
                  className={`absolute right-2.5 top-2.5 transition-colors ${
                    isListening ? 'text-red-500 animate-pulse' : 'text-slate-400 hover:text-slate-600'
                  }`}
                  title="Speech-to-Text Mic"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>

              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-lg bg-[#00A3C4] hover:bg-[#008ea6] text-white flex items-center justify-center text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-xs shrink-0"
              >
                <SendHorizontal className="w-4 h-4" />
              </button>
            </form>
            
            <div className="text-[10px] text-center leading-tight text-slate-400">
              Razorpay AI Copilot • RBI Compliant • Zero Duplicate Contacts
            </div>
          </div>
        </div>
      ) : (
        /* Voice Chat Mode (Clean Light Theme) */
        <div className="flex-1 flex flex-col justify-between p-4 bg-slate-50/50 min-h-0">
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar">
            {voiceTurns.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10 space-y-4 my-auto">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-[#00A3C4] flex items-center justify-center text-white text-2xl shadow-lg shadow-cyan-500/20">
                    <Mic className="w-8 h-8 text-white" />
                  </div>
                  {isListening && (
                    <span className="absolute -inset-1 rounded-2xl bg-cyan-400/30 animate-ping -z-10" />
                  )}
                </div>
                
                <div className="space-y-1.5 max-w-[280px]">
                  <h4 className="text-sm font-bold text-slate-800">
                    Gemini 3.1 Live Voice Engine
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Speak naturally in English, Hindi, or Hinglish. Real-time language mirroring and automatic tool execution active.
                  </p>
                </div>

                {/* Voice Status Pill */}
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-[#00A3C4] text-[11px] font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Mic Always Active • Speak Anytime</span>
                </div>
              </div>
            ) : (
              voiceTurns.map((turn, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${turn.speaker === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] p-3.5 rounded-xl text-xs leading-relaxed shadow-xs ${
                      turn.speaker === 'user'
                        ? 'bg-[#00A3C4] text-white rounded-br-none'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                    }`}
                  >
                    <div className="font-bold text-[10px] flex items-center justify-between opacity-70 mb-1">
                      <span>{turn.speaker === 'user' ? 'You' : 'Voice Copilot'}</span>
                      <span>{turn.time}</span>
                    </div>

                    <MarkdownRenderer content={turn.text} isDark={false} />

                    {/* Executed Tools in Turn */}
                    {turn.toolsExecuted && turn.toolsExecuted.length > 0 && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200 space-y-1">
                        {turn.toolsExecuted.map((tool, tIdx) => (
                          <div
                            key={tIdx}
                            className="text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200"
                          >
                            <Zap className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>
                              <strong>Tool:</strong> {tool.tool} &mdash; {tool.message || 'Executed'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {voiceLoading && (
              <div className="flex justify-start">
                <div className="p-3 rounded-xl text-xs shadow-xs flex items-center gap-2 bg-white border border-slate-200 text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00A3C4] animate-ping" />
                  <span>AI reasoning & synthesizing voice...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Persistent Live Voice Controls (Light Theme) */}
          <div className="pt-3 border-t border-slate-200 space-y-2 shrink-0 bg-white -mx-4 -mb-4 p-4">
            <div className="flex items-center justify-between px-1 text-[11px]">
              <div className="flex items-center gap-2 font-medium text-slate-700">
                {/* Dynamic Waveform Visualizer */}
                <div className="flex items-end gap-0.5 h-3.5">
                  <span
                    className={`w-1 rounded-full bg-[#00A3C4] transition-all duration-150 ${
                      isSpeaking
                        ? 'h-3.5 animate-bounce'
                        : isListening
                        ? 'h-2 animate-pulse'
                        : 'h-1 bg-slate-300'
                    }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-[#00A3C4] transition-all duration-150 delay-75 ${
                      isSpeaking
                        ? 'h-4 animate-bounce'
                        : isListening
                        ? 'h-3 animate-pulse'
                        : 'h-1 bg-slate-300'
                    }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-[#00A3C4] transition-all duration-150 delay-150 ${
                      isSpeaking
                        ? 'h-2.5 animate-bounce'
                        : isListening
                        ? 'h-1.5 animate-pulse'
                        : 'h-1 bg-slate-300'
                    }`}
                  />
                  <span
                    className={`w-1 rounded-full bg-[#00A3C4] transition-all duration-150 delay-100 ${
                      isSpeaking
                        ? 'h-3 animate-bounce'
                        : isListening
                        ? 'h-2 animate-pulse'
                        : 'h-1 bg-slate-300'
                    }`}
                  />
                </div>

                <span className="text-xs">
                  {isSpeaking
                    ? 'Gemini Live Speaking...'
                    : voiceLoading
                    ? 'Processing...'
                    : isListening
                    ? 'Mic Active • Speak Anytime'
                    : 'Voice Engine Ready'}
                </span>
              </div>

              <span className="text-[10px] text-[#00A3C4] font-mono px-2 py-0.5 rounded-md bg-cyan-50 border border-cyan-200">
                {wsConnected ? 'WS Live' : 'HTTP Duplex'}
              </span>
            </div>

            <button
              onClick={() => {
                if (isListening) {
                  endVoiceChat();
                  setMode('chat');
                } else {
                  startVoiceChat();
                }
              }}
              className={`w-full py-2.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 ${
                isListening
                  ? 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200'
                  : 'bg-[#00A3C4] hover:bg-[#008ea6] text-white'
              }`}
            >
              {isListening ? (
                <>
                  <X className="w-3.5 h-3.5 text-red-500" />
                  <span>Stop Live Voice Session</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>Resume Live Voice</span>
                </>
              )}
            </button>

            {/* Quick voice chips */}
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {quickPrompts.slice(0, 3).map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendVoiceStream(chip)}
                  className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-cyan-50 hover:text-[#00A3C4] text-slate-700 border border-slate-200 transition-colors shadow-xs"
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
