# Production Readiness Audit Runbook

This runbook is the execution/evidence layer for final go-live readiness.

For end-to-end server bootstrap + deployment command flow, use `/home/runner/work/ecom-system/ecom-system/OPENCODE-SERVER-RUNBOOK.md`.

## Scope

- **In-repo verifications** (can run in CI/local): lint/build/test, API audit endpoints, workflow health.
- **Live environment verifications** (must run on VPS + real domains + real credentials): PM2/Nginx/TLS, external service connectivity, Lighthouse on public URLs, backup/restore drill, monitoring alerts.

## 1) CI + Security Baseline

Run from repo root:

```bash
npm ci
npm run lint
npm run build
npm run test
```

Required CI workflows:

- `CI` (`.github/workflows/ci.yml`)
- `Lighthouse CI` (`.github/workflows/lighthouse.yml`)
- `CodeQL` (`.github/workflows/codeql.yml`)

## 2) API Deep Audit (repo-side runtime matrix)

`GET /api/infra/audit/deep` (super admin auth required) returns:

- Feature surface inventory of core route groups
- Data/module coverage counts (sites, catalog, commerce, AI/SEO, telemetry)
- Runtime checks (backup artifacts, CORS strictness)
- Security checks (super-admin 2FA coverage)
- Critical failure summary

Use this endpoint output as machine-readable audit evidence for each release candidate.

## 3) Site Prelaunch Evidence (per-site)

`GET /api/:siteId/prelaunch/checklist` returns:

- Infra checks (PM2 + HTTPS domain)
- Monitoring checks (Sentry/OpenReplay)
- Security checks (CORS strictness, 2FA policy, lockout policy, admin activity logs)
- SEO/content checks (open SEO issues, AI approval backlog)
- E-commerce checks (SMTP + merchant feed endpoint reference)

Treat `critical_failures > 0` as release blocker.

## 4) Live Environment Proof (outside repo)

Execute and archive evidence for each public domain:

1. PM2 process list + restart behavior proof
2. Nginx vhost and HTTPS redirect proof
3. TLS validity + auto-renew proof
4. Real integration checks:
   - B2/MinIO/Redis/MeiliSearch/OpenReplay/Uptime Kuma/Sentry
   - GSC/Merchant/Ads/SMTP credentials
5. Lighthouse reports (home/category/product): Performance/Accessibility/Best Practices/SEO >= 90
6. Monitoring alert fire-and-resolve proof
7. Backup + restore drill proof
8. 2FA/lockout/token invalidation/CORS allowlist runtime proof

## 5) Release Decision Rule

A release is production-ready only if:

- CI + CodeQL workflows are green,
- `/api/infra/audit/deep` has zero critical failures,
- each target site prelaunch checklist has zero critical failures,
- live environment proof artifacts are complete and signed off.
