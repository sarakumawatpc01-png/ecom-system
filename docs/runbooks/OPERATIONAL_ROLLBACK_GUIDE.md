# Operational Rollback Guide

## Automatic rollback
Automatic rollback triggers when deployment fails after release switch or health checks fail.

## Manual rollback
1. Find the deployment job id.
2. Execute:
   - `POST /api/super-admin/deployments/:id/rollback`
3. Validate current active release and external health.

## Verification checklist
- Deployment job status is `rolled_back`.
- Latest `deployment_job_events` include rollback event.
- `site_releases` has a single `active=true` previous known-good release.
- Domain health endpoint returns HTTP 200.

## Incident notes
- Archive `deployment_job_events` + `admin_activity_logs` entry IDs.
- Record failed phase and error summary for root cause analysis.
