# Compliance Phase Matrix (MASTER-SYSTEM-PROMPT.md)

Status legend: **Done** = implemented in codebase, **Partial** = scaffolded/incomplete, **Missing** = not yet implemented.

| Phase | Prompt Parts | Status | Evidence |
|---|---|---|---|
| 0 | 1–20 | Done | `/home/runner/work/ecom-system/ecom-system/COMPLIANCE-PHASE-MATRIX.md` |
| 1 | 2, 14, 19 (infra/runtime) | Partial | `/home/runner/work/ecom-system/ecom-system/ecosystem.config.js`, `/home/runner/work/ecom-system/ecom-system/scripts/backup.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/restore-backup.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/ssl-renew.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/install-cron.sh` |
| 2 | 3 (database schema) | Partial | `/home/runner/work/ecom-system/ecom-system/packages/db/prisma/schema.prisma` (expanded fields/enums/indexes), regenerated client via `packages/db prisma:generate` |
| 3 | 4 (shared API) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/index.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/**/*` (role matrix enforcement tightened for products/orders/blog/redirects/landing pages/A-B tests and site status handling) |
| 4 | 5 (Meesho import) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/import/meesho.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/meeshoScraper.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/mediaStore.ts` (review filtering + product/review/media persistence + AI job queueing scaffolded) |
| 5 | 6 (AI model management + generation) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/ai/**/*`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/ai/**/*` (image/video generation now lands in `needs_approval`; approvals persist AI-generated media to `product_images`/`product_videos`) |
| 6 | 7 (AI SEO agent) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/seo/agent.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/workers/seoWorker.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/seoAgent.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/seoAudit.ts` (cron schedules + run-now APIs + approval-queued seo_meta/content_brief jobs + monthly report queueing) |
| 7 | 8 (Heatmaps/session intelligence) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/heatmaps.ts`, `/home/runner/work/ecom-system/ecom-system/packages/db/prisma/schema.prisma` (`heatmap_events`) |
| 8 | 9 (Ads command centre) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/ads.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/index.ts` (`/api/ads/overview`) |
| 9 | 10 (Landing pages + A/B tests) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/landingPages.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/abTests.ts` |
| 10 | 11 (Super admin panel) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/super-admin` |
| 11 | 12 (Per-site admin panels) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/per-site-admin` |
| 12 | 13 (Public Next.js sites) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/site-demo` |
| 13 | 15 (Deployment workflow) | Partial | `/home/runner/work/ecom-system/ecom-system/scripts/new-site.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/deploy-site.sh` |
| 14 | 16 (Monitoring + CI/CD) | Done | `/home/runner/work/ecom-system/ecom-system/.github/workflows/ci.yml`, `/home/runner/work/ecom-system/ecom-system/.github/workflows/lighthouse.yml`, `/home/runner/work/ecom-system/ecom-system/apps/site-demo/.lighthouserc.js`, `/home/runner/work/ecom-system/ecom-system/monitoring/uptime-kuma/monitors.template.json`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/monitoring/sentry.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/monitoring/gsc.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/workers/gscWorker.ts`, `/home/runner/work/ecom-system/ecom-system/apps/*/sentry*.ts` |
| 15 | 17–18 (Merchant feed + email) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/feed/googleMerchant.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/emailService.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/queues/emailQueue.ts` |
| 16 | 19 (security finalization) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/middleware/auth.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/middleware/rateLimit.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/startupAudit.ts` |
| 17 | 20 (pre-launch checklist) | Missing | No full pre-launch evidence checklist artifact yet |
| 18 | Cross-cutting regression/sign-off | Partial | Root validation commands available via `/home/runner/work/ecom-system/ecom-system/package.json` scripts |

## Phase 1 implementation delivered in this change

- PM2 process log configuration and restart policy hardening in `ecosystem.config.js`.
- Backup script hardening with dependency checks, retention windows, and optional remote sync command.
- SSL renewal automation script added for certbot+nginx.
- Cron installer script added for scheduled backup + SSL renewal.

## Phase 5 continuation delivered in this change

- AI image generation jobs now transition to `needs_approval` instead of immediate completion.
- AI video generation jobs now transition to `needs_approval` instead of immediate completion.
- AI job approval flow now applies approved generated media to product entities:
  - image jobs create `product_images` with `source = "ai_generated"` and set primary image
  - video jobs create `product_videos` with `source = "ai_generated"`

## Phase 6 continuation delivered in this change

- Implemented actionable SEO audit scoring and issue/suggestion generation from catalog/blog metadata health.
- Added SEO agent service job runners for:
  - nightly SEO meta queueing (`seo_meta`, `needs_approval`)
  - weekly technical audit snapshots in `seo_audit_results`
  - monday competitor-gap content brief queueing (`content_brief`, `needs_approval`)
  - monthly SEO report generation + email queue event
- Added API endpoints:
  - `GET /api/:siteId/seo/agent/scheduled-jobs`
  - `POST /api/:siteId/seo/agent/run-now` (`nightly|weekly|monday|monthly`)
- Bootstrapped cron-based SEO worker startup in API runtime (`node-cron`, env-configurable schedule overrides).

## Phase 14 delivered in this change

- Added CI workflow for lint/build/test on push to `main` and all pull requests (`.github/workflows/ci.yml`).
- Added Lighthouse CI workflow on push to `main` that blocks failures via assertions in `apps/site-demo/.lighthouserc.js`.
- Added storefront sample product/category routes to support Lighthouse route coverage.
- Added Uptime Kuma monitor template with homepage/product/category/API health checks, 1-minute interval, and 2-failure alert policy.
- Added Sentry initialization across API and all Next.js apps:
  - API runtime init + error middleware + failed AI job capture.
  - Next apps instrumentation files and Sentry config files.
- Added Google Search Console integration service with OAuth refresh-token flow, route-backed reporting, and 6-hour cron sync worker.
