'use client';

import { useEffect, useState } from 'react';
import { SuperAdminDashboardSummary, getSuperAdminDashboardSummary } from '../../../packages/api-client/src/dashboard';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

const tokenFromStorage = () =>
  globalThis.localStorage?.getItem('access_token') ||
  globalThis.localStorage?.getItem('auth:token') ||
  globalThis.localStorage?.getItem('token') ||
  '';

export default function SuperAdminHome() {
  const [data, setData] = useState<SuperAdminDashboardSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = tokenFromStorage();
    if (!token) {
      setError('Missing access token in localStorage');
      return;
    }
    getSuperAdminDashboardSummary(apiBase, token)
      .then(setData)
      .catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : 'Unable to load dashboard'));
  }, []);

  const cards = [
    ['Sites total', String(data?.sites.total ?? 0)],
    ['Sites active', String(data?.sites.active ?? 0)],
    ['Sites suspended', String(data?.sites.suspended ?? 0)],
    ['Deploy success (24h)', `${Math.round((data?.deployments.success_rate ?? 0) * 100)}%`],
    ['Paid revenue (7d)', `₹${(data?.revenue_usage.paid_order_revenue ?? 0).toFixed(2)}`],
    ['Orders (7d)', String(data?.revenue_usage.orders ?? 0)],
    ['Open incidents', String(data?.alerts.incidents_open ?? 0)],
    ['Open SEO issues', String(data?.alerts.open_seo_issues ?? 0)]
  ];

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h1 style={{ margin: 0 }}>Dashboard</h1>
      <p style={{ color: '#9CA3AF', margin: 0 }}>Cross-site overview dashboard with global site scoping.</p>
      {error ? <p style={{ color: '#f87171' }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {cards.map(([label, value]) => (
          <article key={label} style={{ border: '1px solid #2E2E2E', borderRadius: 10, padding: 12, background: '#1A1A1A' }}>
            <p style={{ margin: 0, color: '#9CA3AF', fontSize: 12 }}>{label}</p>
            <p style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 600 }}>{value}</p>
          </article>
        ))}
      </div>

      <section>
        <h2 style={{ marginBottom: 8, fontSize: 16 }}>Recent audit events</h2>
        {!data?.recent_audit_events?.length ? (
          <p style={{ margin: 0, color: '#9CA3AF' }}>No recent events.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18, color: '#D1D5DB' }}>
            {data.recent_audit_events.map((event) => (
              <li key={event.id}>
                {event.action} · {event.entity} · {new Date(event.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
