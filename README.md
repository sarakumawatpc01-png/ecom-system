# ecom-system

Monorepo scaffold for the multi-site e-commerce and local business platform defined in `MASTER-SYSTEM-PROMPT.md`.

## Structure

- `apps/api` — shared Express API with auth, site scoping, endpoint surface, queue/service scaffolding
- `apps/super-admin` — super admin Next.js app shell
- `apps/per-site-admin` — per-site admin Next.js app shell
- `apps/site-demo` — example public Next.js storefront shell
- `packages/db` — Prisma schema + DB client/query package
- `packages/seo` — SEO metadata/schema helpers
- `packages/api-client` — typed API fetch helpers
- `scripts` — deployment, site scaffolding, backup and restore scripts

## Quick start

```bash
npm install
npm run build
npm run test
```

## API baseline

- Health check: `GET /api/health`
- Auth: `/auth/*`
- Protected route scaffold for all endpoint groups from Part 4 of the master specification.

## Environment

Key variables used by current scaffold:

- API: `PORT`, `JWT_SECRET`, `DATABASE_URL`
- Site apps: `SITE_ID`, `API_BASE`, `NEXT_PUBLIC_SITE_ID`, `NEXT_PUBLIC_API_BASE`
- Monitoring: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `GSC_SYNC_ENABLED`, `GSC_SYNC_CRON`

For per-site Google Search Console OAuth, store credentials in `sites.config` JSON:

```json
{
  "gsc": {
    "propertyUrl": "sc-domain:example.com",
    "clientId": "google-oauth-client-id",
    "clientSecret": "google-oauth-client-secret",
    "refreshToken": "google-oauth-refresh-token"
  }
}
```

## Notes

This repository now contains a production-oriented baseline architecture and route/schema scaffolding. Business logic integrations (payments, AI providers, scraping, analytics sync, media pipelines) are intentionally scaffolded and should be completed per deployment requirements.

## Compliance tracking

- Phase-by-phase compliance status is tracked in `/home/runner/work/ecom-system/ecom-system/COMPLIANCE-PHASE-MATRIX.md`.
- Infra runtime scripts:
  - Backup: `/home/runner/work/ecom-system/ecom-system/scripts/backup.sh`
  - Restore: `/home/runner/work/ecom-system/ecom-system/scripts/restore-backup.sh`
  - SSL renew: `/home/runner/work/ecom-system/ecom-system/scripts/ssl-renew.sh`
  - Cron install: `/home/runner/work/ecom-system/ecom-system/scripts/install-cron.sh`
