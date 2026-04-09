import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId, toPagination } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const customerSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional()
});

router.get('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.customers.findMany({ where: { site_id: siteId }, skip, take: limit, orderBy: { created_at: 'desc' } }),
    db.customers.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.post('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const customer = await db.customers.create({
    data: {
      site_id: siteId,
      ...parsed.data,
      tags: parsed.data.tags || [],
      metadata: parsed.data.metadata || {}
    }
  } as any);
  return res.status(201).json({ ok: true, data: customer });
});

router.get('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const customer = await db.customers.findFirst({ where: { site_id: siteId, id: req.params.id } });
  if (!customer) return res.status(404).json({ ok: false, message: 'Customer not found' });
  return res.json({ ok: true, data: customer });
});

router.put('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = customerSchema.partial().safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const result = await db.customers.updateMany({ where: { site_id: siteId, id: req.params.id }, data: parsed.data as any });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Customer not found' });
  const customer = await db.customers.findFirst({ where: { site_id: siteId, id: req.params.id } });
  return res.json({ ok: true, data: customer });
});

router.delete('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.customers.deleteMany({ where: { site_id: siteId, id: req.params.id } });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Customer not found' });
  return res.json({ ok: true });
});

export default router;
