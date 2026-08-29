import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') || '100';
  const merchantId = searchParams.get('merchant_id') || '';
  const rootCause = searchParams.get('root_cause') || '';

  // Try calling the FastAPI orchestrator backend
  try {
    const base = getApiBaseUrl();
    const backendUrl = `${base}/api/orchestrator/incidents?limit=${limit}${merchantId ? `&merchant_id=${merchantId}` : ''}${rootCause ? `&root_cause=${rootCause}` : ''}`;
    const res = await fetch(backendUrl, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }
  } catch {
    // Fallback: fetch directly from Supabase if FastAPI backend is starting
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const queryUrl = `${supabaseUrl}/rest/v1/events?select=*&order=amount.desc&limit=${limit}`;
      const res = await fetch(queryUrl, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const events = await res.json();
        const enriched = events.map((e: any) => {
          const evtType = e.event_type || 'subscription_failed';
          const amount = Number(e.amount) || 0;
          let archetype = 'standard_recovery';
          let strategy = 'Dynamic Payment Link via Preferred Channel';
          let status = 'auto_recovering';

          if (evtType === 'payment_degraded') {
            archetype = 'silent_route_reroute';
            strategy = 'Silent Route Retry via HDFC SmartHub (Zero Friction, 0 Contact)';
            status = 'recovered';
          } else if (evtType === 'mandate_auth_failed') {
            archetype = 'rbi_mandate_afa';
            strategy = `RBI AFA Mandate Re-auth Link via WhatsApp (EV = ₹${Math.round(amount * 0.88).toLocaleString('en-IN')})`;
            status = 'auto_recovering';
          } else if (evtType === 'receivable_overdue') {
            if (amount >= 100000) {
              archetype = 'enterprise_b2b_escalation';
              strategy = `HITL Escalation: ₹${amount.toLocaleString('en-IN')} exceeds ₹1,00,000 threshold`;
              status = 'pending_hitl';
            } else {
              archetype = 'progressive_dunning';
              strategy = 'Progressive B2B Reminder (Net Terms + WhatsApp PDF Invoice)';
              status = 'auto_recovering';
            }
          } else if (evtType === 'promise_to_pay') {
            archetype = 'promise_to_pay_active';
            strategy = 'Promise-to-Pay honored (Outreach paused until T+24h)';
            status = 'paused_ptp';
          } else if (evtType === 'checkout_abandoned') {
            archetype = 'comparison_window_shopping';
            strategy = `Margin Shield: 0% Discount Enforced (Preserved Margin)`;
            status = 'auto_recovering';
          } else if (evtType === 'subscription_failed') {
            if (amount >= 25000) {
              archetype = 'enterprise_white_glove';
              strategy = 'Enterprise White-Glove: Account Executive Telegram Escalation';
              status = amount >= 100000 ? 'pending_hitl' : 'auto_recovering';
            } else {
              archetype = 'involuntary_churn_engaged';
              strategy = 'Engaged Involuntary Churn: 14-Day Grace Period + Smart Pay-Cycle Retry';
              status = 'auto_recovering';
            }
          }

          return {
            id: e.event_id,
            customer: e.customer_name || `Customer ${e.customer_id}`,
            customerPhone: e.customer_phone || '+919876543210',
            customerEmail: e.customer_email || 'customer@example.com',
            customerId: e.customer_id,
            merchantId: e.merchant_id || 'merch_01',
            amount,
            rootCause: evtType,
            evRankedStrategy: strategy,
            status,
            archetype,
            maxAttempts: 2,
            currentAttempts: e.history?.prior_contacts || 0,
            duplicateContactBreaches: 0,
            link: e.metadata?.payment_link || `https://rzp.io/i/${(e.event_id || 'rec_plink').replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
            createdAt: e.created_at,
          };
        });

        const totalAtRisk = enriched.reduce((acc: number, i: any) => acc + i.amount, 0);
        const totalRecovered = enriched.filter((i: any) => i.status === 'recovered').reduce((acc: number, i: any) => acc + i.amount, 0);
        const pendingHitl = enriched.filter((i: any) => i.status === 'pending_hitl').length;
        const marginSaved = enriched.filter((i: any) => i.archetype === 'comparison_window_shopping').reduce((acc: number, i: any) => acc + Math.round(i.amount * 0.15), 0);

        return NextResponse.json({
          success: true,
          count: enriched.length,
          total_at_risk: totalAtRisk,
          total_recovered: totalRecovered,
          pending_hitl_count: pendingHitl,
          margin_saved_inr: marginSaved,
          duplicate_contacts: 0,
          incidents: enriched,
        });
      }
    } catch {
      // Return empty list on failure
    }
  }

  return NextResponse.json({
    success: false,
    count: 0,
    incidents: [],
  });
}
