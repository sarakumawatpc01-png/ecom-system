import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { buildSchema } from '../../services/schemaBuilder';
import { regenerateSitemap } from '../../services/sitemapBuilder';
import { getSiteId } from '../../utils/request';
import { AppRequest } from '../../types';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const metaSchema = z.object({
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  seo_keywords: z.string().optional()
});

const getEntity = async (siteId: string, pageType: string, id: string) => {
  if (pageType === 'product') return db.products.findFirst({ where: { site_id: siteId, id, is_deleted: false } });
  if (pageType === 'blog') return db.blog_posts.findFirst({ where: { site_id: siteId, id } });
  if (pageType === 'category') return db.categories.findFirst({ where: { site_id: siteId, id } });
  if (pageType === 'landing-page') return db.landing_pages.findFirst({ where: { site_id: siteId, id } });
  return null;
};

router.get('/schema/:pageType/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const entity = await getEntity(siteId, req.params.pageType, req.params.id);
  if (!entity) return res.status(404).json({ ok: false, message: 'Entity not found' });
  const schema = buildSchema(req.params.pageType, entity as Record<string, unknown>);
  return res.json({ ok: true, data: schema });
});

router.put('/schema/:pageType/:id', async (req, res) => {
  const schema = buildSchema(req.params.pageType, (req.body || {}) as Record<string, unknown>);
  return res.json({ ok: true, data: schema });
});

router.post('/sitemap/regenerate', async (req: AppRequest, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const generated = await regenerateSitemap(siteId);
  return res.json({ ok: true, data: { generated, triggered_by: req.ctx?.user?.sub || 'system' } });
});

router.get('/meta/:pageType/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const entity = await getEntity(siteId, req.params.pageType, req.params.id);
  if (!entity) return res.status(404).json({ ok: false, message: 'Entity not found' });
  const source = entity as Record<string, unknown>;
  return res.json({
    ok: true,
    data: {
      seo_title: source.seo_title || source.title || source.name || null,
      seo_description: source.seo_description || source.description || null,
      seo_keywords: source.seo_keywords || null
    }
  });
});

router.put('/meta/:pageType/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = metaSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  if (req.params.pageType === 'product') {
    const result = await db.products.updateMany({ where: { site_id: siteId, id: req.params.id }, data: parsed.data });
    if (result.count === 0) return res.status(404).json({ ok: false, message: 'Entity not found' });
  } else if (req.params.pageType === 'blog') {
    const result = await db.blog_posts.updateMany({ where: { site_id: siteId, id: req.params.id }, data: parsed.data });
    if (result.count === 0) return res.status(404).json({ ok: false, message: 'Entity not found' });
  } else {
    return res.status(400).json({ ok: false, message: 'Meta update supported for product/blog only' });
  }
  return res.json({ ok: true });
});

export default router;
