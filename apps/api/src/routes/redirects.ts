import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId, toPagination } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const redirectSchema = z.object({
  from_path: z.string().min(1),
  to_path: z.string().min(1),
  status_code: z.number().int().refine((v) => v === 301 || v === 302).optional(),
  is_active: z.boolean().optional()
});

router.get('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.redirects.findMany({ where: { site_id: siteId }, orderBy: { created_at: 'desc' }, skip, take: limit }),
    db.redirects.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.post('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = redirectSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const item = await db.redirects.create({ data: { site_id: siteId, ...parsed.data } });
  return res.status(201).json({ ok: true, data: item });
});

router.put('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = redirectSchema.partial().safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const result = await db.redirects.updateMany({ where: { site_id: siteId, id: req.params.id }, data: parsed.data });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Redirect not found' });
  const item = await db.redirects.findFirst({ where: { site_id: siteId, id: req.params.id } });
  return res.json({ ok: true, data: item });
});

router.delete('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.redirects.deleteMany({ where: { site_id: siteId, id: req.params.id } });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Redirect not found' });
  return res.json({ ok: true });
});

export default router;
