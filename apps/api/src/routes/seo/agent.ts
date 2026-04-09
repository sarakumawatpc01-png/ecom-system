import { Router } from 'express';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { getSiteId } from '../../utils/request';
import { runSeoAgentJob } from '../../services/seoAgent';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const scheduleTypes = ['nightly', 'weekly', 'monday', 'monthly'] as const;

router.get('/agent/scheduled-jobs', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const [nightly, weekly, monday, monthly] = await Promise.all([
    db.ai_jobs.findFirst({ where: { site_id: siteId, job_type: 'seo_nightly_meta_refresh' }, orderBy: { created_at: 'desc' } }),
    db.seo_audit_results.findFirst({ where: { site_id: siteId, audit_type: 'weekly_technical_crawl' }, orderBy: { created_at: 'desc' } }),
    db.ai_jobs.findFirst({ where: { site_id: siteId, job_type: 'seo_competitor_gap_analysis' }, orderBy: { created_at: 'desc' } }),
    db.ai_jobs.findFirst({ where: { site_id: siteId, job_type: 'seo_monthly_report' }, orderBy: { created_at: 'desc' } })
  ]);

  return res.json({
    ok: true,
    data: {
      nightly: { last_run_at: nightly?.created_at || null, status: nightly?.status || null },
      weekly: { last_run_at: weekly?.created_at || null, status: weekly?.status || null, score: weekly?.score ?? null },
      monday: { last_run_at: monday?.created_at || null, status: monday?.status || null },
      monthly: { last_run_at: monthly?.created_at || null, status: monthly?.status || null }
    }
  });
});

router.post('/agent/run-now', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const scheduleType = String(req.body?.type || 'nightly') as (typeof scheduleTypes)[number];
  if (!scheduleTypes.includes(scheduleType)) {
    return res.status(400).json({ ok: false, message: `Invalid type. Expected one of: ${scheduleTypes.join(', ')}` });
  }
  const result = await runSeoAgentJob(siteId, scheduleType);
  return res.status(201).json({ ok: true, data: result });
});

router.get('/opportunities', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const [lowScorePages, productCount, missingSeoProducts, pendingMetaApprovals, pendingContentBriefs] = await Promise.all([
    db.seo_audit_results.count({ where: { site_id: siteId, score: { lt: 70 }, status: 'open' } }),
    db.products.count({ where: { site_id: siteId, is_deleted: false } }),
    db.products.count({ where: { site_id: siteId, is_deleted: false, OR: [{ seo_title: null }, { seo_description: null }] } }),
    db.ai_jobs.count({ where: { site_id: siteId, task_type: 'seo_meta', status: 'needs_approval' } }),
    db.ai_jobs.count({ where: { site_id: siteId, task_type: 'content_brief', status: 'needs_approval' } })
  ]);
  return res.json({
    ok: true,
    data: [
      { type: 'audit', impact: 'high', message: `${lowScorePages} pages need SEO fixes.` },
      { type: 'catalog', impact: 'medium', message: `${missingSeoProducts}/${productCount} products missing complete SEO metadata.` },
      { type: 'workflow', impact: 'medium', message: `${pendingMetaApprovals} SEO meta jobs and ${pendingContentBriefs} content briefs pending approval.` },
      { type: 'content', impact: 'medium', message: 'Generate weekly blog posts for long-tail search terms.' }
    ]
  });
});

export default router;
