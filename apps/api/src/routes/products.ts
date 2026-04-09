import { Router } from 'express';
import { z } from 'zod';
import { db } from '@ecom/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId, toPagination } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const productSchema = z.object({
  category_id: z.string().uuid().optional().nullable(),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  short_description: z.string().optional(),
  sku: z.string().optional(),
  price: z.coerce.number().nonnegative(),
  compare_at_price: z.coerce.number().nonnegative().optional().nullable(),
  cost_price: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.string().min(3).max(3).optional(),
  stock_qty: z.number().int().optional(),
  status: z.string().optional(),
  seo_title: z.string().optional(),
  seo_description: z.string().optional(),
  seo_keywords: z.string().optional()
});

router.get('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.products.findMany({
      where: { site_id: siteId, is_deleted: false },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' }
    }),
    db.products.count({ where: { site_id: siteId, is_deleted: false } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.post('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const product = await db.products.create({
    data: {
      site_id: siteId,
      ...parsed.data
    }
  });
  return res.status(201).json({ ok: true, data: product });
});

router.get('/:slug', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const product = await db.products.findFirst({ where: { site_id: siteId, slug: req.params.slug, is_deleted: false } });
  if (!product) return res.status(404).json({ ok: false, message: 'Product not found' });
  return res.json({ ok: true, data: product });
});

router.put('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = productSchema.partial().safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const result = await db.products.updateMany({ where: { site_id: siteId, id: req.params.id }, data: parsed.data });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Product not found' });
  const product = await db.products.findFirst({ where: { site_id: siteId, id: req.params.id } });
  return res.json({ ok: true, data: product });
});

router.delete('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.products.updateMany({
    where: { site_id: siteId, id: req.params.id },
    data: { is_deleted: true, status: 'archived' }
  });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Product not found' });
  return res.json({ ok: true });
});

router.post('/bulk', async (req, res) => {
  const siteId = getSiteId(req);
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  if (items.length === 0) return res.status(400).json({ ok: false, message: 'items array is required' });
  let created = 0;
  for (const item of items) {
    const parsed = productSchema.safeParse(item);
    if (!parsed.success) continue;
    await db.products.create({ data: { site_id: siteId, ...parsed.data } });
    created += 1;
  }
  return res.status(201).json({ ok: true, data: { created, received: items.length } });
});

router.get('/:id/images', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const items = await db.product_images.findMany({
    where: { site_id: siteId, product_id: req.params.id },
    orderBy: { sort_order: 'asc' }
  });
  return res.json({ ok: true, data: items });
});

router.post('/:id/images', async (req, res) => {
  const siteId = getSiteId(req);
  const url = String(req.body?.url || '');
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  if (!url) return res.status(400).json({ ok: false, message: 'url is required' });
  const image = await db.product_images.create({
    data: {
      site_id: siteId,
      product_id: req.params.id,
      url,
      alt_text: req.body?.alt_text ? String(req.body.alt_text) : null
    }
  });
  return res.status(201).json({ ok: true, data: image });
});

router.delete('/:id/images/:imageId', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.product_images.deleteMany({
    where: { site_id: siteId, product_id: req.params.id, id: req.params.imageId }
  });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Image not found' });
  return res.json({ ok: true });
});

router.post('/:id/videos', async (req, res) => {
  const siteId = getSiteId(req);
  const url = String(req.body?.url || '');
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  if (!url) return res.status(400).json({ ok: false, message: 'url is required' });
  const video = await db.product_videos.create({
    data: {
      site_id: siteId,
      product_id: req.params.id,
      url,
      provider: req.body?.provider ? String(req.body.provider) : null
    }
  });
  return res.status(201).json({ ok: true, data: video });
});

router.get('/:id/variants', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const items = await db.product_variants.findMany({ where: { site_id: siteId, product_id: req.params.id } });
  return res.json({ ok: true, data: items });
});

router.post('/:id/variants', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const name = String(req.body?.name || '');
  const price = Number(req.body?.price);
  if (!name || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({ ok: false, message: 'name and valid price are required' });
  }
  const variant = await db.product_variants.create({
    data: {
      site_id: siteId,
      product_id: req.params.id,
      name,
      price,
      sku: req.body?.sku ? String(req.body.sku) : null,
      stock_qty: Number.isFinite(Number(req.body?.stock_qty)) ? Number(req.body.stock_qty) : 0
    }
  });
  return res.status(201).json({ ok: true, data: variant });
});

export default router;
