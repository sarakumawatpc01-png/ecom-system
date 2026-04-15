'use client';

import { useEffect, useState } from 'react';
import { SiteDashboardSummary, getSiteDashboardSummary } from '../../../packages/api-client/src/dashboard';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
const defaultSiteId = process.env.NEXT_PUBLIC_SITE_ID || '';

const tokenFromStorage = () =>
  globalThis.localStorage?.getItem('access_token') ||
  globalThis.localStorage?.getItem('auth:token') ||
  globalThis.localStorage?.getItem('token') ||
  '';

const siteIdFromStorage = () =>
  globalThis.localStorage?.getItem('active-site-id') ||
  globalThis.localStorage?.getItem('site_id') ||
  defaultSiteId;

export default function SiteAdminHome() {
  const [data, setData] = useState<SiteDashboardSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = tokenFromStorage();
    const siteId = siteIdFromStorage();
    if (!token) {
      setError('Missing access token in localStorage');
      return;
    }
    if (!siteId) {
      setError('Missing site context. Set NEXT_PUBLIC_SITE_ID or localStorage active-site-id.');
      return;
    }
    getSiteDashboardSummary(apiBase, siteId, token)
      .then(setData)
      .catch((fetchError) => setError(fetchError instanceof Error ? fetchError.message : 'Unable to load dashboard'));
  }, []);

  const cards = [
    ['Revenue (7d)', `₹${(data?.sales_summary.revenue ?? 0).toFixed(2)}`],
    ['Orders pending', String(data?.orders_pending ?? 0)],
    ['Low inventory', String(data?.low_inventory ?? 0)],
    ['Active products', String(data?.active_products ?? 0)],
    ['Customers', String(data?.customers_total ?? 0)],
    ['SEO open issues', String(data?.site_health.open_seo_issues ?? 0)],
    ['Traffic events (24h)', String(data?.site_health.traffic_events_24h ?? 0)],
    ['Queued/failed tasks', String(data?.tasks_alerts.queued_or_failed_jobs ?? 0)]
  ];

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <h1 style={{ margin: 0 }}>Dashboard</h1>
      <p style={{ color: '#9CA3AF', margin: 0 }}>Site-scoped dashboard. Cross-site data is intentionally not shown.</p>
      {error ? <p style={{ color: '#f87171' }}>{error}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {cards.map(([label, value]) => (
          <article key={label} style={{ border: '1px solid #2E2E2E', borderRadius: 10, padding: 12, background: '#1A1A1A' }}>
            <p style={{ margin: 0, color: '#9CA3AF', fontSize: 12 }}>{label}</p>
            <p style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 600 }}>{value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
