import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { requireRole } from '../middleware/auth';
import { getSiteId, toPagination } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const blogSchema = z.object({
  title: z.string().min(2),
  slug: z.string().min(2),
  content: z.string().min(1),
  excerpt: z.string().optional(),
  featured_image: z.string().url().optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  published_at: z.string().datetime().optional()
});

router.get('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.blog_posts.findMany({ where: { site_id: siteId }, orderBy: { created_at: 'desc' }, skip, take: limit }),
    db.blog_posts.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.post('/', requireRole('super_admin', 'site_admin', 'editor'), async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = blogSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const item = await db.blog_posts.create({
    data: {
      site_id: siteId,
      ...parsed.data,
      published_at: parsed.data.published_at ? new Date(parsed.data.published_at) : null
    }
  });
  return res.status(201).json({ ok: true, data: item });
});

router.get('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const item = await db.blog_posts.findFirst({ where: { site_id: siteId, id: req.params.id } });
  if (!item) return res.status(404).json({ ok: false, message: 'Post not found' });
  return res.json({ ok: true, data: item });
});

router.put('/:id', requireRole('super_admin', 'site_admin', 'editor'), async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = blogSchema.partial().safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const updateData = {
    ...parsed.data,
    ...(parsed.data.published_at ? { published_at: new Date(parsed.data.published_at) } : {})
  };
  const result = await db.blog_posts.updateMany({ where: { site_id: siteId, id: req.params.id }, data: updateData });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Post not found' });
  const item = await db.blog_posts.findFirst({ where: { site_id: siteId, id: req.params.id } });
  return res.json({ ok: true, data: item });
});

router.delete('/:id', requireRole('super_admin', 'site_admin', 'editor'), async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.blog_posts.deleteMany({ where: { site_id: siteId, id: req.params.id } });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Post not found' });
  return res.json({ ok: true });
});

export default router;
