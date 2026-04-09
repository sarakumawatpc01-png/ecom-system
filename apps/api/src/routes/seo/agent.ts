import { Router } from 'express';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { getSiteId } from '../../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/opportunities', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const [lowScorePages, productCount, missingSeoProducts] = await Promise.all([
    db.seo_audit_results.count({ where: { site_id: siteId, score: { lt: 70 }, status: 'open' } }),
    db.products.count({ where: { site_id: siteId, is_deleted: false } }),
    db.products.count({ where: { site_id: siteId, is_deleted: false, OR: [{ seo_title: null }, { seo_description: null }] } })
  ]);
  return res.json({
    ok: true,
    data: [
      { type: 'audit', impact: 'high', message: `${lowScorePages} pages need SEO fixes.` },
      { type: 'catalog', impact: 'medium', message: `${missingSeoProducts}/${productCount} products missing complete SEO metadata.` },
      { type: 'content', impact: 'medium', message: 'Generate weekly blog posts for long-tail search terms.' }
    ]
  });
});

export default router;
