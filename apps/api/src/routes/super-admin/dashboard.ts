import { Router } from 'express';
import { db } from '../../lib/db';
import { requireRole } from '../../middleware/auth';

const router = Router();
router.use(requireRole('super_admin'));

router.get('/summary', async (_req, res) => {
  const now = Date.now();
  const last24h = new Date(now - 24 * 60 * 60 * 1000);
  const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    totalSites,
    activeSites,
    suspendedSites,
    deploymentsTotal,
    deploymentsSuccess,
    deploymentsFailed,
    revenue7d,
    orders7d,
    openSeoIssues,
    pendingAiApprovals,
    incidentsOpen,
    recentAudit
  ] = await Promise.all([
    db.sites.count({ where: { is_deleted: false } }),
    db.sites.count({ where: { is_deleted: false, status: 'active' } }),
    db.sites.count({ where: { is_deleted: false, status: { in: ['disabled', 'maintenance'] } } }),
    db.deployment_jobs.count({ where: { created_at: { gte: last24h } } }),
    db.deployment_jobs.count({ where: { created_at: { gte: last24h }, status: 'success' } }),
    db.deployment_jobs.count({ where: { created_at: { gte: last24h }, status: { in: ['failed', 'rolled_back'] } } }),
    db.orders.aggregate({
      where: { created_at: { gte: last7d }, payment_status: 'paid' },
      _sum: { total: true }
    }),
    db.orders.count({ where: { created_at: { gte: last7d } } }),
    db.seo_audit_results.count({ where: { status: 'open' } }),
    db.ai_jobs.count({ where: { status: 'needs_approval' } }),
    db.email_logs.count({ where: { status: { in: ['queued', 'failed'] } } }),
    db.admin_activity_logs.findMany({
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        id: true,
        action: true,
        entity: true,
        entity_id: true,
        created_at: true,
        user_id: true,
        site_id: true
      }
    })
  ]);

  const successRate = deploymentsTotal > 0 ? deploymentsSuccess / deploymentsTotal : 0;
  const revenueValue = revenue7d._sum.total ? Number(revenue7d._sum.total) : 0;

  return res.json({
    ok: true,
    data: {
      sites: {
        total: totalSites,
        active: activeSites,
        suspended: suspendedSites
      },
      deployments: {
        window: '24h',
        total: deploymentsTotal,
        success: deploymentsSuccess,
        failed: deploymentsFailed,
        success_rate: successRate
      },
      revenue_usage: {
        window: '7d',
        paid_order_revenue: revenueValue,
        orders: orders7d
      },
      alerts: {
        open_seo_issues: openSeoIssues,
        pending_ai_approvals: pendingAiApprovals,
        incidents_open: incidentsOpen
      },
      recent_audit_events: recentAudit
    }
  });
});

export default router;
