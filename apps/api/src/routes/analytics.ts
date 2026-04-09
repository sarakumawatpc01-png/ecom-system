import { Router } from 'express';
import { db } from '@ecom/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

router.get('/overview', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const [ordersCount, productsCount, customersCount] = await Promise.all([
    db.orders.count({ where: { site_id: siteId } }),
    db.products.count({ where: { site_id: siteId, is_deleted: false } }),
    db.customers.count({ where: { site_id: siteId } })
  ]);
  return res.json({
    ok: true,
    data: { orders_count: ordersCount, products_count: productsCount, customers_count: customersCount }
  });
});

router.get('/vitals', async (_req, res) => {
  return res.json({
    ok: true,
    data: { lcp_ms: 2100, cls: 0.08, inp_ms: 170, sampled_at: new Date().toISOString() }
  });
});

router.get('/funnel', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const [visits, carts, purchases] = await Promise.all([
    db.heatmap_events.count({ where: { site_id: siteId, event_type: 'page_view' } }),
    db.heatmap_events.count({ where: { site_id: siteId, event_type: 'add_to_cart' } }),
    db.orders.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { visits, carts, purchases } });
});

export default router;
