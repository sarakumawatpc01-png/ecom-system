import { Router } from 'express';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/google', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const orders = await db.orders.count({ where: { site_id: siteId, payment_status: 'paid' } });
  return res.json({ ok: true, data: { platform: 'google', attributed_orders: orders, status: 'connected' } });
});

router.get('/meta', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const visits = await db.heatmap_events.count({ where: { site_id: siteId, event_type: 'page_view' } });
  return res.json({ ok: true, data: { platform: 'meta', estimated_reach: visits, status: 'connected' } });
});

router.get('/recommendations', async (_req, res) => {
  return res.json({
    ok: true,
    data: [
      { type: 'budget', level: 'medium', message: 'Increase spend on top converting SKU groups by 15%.' },
      { type: 'creative', level: 'high', message: 'Rotate ad creatives every 14 days for sustained CTR.' }
    ]
  });
});

router.post('/utms', async (req, res) => {
  const utm = {
    source: String(req.body?.source || ''),
    medium: String(req.body?.medium || ''),
    campaign: String(req.body?.campaign || '')
  };
  if (!utm.source || !utm.medium || !utm.campaign) {
    return res.status(400).json({ ok: false, message: 'source, medium and campaign are required' });
  }
  return res.status(201).json({ ok: true, data: { ...utm, id: `utm_${Date.now()}` } });
});

router.get('/utms', async (_req, res) => {
  return res.json({ ok: true, data: [] });
});

export default router;
