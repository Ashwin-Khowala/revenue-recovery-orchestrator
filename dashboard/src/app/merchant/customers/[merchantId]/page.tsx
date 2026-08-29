'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Mail,
  Phone,
  Send,
  Smartphone,
  CheckCircle2,
  FileText,
} from 'lucide-react';

import { getApiBaseUrl } from '@/lib/api';

const API = getApiBaseUrl();

interface CustomerRow {
  customer_id: string;
  name: string;
  email: string;
  phone: string;
  preferred_channel: string;
  language: string;
  payment_reliability: number;
  risk_score: number;
  total_failures: number;
  total_recoveries: number;
  ltv_inr: number;
  telegram_chat_id: string | null;
  whatsapp_response_rate: number;
  updated_at: string;
}

const RISK_COLOR = (score: number) => {
  if (score >= 0.7) return '#ef4444';
  if (score >= 0.4) return '#f59e0b';
  return '#22c55e';
};

function renderChannelIcon(channel: string) {
  switch (channel) {
    case 'whatsapp':
      return <MessageSquare style={{ width: 14, height: 14, color: '#22c55e' }} />;
    case 'email':
      return <Mail style={{ width: 14, height: 14, color: '#60a5fa' }} />;
    case 'voice':
      return <Phone style={{ width: 14, height: 14, color: '#f59e0b' }} />;
    case 'telegram':
      return <Send style={{ width: 14, height: 14, color: '#06b6d4' }} />;
    case 'sms':
      return <Smartphone style={{ width: 14, height: 14, color: '#a855f7' }} />;
    default:
      return <FileText style={{ width: 14, height: 14, color: '#94a3b8' }} />;
  }
}

export default function CustomersPage({ params }: { params: { merchantId: string } }) {
  const merchantId = params?.merchantId || 'merch_01';
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('risk_score');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/merchants/${merchantId}/customers?page=${page}&sort_by=${sortBy}&page_size=50`)
        .then(r => r.json()).catch(() => ({ customers: [], total: 0 })),
      fetch(`${API}/api/merchants/${merchantId}/at-risk-summary`)
        .then(r => r.json()).catch(() => null),
    ]).then(([data, sum]) => {
      setCustomers(data.customers || []);
      setTotal(data.total || 0);
      setSummary(sum);
      setLoading(false);
    });
  }, [merchantId, page, sortBy]);

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1a1f2e 0%, #0f1117 100%)', borderBottom: '1px solid #1e293b', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link href="/merchant" style={{ color: '#64748b', textDecoration: 'none', fontSize: 14 }}>← Dashboard</Link>
        <span style={{ color: '#334155' }}>|</span>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#e2e8f0' }}>Customer Intelligence</h1>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#64748b' }}>{total.toLocaleString()} customers</span>
      </div>

      {/* Summary Bar */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '20px 32px' }}>
          {[
            { label: 'At-Risk Revenue', value: `₹${(summary.at_risk_amount_inr || 0).toLocaleString('en-IN')}`, color: '#ef4444' },
            { label: 'At-Risk Accounts', value: summary.at_risk_count || 0, color: '#f59e0b' },
            { label: 'Recovery Rate', value: `${(summary.recovery_rate_pct || 0).toFixed(1)}%`, color: '#22c55e' },
            { label: 'Duplicate Contacts', value: summary.duplicate_contacts ?? 0, color: '#06b6d4' },
          ].map(stat => (
            <div key={stat.label} style={{ background: '#1a1f2e', border: '1px solid #1e293b', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{stat.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ padding: '0 32px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, or ID..."
          style={{ flex: 1, maxWidth: 340, padding: '8px 14px', background: '#1a1f2e', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none' }}
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ padding: '8px 14px', background: '#1a1f2e', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14 }}
        >
          <option value="risk_score">Sort: Risk Score</option>
          <option value="payment_reliability">Sort: Reliability</option>
          <option value="total_failures">Sort: Failures</option>
          <option value="ltv_inr">Sort: LTV</option>
        </select>
        <span style={{ fontSize: 13, color: '#64748b' }}>
          Page {page} · {filtered.length} shown
        </span>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
          style={{ padding: '6px 14px', background: '#1e293b', border: 'none', borderRadius: 6, color: '#94a3b8', cursor: 'pointer' }}>←</button>
        <button onClick={() => setPage(p => p + 1)} disabled={customers.length < 50}
          style={{ padding: '6px 14px', background: '#1e293b', border: 'none', borderRadius: 6, color: '#94a3b8', cursor: 'pointer' }}>→</button>
      </div>

      {/* Table */}
      <div style={{ padding: '0 32px 40px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b', color: '#64748b', textAlign: 'left' }}>
              {['Customer', 'Channel', 'Language', 'Reliability', 'Risk', 'Failures', 'Recoveries', 'LTV', 'Telegram', 'Action'].map(h => (
                <th key={h} style={{ padding: '10px 12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>No customers found</td></tr>
            ) : filtered.map((c, i) => (
              <tr key={c.customer_id} style={{ borderBottom: '1px solid #1a1f2e', background: i % 2 === 0 ? 'transparent' : '#0d1117', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1a1f2e')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : '#0d1117')}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{c.customer_id}</div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {renderChannelIcon(c.preferred_channel)}
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{c.preferred_channel}</span>
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{c.language}</td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${(c.payment_reliability || 0) * 100}%`, height: '100%', background: RISK_COLOR(1 - (c.payment_reliability || 0)), borderRadius: 3 }} />
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{((c.payment_reliability || 0) * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ background: RISK_COLOR(c.risk_score) + '22', color: RISK_COLOR(c.risk_score), padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                    {((c.risk_score || 0) * 100).toFixed(0)}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: c.total_failures > 5 ? '#ef4444' : '#94a3b8' }}>{c.total_failures}</td>
                <td style={{ padding: '10px 12px', color: '#22c55e' }}>{c.total_recoveries}</td>
                <td style={{ padding: '10px 12px', color: '#94a3b8' }}>₹{((c.ltv_inr || 0) / 1000).toFixed(0)}k</td>
                <td style={{ padding: '10px 12px' }}>
                  {c.telegram_chat_id ? (
                    <span style={{ color: '#06b6d4', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 style={{ width: 12, height: 12 }} />
                      <span>Linked</span>
                    </span>
                  ) : (
                    <span style={{ color: '#475569', fontSize: 12 }}>—</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <Link href={`/merchant/customers/${merchantId}/${c.customer_id}`}
                    style={{ padding: '4px 12px', background: '#1e40af', color: '#93c5fd', borderRadius: 6, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                    View Profile
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
