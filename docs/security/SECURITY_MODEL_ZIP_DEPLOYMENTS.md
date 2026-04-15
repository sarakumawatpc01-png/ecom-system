# Security Model for ZIP Deployments

## Access control
- Endpoints require JWT authentication plus `role=super_admin`.
- Optional CSRF header enforcement via `SUPER_ADMIN_CSRF_TOKEN`.
- Per-IP and per-user deployment rate limits are enforced.

## Upload hardening
- Multipart accepts a single `.zip` file.
- Extension + MIME checks enforced before processing.
- Signature validation ensures ZIP magic bytes.
- Uploads are stored outside any public web root.

## Archive hardening
- Enforced max compressed/extracted size and max file count.
- Rejects path traversal (`..`), absolute paths, symlinks, and device files.
- Rejects blocked executable extensions (`.exe`, `.dll`, `.bat`, `.cmd`, `.ps1`).
- Optional malware scan hook command before extraction.

## Command execution safeguards
- Commands run with `spawn(command, args[])` (no shell interpolation).
- Logs/errors are redacted before persistence and API response.
- Deployment lock prevents concurrent deploys per site/domain.
- Build/install stage uses `npm ci --ignore-scripts` to reduce supply-chain risk from lifecycle scripts.
- Tradeoff: repos that require trusted lifecycle scripts for native builds may fail deployment and must be explicitly allowlisted via a controlled policy update.

## Auditability
- All create/rollback actions write admin activity logs.
- Every phase emits structured `deployment_job_events` with timestamps.
