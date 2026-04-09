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
    db.reviews.findMany({ where: { site_id: siteId }, orderBy: { created_at: 'desc' }, skip, take: limit }),
    db.reviews.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.get('/flagged', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const items = await db.reviews.findMany({ where: { site_id: siteId, is_flagged: true }, orderBy: { created_at: 'desc' } });
  return res.json({ ok: true, data: items });
});

router.put('/:id/approve', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.reviews.updateMany({
    where: { site_id: siteId, id: req.params.id },
    data: { status: 'approved', is_flagged: false }
  });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Review not found' });
  return res.json({ ok: true });
});

router.put('/:id/reject', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.reviews.updateMany({
    where: { site_id: siteId, id: req.params.id },
    data: { status: 'rejected', is_flagged: true }
  });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Review not found' });
  return res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.reviews.deleteMany({ where: { site_id: siteId, id: req.params.id } });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Review not found' });
  return res.json({ ok: true });
});

export default router;
