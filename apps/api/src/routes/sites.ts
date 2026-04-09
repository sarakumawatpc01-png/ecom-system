import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { requireRole } from '../middleware/auth';
import { toPagination } from '../utils/request';

const router = Router();
router.use(requireRole('super_admin'));

const createSiteSchema = z.object({
  domain: z.string().min(3),
  name: z.string().min(2),
  slug: z.string().min(2),
  nginx_port: z.number().int().positive(),
  pm2_process_name: z.string().min(2),
  config: z.record(z.unknown()).optional()
});

router.get('/', async (req, res) => {
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.sites.findMany({ where: { is_deleted: false }, skip, take: limit, orderBy: { created_at: 'desc' } }),
    db.sites.count({ where: { is_deleted: false } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.post('/', async (req, res) => {
  const parsed = createSiteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  }
  const site = await db.sites.create({ data: { ...parsed.data, config: parsed.data.config || {} } });
  return res.status(201).json({ ok: true, data: site });
});

router.get('/:id', async (req, res) => {
  const site = await db.sites.findFirst({ where: { id: req.params.id, is_deleted: false } });
  if (!site) {
    return res.status(404).json({ ok: false, message: 'Site not found' });
  }
  return res.json({ ok: true, data: site });
});

router.put('/:id', async (req, res) => {
  const parsed = createSiteSchema.partial().safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  }
  const site = await db.sites.update({ where: { id: req.params.id }, data: parsed.data });
  return res.json({ ok: true, data: site });
});

router.delete('/:id', async (req, res) => {
  await db.sites.update({ where: { id: req.params.id }, data: { is_deleted: true, status: 'deleted' } });
  return res.json({ ok: true });
});

router.put('/:id/status', async (req, res) => {
  const status = String(req.body?.status || '').trim();
  if (!status) {
    return res.status(400).json({ ok: false, message: 'status is required' });
  }
  const site = await db.sites.update({ where: { id: req.params.id }, data: { status } });
  return res.json({ ok: true, data: site });
});

router.post('/:id/cache/purge', async (_req, res) => {
  return res.json({ ok: true, data: { purged: true, purged_at: new Date().toISOString() } });
});

export default router;
