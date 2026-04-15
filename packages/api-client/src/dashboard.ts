import { apiGet } from './http';

export type SuperAdminDashboardSummary = {
  sites: {
    total: number;
    active: number;
    suspended: number;
  };
  deployments: {
    window: string;
    total: number;
    success: number;
    failed: number;
    success_rate: number;
  };
  revenue_usage: {
    window: string;
    paid_order_revenue: number;
    orders: number;
  };
  alerts: {
    open_seo_issues: number;
    pending_ai_approvals: number;
    incidents_open: number;
  };
  recent_audit_events: Array<{
    id: string;
    action: string;
    entity: string;
    entity_id: string | null;
    created_at: string;
    user_id: string;
    site_id: string | null;
  }>;
};

export type SiteDashboardSummary = {
  sales_summary: {
    window: string;
    revenue: number;
  };
  orders_pending: number;
  low_inventory: number;
  active_products: number;
  customers_total: number;
  site_health: {
    open_seo_issues: number;
    traffic_events_24h: number;
  };
  tasks_alerts: {
    queued_or_failed_jobs: number;
  };
};

export const getSuperAdminDashboardSummary = async (baseUrl: string, token: string): Promise<SuperAdminDashboardSummary> => {
  const payload = await apiGet(baseUrl, '/api/super-admin/dashboard/summary', { token });
  return payload.data as SuperAdminDashboardSummary;
};

export const getSiteDashboardSummary = async (baseUrl: string, siteId: string, token: string): Promise<SiteDashboardSummary> => {
  const payload = await apiGet(baseUrl, `/api/${siteId}/dashboard/summary`, { token });
  return payload.data as SiteDashboardSummary;
};
