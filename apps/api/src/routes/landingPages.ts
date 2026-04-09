import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { requireRole } from '../middleware/auth';
import { getSiteId, toPagination } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const landingSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  blocks: z.array(z.record(z.unknown())).or(z.record(z.unknown())),
  is_published: z.boolean().optional()
});

router.get('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.landing_pages.findMany({ where: { site_id: siteId }, orderBy: { created_at: 'desc' }, skip, take: limit }),
    db.landing_pages.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.post('/', requireRole('super_admin', 'site_admin', 'editor'), async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = landingSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const item = await db.landing_pages.create({ data: { site_id: siteId, ...parsed.data } as any });
  return res.status(201).json({ ok: true, data: item });
});

router.get('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const item = await db.landing_pages.findFirst({ where: { site_id: siteId, id: req.params.id } });
  if (!item) return res.status(404).json({ ok: false, message: 'Landing page not found' });
  return res.json({ ok: true, data: item });
});

router.put('/:id', requireRole('super_admin', 'site_admin', 'editor'), async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = landingSchema.partial().safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const result = await db.landing_pages.updateMany({ where: { site_id: siteId, id: req.params.id }, data: parsed.data as any });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Landing page not found' });
  const item = await db.landing_pages.findFirst({ where: { site_id: siteId, id: req.params.id } });
  return res.json({ ok: true, data: item });
});

router.delete('/:id', requireRole('super_admin', 'site_admin', 'editor'), async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.landing_pages.deleteMany({ where: { site_id: siteId, id: req.params.id } });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Landing page not found' });
  return res.json({ ok: true });
});

router.post('/:id/duplicate', requireRole('super_admin', 'site_admin', 'editor'), async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const original = await db.landing_pages.findFirst({ where: { site_id: siteId, id: req.params.id } });
  if (!original) return res.status(404).json({ ok: false, message: 'Landing page not found' });
  const duplicate = await db.landing_pages.create({
    data: {
      site_id: siteId,
      name: `${original.name} (Copy)`,
      slug: `${original.slug}-copy-${Date.now()}`,
      blocks: original.blocks as any,
      is_published: false
    }
  });
  return res.status(201).json({ ok: true, data: duplicate });
});

export default router;
