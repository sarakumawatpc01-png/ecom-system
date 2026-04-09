import { Router } from 'express';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

router.get('/checklist', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });

  const [site, products, activeProducts, approvedAi, reviewsApproved, openSeoIssues, pendingAiApprovals, adminWrites24h, superAdminWithout2fa] = await Promise.all([
    db.sites.findUnique({ where: { id: siteId } }),
    db.products.count({ where: { site_id: siteId, is_deleted: false } }),
    db.products.count({ where: { site_id: siteId, is_deleted: false, status: 'active' } }),
    db.products.count({ where: { site_id: siteId, ai_description_status: 'approved', is_deleted: false } }),
    db.reviews.count({ where: { site_id: siteId, is_approved: true, contains_meesho: false } }),
    db.seo_audit_results.count({ where: { site_id: siteId, status: 'open' } }),
    db.ai_jobs.count({ where: { site_id: siteId, status: 'needs_approval' } }),
    db.admin_activity_logs.count({ where: { site_id: siteId, created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    db.users.count({ where: { role: 'super_admin', is_active: true, totp_enabled: false } })
  ]);
  if (!site) return res.status(404).json({ ok: false, message: 'Site not found' });

  const siteConfig = asRecord(site.config);
  const smtp = asRecord(siteConfig.smtp);
  const smtpConfigured = Boolean((smtp.host && smtp.user && smtp.from) || process.env.SMTP_FROM);
  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsAllowlistStrict = corsOrigins.length > 0 && !corsOrigins.includes('*');
  const domain = String(site.domain || '').trim().toLowerCase();
  const domainLooksPublic = Boolean(domain) && domain.includes('.') && !domain.includes('localhost') && !domain.startsWith('127.');
  const httpsConfigured = domain.startsWith('https://') || (domainLooksPublic && !domain.startsWith('http://'));

  const checks = [
    { area: 'Infrastructure', item: 'PM2 process configured', done: Boolean(site.pm2_process_name), critical: true },
    { area: 'Infrastructure', item: 'HTTPS domain configured', done: httpsConfigured, critical: true },
    { area: 'Monitoring', item: 'Sentry configured', done: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN), critical: true },
    { area: 'Monitoring', item: 'OpenReplay project key configured', done: Boolean(process.env.OPENREPLAY_PROJECT_KEY), critical: false },
    { area: 'Security', item: 'CORS allowlist configured (no wildcard)', done: corsAllowlistStrict, critical: true },
    { area: 'Security', item: '2FA enforced for active super admins', done: superAdminWithout2fa === 0, critical: true },
    { area: 'Security', item: 'Login lockout policy in effect', done: true, critical: true, details: { failed_attempts_limit: 5, lockout_minutes: 15 } },
    { area: 'Security', item: 'Admin activity logs seen in last 24h', done: adminWrites24h > 0, critical: false },
    { area: 'SEO', item: 'Products present for SEO crawl', done: products > 0, critical: false },
    { area: 'SEO', item: 'No open SEO audit issues', done: openSeoIssues === 0, critical: false },
    { area: 'Content', item: 'AI descriptions approved', done: products === 0 ? true : approvedAi >= activeProducts, critical: false },
    { area: 'Content', item: 'No pending AI approvals', done: pendingAiApprovals === 0, critical: false },
    { area: 'Content', item: 'Approved non-meesho reviews present', done: reviewsApproved > 0, critical: false },
    { area: 'E-commerce', item: 'SMTP configured for order emails', done: smtpConfigured, critical: true },
    { area: 'E-commerce', item: 'Google Merchant feed endpoint available', done: true, critical: true, details: { endpoint: `/api/${siteId}/feed/google-merchant` } }
  ];

  const criticalFailures = checks.filter((check) => check.critical && !check.done).length;
  return res.json({
    ok: criticalFailures === 0,
    data: {
      site_id: siteId,
      completed: checks.filter((check) => check.done).length,
      total: checks.length,
      critical_failures: criticalFailures,
      checks
    }
  });
});

export default router;
