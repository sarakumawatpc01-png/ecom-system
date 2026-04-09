import { Router } from 'express';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { runSeoAudit } from '../../services/seoAudit';
import { getSiteId, toPagination } from '../../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

router.get('/audit', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const audit = await runSeoAudit(siteId);
  const record = await db.seo_audit_results.create({
    data: {
      site_id: siteId,
      page_url: String(req.query.page_url || '/'),
      page_type: String(req.query.page_type || 'site'),
      score: Number(audit.score || 0),
      issues: (audit.issues as unknown[]) || [],
      suggestions: ['Improve title uniqueness', 'Optimize meta descriptions'],
      status: 'open'
    }
  });
  return res.json({ ok: true, data: record });
});

router.get('/audit/results', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.seo_audit_results.findMany({ where: { site_id: siteId }, orderBy: { created_at: 'desc' }, skip, take: limit }),
    db.seo_audit_results.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.put('/audit/:id/fix', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.seo_audit_results.updateMany({
    where: { site_id: siteId, id: req.params.id },
    data: { status: String(req.body?.status || 'fixed') }
  });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Audit record not found' });
  const updated = await db.seo_audit_results.findFirst({ where: { site_id: siteId, id: req.params.id } });
  return res.json({ ok: true, data: updated });
});

export default router;
