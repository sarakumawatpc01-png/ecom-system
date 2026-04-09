import { Router } from 'express';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

router.get('/pages', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const grouped = await db.heatmap_events.groupBy({
    by: ['page_url'],
    where: { site_id: siteId },
    _count: { _all: true }
  });
  return res.json({ ok: true, data: grouped });
});

router.get('/sessions', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const grouped = await db.heatmap_events.groupBy({
    by: ['session_id'],
    where: { site_id: siteId },
    _count: { _all: true },
    orderBy: { session_id: 'asc' },
    take: 100
  });
  return res.json({ ok: true, data: grouped });
});

router.get('/funnels', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const [views, carts, checkouts, purchases] = await Promise.all([
    db.heatmap_events.count({ where: { site_id: siteId, event_type: 'page_view' } }),
    db.heatmap_events.count({ where: { site_id: siteId, event_type: 'add_to_cart' } }),
    db.heatmap_events.count({ where: { site_id: siteId, event_type: 'checkout_start' } }),
    db.orders.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { views, carts, checkouts, purchases } });
});

router.get('/alerts', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const [pages, purchases] = await Promise.all([
    db.heatmap_events.groupBy({ by: ['page_url'], where: { site_id: siteId, event_type: 'page_view' }, _count: { _all: true } }),
    db.orders.count({ where: { site_id: siteId } })
  ]);
  const highExit = pages.filter((item: (typeof pages)[number]) => item._count._all > 100).slice(0, 5);
  return res.json({
    ok: true,
    data: [
      ...highExit.map((item: (typeof highExit)[number]) => ({
        type: 'traffic',
        page_url: item.page_url,
        level: 'warning',
        count: item._count._all
      })),
      ...(purchases === 0 ? [{ type: 'sales', level: 'critical', message: 'No purchases recorded yet.' }] : [])
    ]
  });
});

router.get('/:pageUrl', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const pageUrl = decodeURIComponent(req.params.pageUrl);
  const events = await db.heatmap_events.findMany({
    where: { site_id: siteId, page_url: pageUrl },
    orderBy: { created_at: 'desc' },
    take: 1000
  });
  return res.json({ ok: true, data: events });
});

export default router;
