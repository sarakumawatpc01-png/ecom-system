import { db } from '../lib/db';
import { runSeoAudit } from './seoAudit';
import { emailQueue } from '../queues/emailQueue';

const nowIso = () => new Date().toISOString();

const createSeoMetaJob = async (siteId: string, entityId: string, prompt: string, before: Record<string, unknown>) =>
  db.ai_jobs.create({
    data: {
      site_id: siteId,
      job_type: 'seo_nightly_meta_refresh',
      entity_type: 'product',
      entity_id: entityId,
      task_type: 'seo_meta',
      status: 'needs_approval',
      input_payload: ({ prompt, before } as any),
      output_payload: ({ queued_at: nowIso() } as any)
    }
  });

export const runSeoNightlyMetaRefresh = async (siteId: string) => {
  const products = await db.products.findMany({
    where: { site_id: siteId, is_deleted: false },
    select: { id: true, name: true, slug: true, seo_title: true, seo_description: true, description: true },
    take: 200
  });

  const targets = products.filter((product) => {
    const missingMeta = !product.seo_title || !product.seo_description;
    const weakDesc = (product.description || '').trim().length < 120;
    return missingMeta || weakDesc;
  });

  for (const product of targets) {
    const prompt =
      `Generate improved SEO title and meta description for product ${product.name}.\n` +
      `URL: /products/${product.slug}\n` +
      `Current title: ${product.seo_title || ''}\n` +
      `Current description: ${product.seo_description || ''}\n` +
      `Product description: ${(product.description || '').slice(0, 400)}`;
    await createSeoMetaJob(siteId, product.id, prompt, {
      title: product.seo_title,
      description: product.seo_description,
      slug: product.slug
    });
  }

  return { type: 'nightly', queued: targets.length, scanned: products.length };
};

export const runSeoWeeklyTechnicalAudit = async (siteId: string) => {
  const audit = await runSeoAudit(siteId);
  const record = await db.seo_audit_results.create({
    data: {
      site_id: siteId,
      page_url: '/',
      page_type: 'site',
      audit_type: 'weekly_technical_crawl',
      score: audit.score,
      issues: (audit.issues as any),
      suggestions: (audit.suggestions as any),
      status: audit.issues.length > 0 ? 'open' : 'fixed',
      auto_fix: audit.issues.length === 0,
      fixed: audit.issues.length === 0,
      fixed_at: audit.issues.length === 0 ? new Date() : null
    }
  });

  return { type: 'weekly', audit_id: record.id, score: audit.score, issues: audit.issues.length };
};

export const runSeoCompetitorGapBriefing = async (siteId: string) => {
  const [products, openAudits] = await Promise.all([
    db.products.findMany({
      where: { site_id: siteId, is_deleted: false },
      select: { id: true, name: true, slug: true, seo_keywords: true },
      take: 30
    }),
    db.seo_audit_results.count({ where: { site_id: siteId, status: 'open' } })
  ]);

  let queued = 0;
  for (const product of products.slice(0, 10)) {
    const keywords = String(product.seo_keywords || product.name)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 5);
    const prompt =
      `Create a content brief to outrank competitors for product ${product.name}.\n` +
      `Landing URL: /products/${product.slug}\n` +
      `Target keywords: ${keywords.join(', ') || product.name}\n` +
      `Known unresolved SEO issues on site: ${openAudits}`;
    await db.ai_jobs.create({
      data: {
        site_id: siteId,
        job_type: 'seo_competitor_gap_analysis',
        entity_type: 'product',
        entity_id: product.id,
        task_type: 'content_brief',
        status: 'needs_approval',
        input_payload: ({ prompt, keywords } as any),
        output_payload: ({ queued_at: nowIso() } as any)
      }
    });
    queued += 1;
  }

  return { type: 'monday', queued };
};

export const runSeoMonthlyReport = async (siteId: string) => {
  const [openIssues, fixedIssues, seoMetaQueued, seoMetaApproved, contentBriefQueued] = await Promise.all([
    db.seo_audit_results.count({ where: { site_id: siteId, status: 'open' } }),
    db.seo_audit_results.count({ where: { site_id: siteId, status: 'fixed' } }),
    db.ai_jobs.count({ where: { site_id: siteId, task_type: 'seo_meta', status: 'needs_approval' } }),
    db.ai_jobs.count({ where: { site_id: siteId, task_type: 'seo_meta', status: 'approved' } }),
    db.ai_jobs.count({ where: { site_id: siteId, task_type: 'content_brief', status: 'needs_approval' } })
  ]);

  const report = {
    generated_at: nowIso(),
    open_issues: openIssues,
    fixed_issues: fixedIssues,
    pending_seo_meta_approvals: seoMetaQueued,
    approved_seo_meta_changes: seoMetaApproved,
    pending_content_briefs: contentBriefQueued
  };

  await db.ai_jobs.create({
    data: {
      site_id: siteId,
      job_type: 'seo_monthly_report',
      entity_type: 'site',
      entity_id: siteId,
      task_type: 'seo_audit',
      status: 'completed',
      input_payload: ({} as any),
      output_payload: (report as any)
    }
  });

  await emailQueue.add('seo-monthly-report', { siteId, report });
  return { type: 'monthly', report };
};

export const runSeoAgentJob = async (
  siteId: string,
  scheduleType: 'nightly' | 'weekly' | 'monday' | 'monthly'
) => {
  if (scheduleType === 'nightly') return runSeoNightlyMetaRefresh(siteId);
  if (scheduleType === 'weekly') return runSeoWeeklyTechnicalAudit(siteId);
  if (scheduleType === 'monday') return runSeoCompetitorGapBriefing(siteId);
  return runSeoMonthlyReport(siteId);
};
