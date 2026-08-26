'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface RiskIndicator {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

interface Episode {
  customer_id: string;
  episode_type: string;
  amount: number;
  channel: string;
  outcome: string;
  response_hours: number;
  notes: string;
  created_at: string;
}

interface CustomerDetail {
  customer_id: string;
  profile: Record<string, any>;
  channel_effectiveness: Record<string, number>;
  episodic_history: Episode[];
  active_events: any[];
  ai_overview: string;
  risk_indicators: RiskIndicator[];
}

const SEVERITY_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  high:   { bg: '#ef444422', color: '#ef4444', icon: '🔴' },
  medium: { bg: '#f59e0b22', color: '#f59e0b', icon: '🟡' },
  low:    { bg: '#22c55e22', color: '#22c55e', icon: '🟢' },
};

const CHANNEL_ICONS: Record<string, string> = {
  whatsapp: '💬', email: '📧', voice: '📞', telegram: '✈️', sms: '📱',
};

const OUTCOME_COLORS: Record<string, string> = {
  recovered: '#22c55e', paid: '#22c55e', kept: '#22c55e',
  no_response: '#ef4444', ignored: '#ef4444', broken: '#ef4444',
  partial: '#f59e0b', pending: '#94a3b8',
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#1a1f2e', border: '1px solid #1e293b', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || '#e2e8f0' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ChannelBar({ channel, rate }: { channel: string; rate: number }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 60 ? '#22c55e' : pct >= 35 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{ width: 80, fontSize: 13, color: '#94a3b8' }}>{CHANNEL_ICONS[channel] || '❓'} {channel}</span>
      <div style={{ flex: 1, height: 8, background: '#0f1117', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ width: 36, fontSize: 12, color, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

export default function CustomerDetailPage({ params }: { params: { customerId: string } }) {
  const { customerId } = params;
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/api/customers/${customerId}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(`Failed to load customer: ${e}`); setLoading(false); });
  }, [customerId]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      Loading customer profile...
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
      {error || 'Customer not found'}
    </div>
  );

  const { profile, channel_effectiveness, episodic_history, active_events, ai_overview, risk_indicators } = data;
  const reliability = profile.payment_reliability || 0;
  const reliabilityPct = Math.round(reliability * 100);
  const reliabilityColor = reliability >= 0.75 ? '#22c55e' : reliability >= 0.50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#1a1f2e', borderBottom: '1px solid #1e293b', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href={`/merchant/customers/${profile.merchant_id || 'merch_01'}`} style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>
          ← Customers
        </Link>
        <span style={{ color: '#334155' }}>|</span>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{profile.name}</h1>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{customerId} · {profile.language} · {profile.city}</div>
        </div>

        {/* Risk badge */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          {risk_indicators.length > 0 && (
            <span style={{ background: '#ef444422', color: '#ef4444', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
              ⚠️ {risk_indicators.filter(r => r.severity === 'high').length} High Risk Signals
            </span>
          )}
          {profile.telegram_chat_id ? (
            <span style={{ color: '#06b6d4', fontSize: 13 }}>✈️ Telegram Linked</span>
          ) : (
            <span style={{ color: '#475569', fontSize: 13 }}>No Telegram</span>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* LEFT COLUMN */}
        <div>
          {/* AI Overview */}
          <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1a1f2e 100%)', border: '1px solid #1e40af', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: '#60a5fa', marginBottom: 8, fontWeight: 600, letterSpacing: '0.08em' }}>🤖 AI RISK OVERVIEW</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: '#cbd5e1' }}>{ai_overview}</p>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <StatCard label="Reliability" value={`${reliabilityPct}%`} color={reliabilityColor} />
            <StatCard label="Risk Score" value={Math.round((profile.risk_score || 0) * 100)} sub="0–100" color={profile.risk_score > 0.6 ? '#ef4444' : '#f59e0b'} />
            <StatCard label="Failures" value={profile.total_failures || 0} color={profile.total_failures > 5 ? '#ef4444' : '#e2e8f0'} />
            <StatCard label="Recoveries" value={profile.total_recoveries || 0} color="#22c55e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
            <StatCard label="LTV" value={`₹${((profile.ltv_inr || 0) / 1000).toFixed(0)}k`} />
            <StatCard label="Avg Days Late" value={`${(profile.typical_payment_delay_days || 0).toFixed(1)}d`} />
            <StatCard label="Promise Accuracy" value={`${Math.round((profile.historical_promise_accuracy || 0) * 100)}%`} color={(profile.historical_promise_accuracy || 0) < 0.65 ? '#ef4444' : '#22c55e'} />
          </div>

          {/* Risk Indicators */}
          {risk_indicators.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Risk Signals</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {risk_indicators.map((r, i) => {
                  const s = SEVERITY_STYLE[r.severity] || SEVERITY_STYLE.low;
                  return (
                    <div key={i} style={{ background: s.bg, border: `1px solid ${s.color}44`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span>{s.icon}</span>
                      <span style={{ fontSize: 13, color: '#e2e8f0' }}>{r.message}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: s.color, fontWeight: 600 }}>{r.severity.toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Events */}
          {active_events.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Active Recovery Events</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {active_events.map(ev => (
                  <div key={ev.event_id} style={{ background: '#1a1f2e', border: '1px solid #1e293b', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{ev.event_type?.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{ev.root_cause || '—'} · {ev.event_id}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>₹{(ev.amount || 0).toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 11, color: ev.payment_status === 'recovered' ? '#22c55e' : ev.payment_status === 'escalated' ? '#f59e0b' : '#ef4444' }}>
                        {ev.payment_status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Episode History */}
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Episodic History ({episodic_history.length} entries)
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {episodic_history.length === 0 ? (
                <div style={{ color: '#475569', fontSize: 13, padding: 16, textAlign: 'center' }}>No history yet</div>
              ) : episodic_history.map((ep, i) => (
                <div key={i} style={{ background: '#1a1f2e', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 15 }}>{CHANNEL_ICONS[ep.channel] || '📋'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#e2e8f0' }}>{ep.episode_type?.replace(/_/g, ' ')}</div>
                    {ep.notes && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{ep.notes}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {ep.amount && <div style={{ fontSize: 13, color: '#94a3b8' }}>₹{ep.amount.toLocaleString('en-IN')}</div>}
                    {ep.outcome && (
                      <div style={{ fontSize: 11, color: OUTCOME_COLORS[ep.outcome] || '#94a3b8', marginTop: 2 }}>
                        {ep.outcome}
                        {ep.response_hours ? ` · ${ep.response_hours.toFixed(1)}h` : ''}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                      {ep.created_at ? new Date(ep.created_at).toLocaleDateString('en-IN') : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div>
          {/* Contact Info */}
          <div style={{ background: '#1a1f2e', border: '1px solid #1e293b', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contact</h3>
            {[
              { label: 'Email', value: profile.email },
              { label: 'Phone', value: profile.phone },
              { label: 'WhatsApp', value: profile.whatsapp_number },
              { label: 'Type', value: profile.customer_type },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#475569' }}>{row.label}</div>
                <div style={{ fontSize: 13, color: '#94a3b8' }}>{row.value || '—'}</div>
              </div>
            ))}
          </div>

          {/* Channel Effectiveness */}
          <div style={{ background: '#1a1f2e', border: '1px solid #1e293b', borderRadius: 12, padding: '20px', marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Channel Effectiveness</h3>
            {Object.entries(channel_effectiveness).length === 0 ? (
              <div style={{ color: '#475569', fontSize: 13 }}>No data yet</div>
            ) : (
              Object.entries(channel_effectiveness)
                .sort((a, b) => (b[1] as number) - (a[1] as number))
                .map(([ch, rate]) => <ChannelBar key={ch} channel={ch} rate={rate as number} />)
            )}
            <div style={{ fontSize: 11, color: '#334155', marginTop: 12 }}>
              Preferred: <span style={{ color: '#94a3b8' }}>{profile.preferred_channel}</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ background: '#1a1f2e', border: '1px solid #1e293b', borderRadius: 12, padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Actions</h3>
            {[
              { label: '💬 Send WhatsApp Recovery', color: '#22c55e' },
              { label: '📧 Send Email Link', color: '#60a5fa' },
              { label: '⚠️ Escalate to HITL', color: '#f59e0b' },
              { label: '⏸️ Pause Outreach', color: '#64748b' },
            ].map(action => (
              <button key={action.label} style={{ width: '100%', padding: '10px 14px', background: 'transparent', border: `1px solid ${action.color}44`, borderRadius: 8, color: action.color, fontSize: 13, cursor: 'pointer', marginBottom: 8, textAlign: 'left', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = action.color + '11')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
