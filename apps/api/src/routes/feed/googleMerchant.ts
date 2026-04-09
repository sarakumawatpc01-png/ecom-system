import { Router } from 'express';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { getSiteId } from '../../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/google-merchant', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const products = await db.products.findMany({
    where: { site_id: siteId, is_deleted: false, status: 'active' },
    select: { id: true, name: true, slug: true, price: true, stock_qty: true, description: true },
    take: 500
  });
  const feed = products.map((product: (typeof products)[number]) => ({
    id: product.id,
    title: product.name,
    description: product.description || '',
    link: `/products/${product.slug}`,
    availability: product.stock_qty > 0 ? 'in_stock' : 'out_of_stock',
    price: `${product.price} INR`
  }));
  return res.json({ ok: true, data: feed });
});

export default router;
