-- Create deployment status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeploymentJobStatus') THEN
    CREATE TYPE "DeploymentJobStatus" AS ENUM ('queued', 'running', 'success', 'failed', 'rolled_back');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "deployment_jobs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "site_slug" TEXT NOT NULL,
  "site_id" UUID NOT NULL,
  "site_name" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "requested_port" INTEGER,
  "initiated_by" UUID NOT NULL,
  "status" "DeploymentJobStatus" NOT NULL DEFAULT 'queued',
  "current_phase" TEXT NOT NULL DEFAULT 'queued',
  "archive_path" TEXT NOT NULL,
  "archive_size_bytes" INTEGER NOT NULL DEFAULT 0,
  "idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "error_code" TEXT,
  "error_summary" TEXT,
  CONSTRAINT "deployment_jobs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "deployment_jobs_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "deployment_job_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "deployment_job_id" UUID NOT NULL,
  "phase" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deployment_job_events_job_fkey" FOREIGN KEY ("deployment_job_id") REFERENCES "deployment_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "site_releases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "site_slug" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "release_version" TEXT NOT NULL,
  "artifact_path" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "deployment_locks" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "site_slug" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "lock_owner_job_id" TEXT,
  "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "released_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "deployment_jobs_status_created_at_idx" ON "deployment_jobs"("status", "created_at");
CREATE INDEX IF NOT EXISTS "deployment_jobs_site_slug_created_at_idx" ON "deployment_jobs"("site_slug", "created_at");
CREATE INDEX IF NOT EXISTS "deployment_jobs_domain_created_at_idx" ON "deployment_jobs"("domain", "created_at");
CREATE INDEX IF NOT EXISTS "deployment_jobs_site_id_created_at_idx" ON "deployment_jobs"("site_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "deployment_jobs_initiated_by_idempotency_key_key" ON "deployment_jobs"("initiated_by", "idempotency_key");

CREATE INDEX IF NOT EXISTS "deployment_job_events_deployment_job_id_created_at_idx" ON "deployment_job_events"("deployment_job_id", "created_at");
CREATE INDEX IF NOT EXISTS "deployment_job_events_phase_created_at_idx" ON "deployment_job_events"("phase", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "site_releases_site_slug_domain_release_version_key" ON "site_releases"("site_slug", "domain", "release_version");
CREATE INDEX IF NOT EXISTS "site_releases_site_slug_domain_created_at_idx" ON "site_releases"("site_slug", "domain", "created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "deployment_locks_site_slug_domain_key" ON "deployment_locks"("site_slug", "domain");
CREATE INDEX IF NOT EXISTS "deployment_locks_is_active_acquired_at_idx" ON "deployment_locks"("is_active", "acquired_at");
