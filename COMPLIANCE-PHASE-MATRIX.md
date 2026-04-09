# Compliance Phase Matrix (MASTER-SYSTEM-PROMPT.md)

Status legend: **Done** = implemented in codebase, **Partial** = scaffolded/incomplete, **Missing** = not yet implemented.

| Phase | Prompt Parts | Status | Evidence |
|---|---|---|---|
| 0 | 1–20 | Done | `/home/runner/work/ecom-system/ecom-system/COMPLIANCE-PHASE-MATRIX.md` |
| 1 | 2, 14, 19 (infra/runtime) | Partial | `/home/runner/work/ecom-system/ecom-system/ecosystem.config.js`, `/home/runner/work/ecom-system/ecom-system/scripts/backup.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/restore-backup.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/ssl-renew.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/install-cron.sh` |
| 2 | 3 (database schema) | Partial | `/home/runner/work/ecom-system/ecom-system/packages/db/prisma/schema.prisma` |
| 3 | 4 (shared API) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/index.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/**/*` |
| 4 | 5 (Meesho import) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/import/meesho.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/meeshoScraper.ts` |
| 5 | 6 (AI model management + generation) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/ai/**/*`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/ai/**/*` |
| 6 | 7 (AI SEO agent) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/seo/agent.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/workers/seoWorker.ts` |
| 7 | 8 (Heatmaps/session intelligence) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/heatmaps.ts`, `/home/runner/work/ecom-system/ecom-system/packages/db/prisma/schema.prisma` (`heatmap_events`) |
| 8 | 9 (Ads command centre) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/ads.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/index.ts` (`/api/ads/overview`) |
| 9 | 10 (Landing pages + A/B tests) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/landingPages.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/abTests.ts` |
| 10 | 11 (Super admin panel) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/super-admin` |
| 11 | 12 (Per-site admin panels) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/per-site-admin` |
| 12 | 13 (Public Next.js sites) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/site-demo` |
| 13 | 15 (Deployment workflow) | Partial | `/home/runner/work/ecom-system/ecom-system/scripts/new-site.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/deploy-site.sh` |
| 14 | 16 (Monitoring + CI/CD) | Missing | No committed Uptime Kuma/Lighthouse CI/Sentry/Search Console integration artifacts yet |
| 15 | 17–18 (Merchant feed + email) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/feed/googleMerchant.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/emailService.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/queues/emailQueue.ts` |
| 16 | 19 (security finalization) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/middleware/auth.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/middleware/rateLimit.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/startupAudit.ts` |
| 17 | 20 (pre-launch checklist) | Missing | No full pre-launch evidence checklist artifact yet |
| 18 | Cross-cutting regression/sign-off | Partial | Root validation commands available via `/home/runner/work/ecom-system/ecom-system/package.json` scripts |

## Phase 1 implementation delivered in this change

- PM2 process log configuration and restart policy hardening in `ecosystem.config.js`.
- Backup script hardening with dependency checks, retention windows, and optional remote sync command.
- SSL renewal automation script added for certbot+nginx.
- Cron installer script added for scheduled backup + SSL renewal.
