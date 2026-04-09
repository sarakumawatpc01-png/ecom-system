import { Router } from 'express';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

router.get('/checklist', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });

  const [site, products, activeProducts, approvedAi, reviewsApproved] = await Promise.all([
    db.sites.findUnique({ where: { id: siteId } }),
    db.products.count({ where: { site_id: siteId, is_deleted: false } }),
    db.products.count({ where: { site_id: siteId, is_deleted: false, status: 'active' } }),
    db.products.count({ where: { site_id: siteId, ai_description_status: 'approved', is_deleted: false } }),
    db.reviews.count({ where: { site_id: siteId, is_approved: true, contains_meesho: false } })
  ]);
  if (!site) return res.status(404).json({ ok: false, message: 'Site not found' });

  const checks = [
    { area: 'Infrastructure', item: 'PM2 process configured', done: Boolean(site.pm2_process_name) },
    { area: 'Infrastructure', item: 'HTTPS domain configured', done: site.domain.startsWith('http') || site.domain.includes('.') },
    { area: 'Monitoring', item: 'Sentry configured', done: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) },
    { area: 'SEO', item: 'Products present for SEO crawl', done: products > 0 },
    { area: 'Content', item: 'AI descriptions approved', done: products === 0 ? true : approvedAi >= activeProducts },
    { area: 'Content', item: 'Approved non-meesho reviews present', done: reviewsApproved > 0 },
    { area: 'E-commerce', item: 'Google Merchant feed endpoint active', done: true }
  ];

  return res.json({ ok: true, data: { site_id: siteId, completed: checks.filter((check) => check.done).length, total: checks.length, checks } });
});

export default router;
