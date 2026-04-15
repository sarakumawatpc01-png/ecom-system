# Super Admin ZIP Deployment Guide

## Overview
The super admin deployment flow uploads a prebuilt ZIP archive, validates archive safety, builds in an isolated workspace, deploys via versioned releases, updates nginx/SSL hooks, executes health checks, and records a complete audit trail.

## API endpoints
- `POST /api/super-admin/deployments` (multipart: `zipFile`, `siteSlug`, `siteId`, `siteName`, `domain`, optional `optionalPort`)
- `GET /api/super-admin/deployments/:id`
- `GET /api/super-admin/deployments`
- `POST /api/super-admin/deployments/:id/rollback`
- `GET /api/super-admin/deployments/metrics/summary`

## UI flow
1. Open **Super Admin → Deploy Site ZIP**.
2. Fill site/domain metadata and attach ZIP.
3. Submit and copy returned job ID.
4. Watch timeline and redacted logs until terminal status (`success`, `failed`, `rolled_back`).

## Required environment variables
- `DEPLOYMENT_UPLOAD_DIR`
- `DEPLOYMENT_WORKSPACE_DIR`
- `DEPLOYMENT_RELEASES_DIR`
- `DEPLOYMENT_ALLOWED_DOMAIN_SUFFIXES`
- `DEPLOYMENT_SIMULATE_INFRA_CHANGES`
- Optional malware scan hook: `DEPLOYMENT_MALWARE_SCAN_COMMAND`, `DEPLOYMENT_MALWARE_SCAN_ARGS`

## Idempotency
Send `Idempotency-Key` header on `POST /deployments` to avoid duplicate queued jobs.
