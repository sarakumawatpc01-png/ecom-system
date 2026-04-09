import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { db } from '../../lib/db';
import { cacheGet, cacheSet } from '../../lib/cacheStore';
import { injectSiteScope } from '../../middleware/siteScope';
import { getSiteId } from '../../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const FEED_CACHE_TTL_SECONDS = 60 * 60;
const xmlEscape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const asMoney = (value: Prisma.Decimal | null | undefined) => (value ? Number(value).toFixed(2) : '0.00');

router.get('/google-merchant', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const cacheKey = `feed:gmc:${siteId}`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.send(cached);
  }

  const site = await db.sites.findUnique({ where: { id: siteId }, select: { domain: true, config: true } });
  if (!site) return res.status(404).json({ ok: false, message: 'Site not found' });
  const domain = site.domain.startsWith('http') ? site.domain : `https://${site.domain}`;
  const shipping = ((site.config as Record<string, unknown>)?.shipping || {}) as Record<string, unknown>;
  const shippingCountry = String(shipping.country || 'IN');
  const shippingService = String(shipping.service || 'Standard');
  const shippingPrice = Number(shipping.price || 0).toFixed(2);

  const products = await db.products.findMany({
    where: { site_id: siteId, is_deleted: false, status: 'active' },
    include: {
      category: { select: { name: true } },
      images: { orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }], select: { url: true, is_primary: true } }
    },
    take: 500
  });

  const itemsXml = products
    .map((product: (typeof products)[number]) => {
      const primaryImage = product.images.find((image: { is_primary: boolean }) => image.is_primary)?.url || product.images[0]?.url || '';
      const additionalImages = product.images.slice(primaryImage ? 1 : 0).map((image: { url: string }) => image.url);
      const availability = product.stock_qty > 0 ? 'in stock' : product.status === 'inactive' ? 'preorder' : 'out of stock';
      const salePrice = product.compare_price && Number(product.compare_price) > Number(product.price) ? asMoney(product.price) : null;
      const basePrice = product.compare_price && Number(product.compare_price) > Number(product.price) ? asMoney(product.compare_price) : asMoney(product.price);
      const desc = (product.description || '').slice(0, 5000);
      return [
        '<item>',
        `<g:id>${xmlEscape(product.id)}</g:id>`,
        `<g:title>${xmlEscape(product.name)}</g:title>`,
        `<g:description>${xmlEscape(desc)}</g:description>`,
        `<g:link>${xmlEscape(`${domain}/products/${product.slug}`)}</g:link>`,
        `<g:image_link>${xmlEscape(primaryImage)}</g:image_link>`,
        ...additionalImages.map((url: string) => `<g:additional_image_link>${xmlEscape(url)}</g:additional_image_link>`),
        `<g:availability>${xmlEscape(availability)}</g:availability>`,
        `<g:price>${xmlEscape(`${basePrice} INR`)}</g:price>`,
        salePrice ? `<g:sale_price>${xmlEscape(`${salePrice} INR`)}</g:sale_price>` : '',
        `<g:brand>${xmlEscape(product.brand || 'Generic')}</g:brand>`,
        `<g:mpn>${xmlEscape(product.mpn || product.sku || product.id)}</g:mpn>`,
        `<g:condition>${xmlEscape(product.condition || 'new')}</g:condition>`,
        `<g:google_product_category>${xmlEscape(product.gmc_category || '')}</g:google_product_category>`,
        `<g:product_type>${xmlEscape(product.category?.name || 'General')}</g:product_type>`,
        '<g:shipping>',
        `<g:country>${xmlEscape(shippingCountry)}</g:country>`,
        `<g:service>${xmlEscape(shippingService)}</g:service>`,
        `<g:price>${xmlEscape(`${shippingPrice} INR`)}</g:price>`,
        '</g:shipping>',
        '</item>'
      ].join('');
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${xmlEscape(site.domain)}</title>
<link>${xmlEscape(domain)}</link>
<description>${xmlEscape(`Google Merchant feed for ${site.domain}`)}</description>
${itemsXml}
</channel>
</rss>`;

  await cacheSet(cacheKey, xml, FEED_CACHE_TTL_SECONDS);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  return res.send(xml);
});

export default router;
