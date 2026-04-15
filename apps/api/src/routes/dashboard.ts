import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

router.get('/summary', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) {
    return res.status(400).json({ ok: false, message: 'Missing site scope' });
  }
  const uuidCheck = z.string().uuid().safeParse(siteId);
  if (!uuidCheck.success) {
    return res.status(400).json({ ok: false, message: 'Invalid site scope' });
  }

  const now = Date.now();
  const last24h = new Date(now - 24 * 60 * 60 * 1000);
  const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [salesAgg, pendingOrders, lowInventoryRaw, productsActive, customersTotal, openSeoIssues, taskQueueOpen] = await Promise.all([
    db.orders.aggregate({
      where: { site_id: siteId, created_at: { gte: last7d }, payment_status: 'paid' },
      _sum: { total: true }
    }),
    db.orders.count({ where: { site_id: siteId, status: { in: ['pending', 'confirmed', 'processing'] } } }),
    db.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::bigint AS count
      FROM products
      WHERE site_id = ${siteId}::uuid
        AND is_deleted = false
        AND track_inventory = true
        AND stock_qty <= low_stock_threshold
    `,
    db.products.count({ where: { site_id: siteId, is_deleted: false, status: 'active' } }),
    db.customers.count({ where: { site_id: siteId } }),
    db.seo_audit_results.count({ where: { site_id: siteId, status: 'open' } }),
    db.email_logs.count({ where: { site_id: siteId, status: { in: ['queued', 'failed'] } } })
  ]);

  const sales7d = salesAgg._sum.total ? Number(salesAgg._sum.total) : 0;
  const lowInventory = Number(lowInventoryRaw[0]?.count || 0);
  const snapshots = await db.heatmap_events.count({ where: { site_id: siteId, created_at: { gte: last24h } } });

  return res.json({
    ok: true,
    data: {
      sales_summary: {
        window: '7d',
        revenue: sales7d
      },
      orders_pending: pendingOrders,
      low_inventory: lowInventory,
      active_products: productsActive,
      customers_total: customersTotal,
      site_health: {
        open_seo_issues: openSeoIssues,
        traffic_events_24h: snapshots
      },
      tasks_alerts: {
        queued_or_failed_jobs: taskQueueOpen
      }
    }
  });
});

export default router;
