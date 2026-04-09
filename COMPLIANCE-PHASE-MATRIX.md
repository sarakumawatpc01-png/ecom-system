# Compliance Phase Matrix (MASTER-SYSTEM-PROMPT.md)

Status legend: **Done** = implemented in codebase, **Partial** = scaffolded/incomplete, **Missing** = not yet implemented.

| Phase | Prompt Parts | Status | Evidence |
|---|---|---|---|
| 0 | 1–20 | Done | `/home/runner/work/ecom-system/ecom-system/COMPLIANCE-PHASE-MATRIX.md` |
| 1 | 2, 14, 19 (infra/runtime) | Done | `/home/runner/work/ecom-system/ecom-system/ecosystem.config.js`, `/home/runner/work/ecom-system/ecom-system/scripts/backup.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/restore-backup.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/ssl-renew.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/install-cron.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/generate-nginx-site-config.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/templates/nginx-site.conf.template`, `/home/runner/work/ecom-system/ecom-system/scripts/setup-logrotate.sh` |
| 2 | 3 (database schema) | Partial | `/home/runner/work/ecom-system/ecom-system/packages/db/prisma/schema.prisma` (expanded fields/enums/indexes), regenerated client via `packages/db prisma:generate` |
| 3 | 4 (shared API) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/index.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/**/*` (role matrix enforcement tightened for products/orders/blog/redirects/landing pages/A-B tests and site status handling) |
| 4 | 5 (Meesho import) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/import/meesho.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/meeshoScraper.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/mediaStore.ts` (review filtering + product/review/media persistence + AI job queueing scaffolded) |
| 5 | 6 (AI model management + generation) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/ai/**/*`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/ai/**/*` (image/video generation now lands in `needs_approval`; approvals persist AI-generated media to `product_images`/`product_videos`) |
| 6 | 7 (AI SEO agent) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/seo/agent.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/workers/seoWorker.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/seoAgent.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/seoAudit.ts` (cron schedules + run-now APIs + approval-queued seo_meta/content_brief jobs + monthly report queueing) |
| 7 | 8 (Heatmaps/session intelligence) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/heatmaps.ts`, `/home/runner/work/ecom-system/ecom-system/packages/db/prisma/schema.prisma` (`heatmap_events`) — added event ingestion, session filters (converted/bounced/device/source/rage clicks), and AI insight summary API |
| 8 | 9 (Ads command centre) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/ads.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/index.ts` (`/api/ads/overview`) — added performance, budget tracker, attribution breakdown, and persistent UTM builder/history APIs |
| 9 | 10 (Landing pages + A/B tests) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/landingPages.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/abTests.ts` — expanded A/B constraints (2–5 variants, split validation), live metrics, significance/confidence bands, and declare-winner flow |
| 10 | 11 (Super admin panel) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/super-admin/app/layout.tsx`, `/home/runner/work/ecom-system/ecom-system/apps/super-admin/app/site-selector.tsx`, `/home/runner/work/ecom-system/ecom-system/apps/super-admin/app/page.tsx` (dark shell + broad module nav + persistent site selector + overview cards scaffold) |
| 11 | 12 (Per-site admin panels) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/per-site-admin/app/layout.tsx`, `/home/runner/work/ecom-system/ecom-system/apps/per-site-admin/app/page.tsx`, `/home/runner/work/ecom-system/ecom-system/apps/per-site-admin/app/admin/[siteId]/page.tsx` (site-scoped nav/shell + `/admin/[siteId]` route scaffold) |
| 12 | 13 (Public Next.js sites) | Partial | `/home/runner/work/ecom-system/ecom-system/apps/site-demo/app/layout.tsx`, `/home/runner/work/ecom-system/ecom-system/apps/site-demo/app/sitemap.ts`, `/home/runner/work/ecom-system/ecom-system/apps/site-demo/app/robots.ts`, `/home/runner/work/ecom-system/ecom-system/apps/site-demo/app/{about,contact,search,cart,checkout,account,blog,store,lp,[category],products/[slug],categories/[slug]}` (expanded route map + metadata/noindex rules scaffold) |
| 13 | 15 (Deployment workflow) | Done | `/home/runner/work/ecom-system/ecom-system/scripts/new-site.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/deploy-site.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/generate-nginx-site-config.sh`, `/home/runner/work/ecom-system/ecom-system/scripts/templates/nginx-site.conf.template`, `/home/runner/work/ecom-system/ecom-system/briefs/*.md`, `/home/runner/work/ecom-system/ecom-system/briefs/*.sql` |
| 14 | 16 (Monitoring + CI/CD) | Done | `/home/runner/work/ecom-system/ecom-system/.github/workflows/ci.yml`, `/home/runner/work/ecom-system/ecom-system/.github/workflows/lighthouse.yml`, `/home/runner/work/ecom-system/ecom-system/apps/site-demo/.lighthouserc.js`, `/home/runner/work/ecom-system/ecom-system/monitoring/uptime-kuma/monitors.template.json`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/monitoring/sentry.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/monitoring/gsc.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/workers/gscWorker.ts`, `/home/runner/work/ecom-system/ecom-system/apps/*/sentry*.ts` |
| 15 | 17–18 (Merchant feed + email) | Done | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/feed/googleMerchant.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/services/emailService.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/queues/emailQueue.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/workers/emailWorker.ts`, `/home/runner/work/ecom-system/ecom-system/packages/db/prisma/schema.prisma` (`email_logs`) |
| 16 | 19 (security finalization) | Done | `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/auth.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/lib/cacheStore.ts`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/index.ts` (strict CORS), `/home/runner/work/ecom-system/ecom-system/apps/api/src/middleware/activityLogger.ts`, `/home/runner/work/ecom-system/ecom-system/packages/db/prisma/schema.prisma` (`admin_activity_logs`) |
| 17 | 20 (pre-launch checklist) | Done | `/home/runner/work/ecom-system/ecom-system/PRE-LAUNCH-CHECKLIST.md`, `/home/runner/work/ecom-system/ecom-system/apps/api/src/routes/prelaunch.ts` |
| 18 | Cross-cutting regression/sign-off | Done | Root validation commands available via `/home/runner/work/ecom-system/ecom-system/package.json` scripts, plus current implementation verification run |

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

## Phases 15–18 delivered in this change

- **Part 17 (Google Merchant feed)**:
  - Upgraded endpoint to XML output with required GMC fields and shipping blocks.
  - Added 1-hour cache support and product-change cache invalidation.
- **Part 18 (Email system)**:
  - Implemented typed transactional email templates with site branding and SMTP config from `sites.config`.
  - Added queue processing with BullMQ when Redis is present and in-memory fallback otherwise.
  - Added DB email logging (`email_logs`) including failure reasons.
  - Wired order lifecycle email triggers for confirmation/shipped/delivered.
- **Part 19 (Security finalization)**:
  - Added strict origin allowlist CORS handling.
  - Added login lockout (5 failed attempts => 15-minute lockout).
  - Added refresh token storage/invalidation flow using shared cache store (Redis-backed when configured).
  - Enforced mandatory 2FA for `super_admin`.
  - Added admin write-action logging into `admin_activity_logs`.
- **Part 20 (Pre-launch checklist)**:
  - Added full checklist artifact and API evidence endpoint for per-site launch readiness status.

## Additional infra/deployment completion delivered in this change

- **Part 2 (Infrastructure setup hardening)**:
  - Added reusable Nginx site config template with HTTPS redirect, TLS headers, and gzip settings.
  - Added generator script for domain+port Nginx site config output.
  - Added logrotate installer script targeting 30 daily rotations and 50MB max file size.
- **Part 15 (Deployment workflow automation)**:
  - Enhanced `new-site.sh` to also scaffold a site brief and SQL registration template.
  - Enhanced `deploy-site.sh` to support optional domain-driven Nginx config generation and certbot handoff.

## Parts 8–10 API continuation delivered in this change

- **Part 8 (Heatmaps & session intelligence)**:
  - Added ingestion API for heatmap/session events with device/browser/source/rage-click metadata.
  - Added richer session filters (converted, bounced, device, traffic source, duration, rage-click).
  - Added AI-backed plain-English insights endpoint for conversion analysis.
- **Part 9 (Ads command centre)**:
  - Added performance dashboard API payload with spend/revenue/ROAS/CPA breakdown.
  - Added budget tracker and attribution breakdown APIs.
  - Added full UTM builder API (campaign/source/medium/content/term), generated URL/QR, and persistent history retrieval.
- **Part 10 (Landing pages + A/B tests)**:
  - Enforced A/B creation constraints (2–5 variants, success metrics, traffic split validation).
  - Added list/results payloads with conversion-rate, revenue-per-visitor, and confidence-band/significance metrics.
  - Added resume and declare-winner workflows, including winner publishing and confidence gating.

## Parts 11–13 frontend continuation delivered in this change

- **Part 11 (Super Admin panel)**:
  - Replaced single-page placeholder with a dark dashboard shell (sidebar + top header + content region).
  - Added persistent site selector in header (stored in localStorage) to model global site scoping UX.
  - Added broad module navigation tree and overview KPI card scaffolding.
- **Part 12 (Per-site admin panel)**:
  - Implemented site-admin shell with scoped navigation that omits cross-site modules.
  - Added `/admin/[siteId]` route scaffold for super-admin site-specific access pathing.
  - Added site-scoped dashboard cards and context messaging for restricted visibility.
- **Part 13 (Public Next.js site)**:
  - Expanded App Router structure with required base routes (about/contact/search/cart/checkout/account/blog/blog post/store city/landing page/category route).
  - Added `sitemap.ts` and `robots.ts` with noindex-sensitive path exclusions and sitemap pointer.
  - Added metadata/generateMetadata scaffolding across homepage, category, product, blog, store, and landing routes.
