import { Router } from 'express';
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { db } from '../lib/db';
import { requireRole } from '../middleware/auth';

const router = Router();
router.use(requireRole('super_admin'));

const backupDir = process.env.BACKUP_DIR || '/tmp/ecom-backups';
const logsDir = process.env.APP_LOG_DIR || '/tmp/ecom-logs';
const logsDirResolved = path.resolve(logsDir);
const routeSurface = [
  { group: 'auth', path: '/auth/*', critical: true },
  { group: 'sites', path: '/api/sites/*', critical: true },
  { group: 'catalog', path: '/api/:siteId/products|categories', critical: true },
  { group: 'orders', path: '/api/:siteId/orders', critical: true },
  { group: 'customers', path: '/api/:siteId/customers', critical: false },
  { group: 'reviews', path: '/api/:siteId/reviews', critical: false },
  { group: 'blog', path: '/api/:siteId/blog', critical: false },
  { group: 'media', path: '/api/:siteId/media', critical: false },
  { group: 'import', path: '/api/:siteId/import/meesho', critical: false },
  { group: 'ai', path: '/api/:siteId/ai/*', critical: false },
  { group: 'seo', path: '/api/:siteId/seo/*', critical: true },
  { group: 'analytics', path: '/api/:siteId/analytics', critical: false },
  { group: 'ads', path: '/api/:siteId/ads', critical: false },
  { group: 'landing_ab', path: '/api/:siteId/landing-pages|ab-tests', critical: false },
  { group: 'redirects', path: '/api/:siteId/redirects', critical: false },
  { group: 'heatmaps', path: '/api/:siteId/heatmaps', critical: false },
  { group: 'feed', path: '/api/:siteId/feed/google-merchant', critical: true },
  { group: 'prelaunch', path: '/api/:siteId/prelaunch/checklist', critical: true },
  { group: 'infra', path: '/api/infra/*', critical: true },
  { group: 'notifications', path: '/api/notifications/*', critical: false }
];

router.get('/sites/status', async (_req, res) => {
  const sites = await db.sites.findMany({
    where: { is_deleted: false },
    select: { id: true, name: true, slug: true, status: true, nginx_port: true, pm2_process_name: true }
  });
  return res.json({ ok: true, data: sites });
});

router.post('/sites/:id/restart', async (req, res) => {
  const site = await db.sites.findUnique({ where: { id: req.params.id } });
  if (!site) return res.status(404).json({ ok: false, message: 'Site not found' });
  return res.json({ ok: true, data: { site_id: site.id, action: 'restart', triggered_at: new Date().toISOString() } });
});

router.post('/sites/:id/rebuild', async (req, res) => {
  const site = await db.sites.findUnique({ where: { id: req.params.id } });
  if (!site) return res.status(404).json({ ok: false, message: 'Site not found' });
  return res.json({ ok: true, data: { site_id: site.id, action: 'rebuild', triggered_at: new Date().toISOString() } });
});

router.get('/server/metrics', async (_req, res) => {
  const [sites, orders, products] = await Promise.all([db.sites.count(), db.orders.count(), db.products.count()]);
  return res.json({
    ok: true,
    data: {
      uptime_seconds: Math.floor(process.uptime()),
      loadavg: os.loadavg(),
      memory: process.memoryUsage(),
      host: os.hostname(),
      records: { sites, orders, products }
    }
  });
});

router.get('/audit/deep', async (_req, res) => {
  const now = Date.now();
  const last24h = new Date(now - 24 * 60 * 60 * 1000);
  const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const corsStrict = corsOrigins.length > 0 && !corsOrigins.includes('*');
  const activeCategoryFilter = { is_active: true } as const;
  const publishedLandingPageFilter = { status: 'active' as const };

  const [
    siteCount,
    activeSiteCount,
    userCount,
    productCount,
    activeProductCount,
    categoryCount,
    orderCount,
    paidOrderCount,
    customerCount,
    approvedReviewCount,
    aiPendingApprovals,
    seoOpenIssues,
    landingPublishedCount,
    abActiveCount,
    heatmap24hCount,
    emailFailure7dCount,
    adminActivity24hCount,
    superAdminNo2faCount
  ] = await Promise.all([
    db.sites.count({ where: { is_deleted: false } }),
    db.sites.count({ where: { is_deleted: false, status: 'active' } }),
    db.users.count({ where: { is_active: true } }),
    db.products.count({ where: { is_deleted: false } }),
    db.products.count({ where: { is_deleted: false, status: 'active' } }),
    db.categories.count({ where: activeCategoryFilter }),
    db.orders.count(),
    db.orders.count({ where: { payment_status: 'paid' } }),
    db.customers.count(),
    db.reviews.count({ where: { is_approved: true } }),
    db.ai_jobs.count({ where: { status: 'needs_approval' } }),
    db.seo_audit_results.count({ where: { status: 'open' } }),
    db.landing_pages.count({ where: publishedLandingPageFilter }),
    db.ab_tests.count({ where: { status: 'running' } }),
    db.heatmap_events.count({ where: { created_at: { gte: last24h } } }),
    db.email_logs.count({ where: { status: 'failed', created_at: { gte: last7d } } }),
    db.admin_activity_logs.count({ where: { created_at: { gte: last24h } } }),
    db.users.count({ where: { role: 'super_admin', is_active: true, totp_enabled: false } })
  ]);

  await mkdir(backupDir, { recursive: true });
  const backupFiles = await readdir(backupDir);
  let latestBackupIso: string | null = null;
  for (const file of backupFiles) {
    const fullPath = path.join(backupDir, file);
    const fileStat = await stat(fullPath).catch(() => null);
    if (!fileStat || !fileStat.isFile()) continue;
    const iso = fileStat.mtime.toISOString();
    if (!latestBackupIso || iso > latestBackupIso) latestBackupIso = iso;
  }

  const checks = [
    { area: 'security', item: 'CORS allowlist configured (no wildcard)', ok: corsStrict, critical: true },
    { area: 'security', item: 'All active super admins have 2FA enabled', ok: superAdminNo2faCount === 0, critical: true },
    { area: 'operations', item: 'At least one backup artifact exists', ok: backupFiles.length > 0, critical: true },
    { area: 'observability', item: 'Admin activity logs present in last 24h', ok: adminActivity24hCount > 0, critical: false },
    { area: 'commerce', item: 'Paid orders exist', ok: paidOrderCount > 0, critical: false },
    { area: 'content', item: 'At least one active product exists', ok: activeProductCount > 0, critical: false }
  ];

  const criticalFailures = checks.filter((check) => check.critical && !check.ok).length;

  return res.json({
    ok: criticalFailures === 0,
    data: {
      generated_at: new Date().toISOString(),
      feature_surface: {
        total_groups: routeSurface.length,
        critical_groups: routeSurface.filter((route) => route.critical).length,
        routes: routeSurface
      },
      inventory: {
        sites: { total: siteCount, active: activeSiteCount },
        users: { active: userCount, super_admin_without_2fa: superAdminNo2faCount },
        catalog: { products: productCount, active_products: activeProductCount, categories: categoryCount },
        commerce: { orders: orderCount, paid_orders: paidOrderCount, customers: customerCount },
        content: { approved_reviews: approvedReviewCount, published_landing_pages: landingPublishedCount, active_ab_tests: abActiveCount },
        ai_seo: { pending_ai_approvals: aiPendingApprovals, open_seo_issues: seoOpenIssues },
        telemetry: { heatmap_events_last_24h: heatmap24hCount, admin_activity_last_24h: adminActivity24hCount, email_failures_last_7d: emailFailure7dCount }
      },
      runtime: {
        backups: { directory: backupDir, files: backupFiles.length, latest_backup_at: latestBackupIso },
        cors: { strict_allowlist: corsStrict, origins: corsOrigins }
      },
      checks,
      summary: {
        checks_total: checks.length,
        checks_passed: checks.filter((check) => check.ok).length,
        critical_failures: criticalFailures
      }
    }
  });
});

router.get('/backups', async (_req, res) => {
  await mkdir(backupDir, { recursive: true });
  const files = await readdir(backupDir);
  const backups: Array<{ file: string; size: number; modified: string }> = [];
  for (const file of files) {
    const fullPath = path.join(backupDir, file);
    const fileStat = await stat(fullPath).catch(() => null);
    if (!fileStat || !fileStat.isFile()) continue;
    backups.push({ file, size: fileStat.size, modified: fileStat.mtime.toISOString() });
  }
  backups.sort((a, b) => (a.modified < b.modified ? 1 : -1));
  return res.json({ ok: true, data: backups });
});

router.post('/backups/trigger', async (_req, res) => {
  await mkdir(backupDir, { recursive: true });
  const [sites, products, orders, customers] = await Promise.all([
    db.sites.count(),
    db.products.count(),
    db.orders.count(),
    db.customers.count()
  ]);
  const backupName = `backup-${Date.now()}.json`;
  const payload = {
    created_at: new Date().toISOString(),
    counts: { sites, products, orders, customers }
  };
  await writeFile(path.join(backupDir, backupName), JSON.stringify(payload, null, 2), 'utf8');
  return res.status(201).json({ ok: true, data: { backup_file: backupName } });
});

router.get('/logs/:appName', async (req, res) => {
  await mkdir(logsDir, { recursive: true });
  const appNameRaw = String(req.params.appName || '');
  const appName = appNameRaw.replace(/[^a-zA-Z0-9-_]/g, '');
  if (appName !== appNameRaw) {
    return res.status(400).json({ ok: false, message: 'Invalid appName' });
  }
  if (!appName) return res.status(400).json({ ok: false, message: 'Invalid appName' });
  const logPath = path.resolve(path.join(logsDirResolved, `${appName}.log`));
  if (!logPath.startsWith(`${logsDirResolved}${path.sep}`)) {
    return res.status(400).json({ ok: false, message: 'Invalid appName path' });
  }
  const content = await readFile(logPath, 'utf8').catch(() => '');
  const lines = content.split('\n').filter(Boolean);
  return res.json({ ok: true, data: { app: appName, lines: lines.slice(-500) } });
});

export default router;
