import { Router } from 'express';
import { z } from 'zod';
import { db } from '@ecom/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId, toPagination } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const categorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  image_url: z.string().url().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional()
});

router.get('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.categories.findMany({ where: { site_id: siteId }, skip, take: limit, orderBy: { sort_order: 'asc' } }),
    db.categories.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.post('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const category = await db.categories.create({ data: { site_id: siteId, ...parsed.data } });
  return res.status(201).json({ ok: true, data: category });
});

router.get('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const category = await db.categories.findFirst({ where: { site_id: siteId, id: req.params.id } });
  if (!category) return res.status(404).json({ ok: false, message: 'Category not found' });
  return res.json({ ok: true, data: category });
});

router.put('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = categorySchema.partial().safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const category = await db.categories.updateMany({
    where: { site_id: siteId, id: req.params.id },
    data: parsed.data
  });
  if (category.count === 0) return res.status(404).json({ ok: false, message: 'Category not found' });
  const current = await db.categories.findFirst({ where: { site_id: siteId, id: req.params.id } });
  return res.json({ ok: true, data: current });
});

router.delete('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.categories.deleteMany({ where: { site_id: siteId, id: req.params.id } });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Category not found' });
  return res.json({ ok: true });
});

export default router;
