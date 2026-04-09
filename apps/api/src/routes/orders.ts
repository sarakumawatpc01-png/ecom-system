import { Router } from 'express';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId, toPagination } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

router.get('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.orders.findMany({ where: { site_id: siteId }, skip, take: limit, orderBy: { created_at: 'desc' } }),
    db.orders.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.get('/export', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const items = await db.orders.findMany({
    where: { site_id: siteId },
    select: { id: true, order_number: true, status: true, payment_status: true, total: true, created_at: true }
  });
  return res.json({ ok: true, data: { format: 'json', items } });
});

router.get('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const order = await db.orders.findFirst({
    where: { site_id: siteId, id: req.params.id },
    include: { items: true }
  });
  if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });
  return res.json({ ok: true, data: order });
});

router.put('/:id/status', async (req, res) => {
  const siteId = getSiteId(req);
  const status = String(req.body?.status || '');
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  if (!status) return res.status(400).json({ ok: false, message: 'status is required' });
  const result = await db.orders.updateMany({ where: { site_id: siteId, id: req.params.id }, data: { status } });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Order not found' });
  const order = await db.orders.findFirst({ where: { site_id: siteId, id: req.params.id } });
  return res.json({ ok: true, data: order });
});

router.post('/:id/refund', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.orders.updateMany({
    where: { site_id: siteId, id: req.params.id },
    data: { payment_status: 'refunded', status: req.body?.status ? String(req.body.status) : 'refunded' }
  });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Order not found' });
  return res.json({ ok: true, data: { refunded: true } });
});

router.post('/webhook/razorpay', (_req, res) => res.json({ ok: true, data: { accepted: true } }));
router.post('/webhook/stripe', (_req, res) => res.json({ ok: true, data: { accepted: true } }));

export default router;
