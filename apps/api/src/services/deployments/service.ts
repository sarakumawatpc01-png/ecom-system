import { copyFile, cp, lstat, mkdir, readFile, readdir, rm, symlink, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { DEPLOYMENT_CONFIG, DEPLOYMENT_PHASES, DeploymentPhase, DeploymentStatus } from '../../config/deployment';
import { db } from '../../lib/db';
import { logAdminActivity } from '../activityLog';
import { runCommand } from './command';
import { assertDomainAllowed, normalizeDomain } from './domainValidation';
import { redactSecrets } from './redaction';
import { assertStatusTransition } from './stateMachine';
import { extractZipSafely, inspectZipArchive, isZipSignature, runMalwareScanHook, validateZipEntries } from './zipSecurity';

type RollbackCandidateJob = {
  id: string;
  site_slug: string;
  site_id: string;
  domain: string;
};

const nowIso = () => new Date().toISOString();

const safeResolveUnder = (baseDir: string, ...parts: string[]) => {
  const baseResolved = path.resolve(baseDir);
  const target = path.resolve(baseResolved, ...parts);
  if (target !== baseResolved && !target.startsWith(`${baseResolved}${path.sep}`)) {
    throw new Error(`Unsafe path resolution outside base directory: ${baseDir}`);
  }
  return target;
};

export const withBackoff = async <T>(
  run: () => Promise<T>,
  opts: { retries: number; baseDelayMs: number; retryable?: (error: unknown) => boolean }
): Promise<T> => {
  let latest: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      latest = error;
      if (attempt === opts.retries || (opts.retryable && !opts.retryable(error))) throw latest;
      const delay = opts.baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw latest;
};

const assertValidPhase = (phase: string): DeploymentPhase => {
  if (!DEPLOYMENT_PHASES.includes(phase as DeploymentPhase)) {
    throw new Error(`Invalid deployment phase: ${phase}`);
  }
  return phase as DeploymentPhase;
};

const emitEvent = async (
  deploymentJobId: string,
  phase: DeploymentPhase,
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, unknown>
) => {
  await db.deployment_job_events.create({
    data: {
      deployment_job_id: deploymentJobId,
      phase,
      level,
      message: redactSecrets(message),
      metadata_json: (metadata || {}) as any
    }
  });
};

const updateJob = async (
  deploymentJobId: string,
  payload: Partial<{
    status: DeploymentStatus;
    current_phase: DeploymentPhase;
    started_at: Date;
    finished_at: Date;
    error_code: string | null;
    error_summary: string | null;
  }>
) => {
  if (payload.status) {
    const current = await db.deployment_jobs.findUnique({ where: { id: deploymentJobId }, select: { status: true } });
    if (current?.status) {
      assertStatusTransition(current.status as DeploymentStatus, payload.status);
    }
  }
  await db.deployment_jobs.update({ where: { id: deploymentJobId }, data: payload as any });
};

const setPhase = async (deploymentJobId: string, phase: DeploymentPhase, message: string, metadata?: Record<string, unknown>) => {
  await db.deployment_jobs.update({ where: { id: deploymentJobId }, data: { current_phase: phase } });
  await emitEvent(deploymentJobId, phase, 'info', message, metadata);
};

const ensureWorkspace = async (deploymentJobId: string) => {
  const workspacePath = safeResolveUnder(DEPLOYMENT_CONFIG.workspaceDir, deploymentJobId);
  await rm(workspacePath, { recursive: true, force: true });
  await mkdir(workspacePath, { recursive: true });
  return workspacePath;
};

const getReleasePaths = (siteSlug: string, domain: string, releaseVersion: string) => {
  const baseDir = safeResolveUnder(DEPLOYMENT_CONFIG.releasesDir, siteSlug, domain);
  const releasesDir = safeResolveUnder(baseDir, 'releases');
  const releaseDir = safeResolveUnder(releasesDir, releaseVersion);
  const currentLink = safeResolveUnder(baseDir, 'current');
  return { baseDir, releasesDir, releaseDir, currentLink };
};

const switchCurrentSymlink = async (currentLink: string, targetDir: string) => {
  const tmpLink = `${currentLink}.next`;
  await unlink(tmpLink).catch(() => undefined);
  await symlink(targetDir, tmpLink);
  await unlink(currentLink).catch(() => undefined);
  await symlink(targetDir, currentLink);
  await unlink(tmpLink).catch(() => undefined);
};

const runHealthChecks = async (domain: string, port: number, deploymentJobId: string) => {
  const internalUrl = `http://127.0.0.1:${port}${DEPLOYMENT_CONFIG.internalHealthPath}`;
  const externalUrl = `https://${domain}${DEPLOYMENT_CONFIG.externalHealthPath}`;

  await withBackoff(
    async () => {
      const response = await fetch(internalUrl);
      if (!response.ok) throw new Error(`Internal health check failed: ${response.status}`);
      return response;
    },
    { retries: DEPLOYMENT_CONFIG.maxHealthRetries, baseDelayMs: 1000 }
  );

  await emitEvent(deploymentJobId, 'health_checks', 'info', 'Internal health check passed', { internalUrl });

  await withBackoff(
    async () => {
      const response = await fetch(externalUrl);
      if (!response.ok) throw new Error(`External health check failed: ${response.status}`);
      return response;
    },
    { retries: DEPLOYMENT_CONFIG.maxHealthRetries, baseDelayMs: 1500 }
  );

  await emitEvent(deploymentJobId, 'health_checks', 'info', 'External health check passed', { externalUrl });
};

const configureNginx = async (domain: string, port: number) => {
  await mkdir(DEPLOYMENT_CONFIG.nginxOutputDir, { recursive: true });
  const outputFile = path.join(DEPLOYMENT_CONFIG.nginxOutputDir, `${domain}.conf`);
  await runCommand('bash', [
    path.resolve(process.cwd(), 'scripts/generate-nginx-site-config.sh'),
    domain,
    String(port),
    outputFile
  ]);

  if (!DEPLOYMENT_CONFIG.simulateInfraChanges) {
    await runCommand('sudo', ['cp', outputFile, `/etc/nginx/sites-available/${domain}.conf`]);
    await runCommand('sudo', ['ln', '-sf', `/etc/nginx/sites-available/${domain}.conf`, `/etc/nginx/sites-enabled/${domain}.conf`]);
    await runCommand('sudo', ['nginx', '-t']);
    await runCommand('sudo', ['systemctl', 'reload', 'nginx']);
  }

  return outputFile;
};

const configureSsl = async (domain: string) => {
  if (DEPLOYMENT_CONFIG.simulateInfraChanges) {
    return { mode: 'simulated' };
  }
  return withBackoff(
    async () => {
      await runCommand('sudo', ['certbot', '--nginx', '-d', domain, '-d', `www.${domain}`, '--non-interactive', '--agree-tos']);
      return { mode: 'certbot' };
    },
    {
      retries: 2,
      baseDelayMs: 3000,
      retryable: (error) => /timeout|temporar|429|rate/i.test(String(error))
    }
  );
};

const validateStructure = async (workspacePath: string) => {
  const packageJsonPath = path.join(workspacePath, 'package.json');
  const pkgRaw = await readFile(packageJsonPath, 'utf8').catch(() => '');
  if (!pkgRaw) throw new Error('Uploaded ZIP must contain package.json at root');
  const pkg = JSON.parse(pkgRaw) as { dependencies?: Record<string, string>; scripts?: Record<string, string> };
  if (!pkg.scripts?.build) throw new Error('Uploaded ZIP package.json is missing build script');
  if (!pkg.dependencies?.next && !pkg.dependencies?.['@ecom/site']) {
    throw new Error('Uploaded ZIP package.json is missing required runtime dependency');
  }
};

const cleanOldReleases = async (siteSlug: string, domain: string) => {
  const rows = await db.site_releases.findMany({
    where: { site_slug: siteSlug, domain },
    orderBy: { created_at: 'desc' }
  });
  const stale = rows.slice(DEPLOYMENT_CONFIG.keepReleaseCount);
  for (const item of stale) {
    if (item.active) continue;
    await rm(item.artifact_path, { recursive: true, force: true }).catch(() => undefined);
    await db.site_releases.delete({ where: { id: item.id } }).catch(() => undefined);
  }
};

const acquireLock = async (siteSlug: string, domain: string, deploymentJobId: string) => {
  const lock = await db.deployment_locks.findUnique({ where: { site_slug_domain: { site_slug: siteSlug, domain } } });
  if (lock?.is_active) throw new Error('Another deployment is already active for this site/domain');

  await db.deployment_locks.upsert({
    where: { site_slug_domain: { site_slug: siteSlug, domain } },
    create: {
      site_slug: siteSlug,
      domain,
      lock_owner_job_id: deploymentJobId,
      acquired_at: new Date(),
      is_active: true
    },
    update: {
      lock_owner_job_id: deploymentJobId,
      acquired_at: new Date(),
      is_active: true
    }
  });
};

const releaseLock = async (siteSlug: string, domain: string) => {
  await db.deployment_locks
    .update({
      where: { site_slug_domain: { site_slug: siteSlug, domain } },
      data: { is_active: false, released_at: new Date() }
    })
    .catch(() => undefined);
};

export const createDeploymentJob = async (input: {
  siteSlug: string;
  siteId: string;
  siteName: string;
  domain: string;
  optionalPort?: number;
  initiatedBy: string;
  archivePath: string;
  archiveSize: number;
  idempotencyKey?: string;
}) => {
  const normalizedDomain = assertDomainAllowed(input.domain);
  const site = await db.sites.findUnique({ where: { id: input.siteId } });
  if (!site) throw new Error('Site not found');
  if (site.slug !== input.siteSlug) throw new Error('siteSlug does not match siteId');

  const duplicate = input.idempotencyKey
    ? await db.deployment_jobs.findFirst({
        where: {
          initiated_by: input.initiatedBy,
          idempotency_key: input.idempotencyKey
        }
      })
    : null;
  if (duplicate) {
    return { job: duplicate, duplicate: true };
  }

  const job = await db.deployment_jobs.create({
    data: {
      site_slug: input.siteSlug,
      site_id: input.siteId,
      site_name: input.siteName,
      domain: normalizedDomain,
      requested_port: input.optionalPort || DEPLOYMENT_CONFIG.defaultPort,
      initiated_by: input.initiatedBy,
      status: 'queued',
      current_phase: 'queued',
      archive_path: input.archivePath,
      archive_size_bytes: input.archiveSize,
      idempotency_key: input.idempotencyKey || null
    }
  });

  await emitEvent(job.id, 'queued', 'info', 'Deployment job queued', {
    siteSlug: input.siteSlug,
    domain: normalizedDomain,
    archiveSize: input.archiveSize
  });

  await logAdminActivity({
    user_id: input.initiatedBy,
    site_id: input.siteId,
    action: 'DEPLOYMENT_CREATE',
    entity: 'deployment_jobs',
    entity_id: job.id,
    meta: { domain: normalizedDomain, site_slug: input.siteSlug }
  });

  return { job, duplicate: false };
};

export const listDeploymentJobs = async (input: { status?: string; domain?: string; siteSlug?: string; limit: number; offset: number }) => {
  const where: Record<string, unknown> = {};
  if (input.status) where.status = input.status;
  if (input.domain) where.domain = normalizeDomain(input.domain);
  if (input.siteSlug) where.site_slug = input.siteSlug;

  const [items, total] = await Promise.all([
    db.deployment_jobs.findMany({
      where: where as any,
      orderBy: { created_at: 'desc' },
      skip: input.offset,
      take: input.limit
    }),
    db.deployment_jobs.count({ where: where as any })
  ]);

  return { items, total };
};

export const getDeploymentJob = async (deploymentJobId: string) => {
  const job = await db.deployment_jobs.findUnique({ where: { id: deploymentJobId } });
  if (!job) return null;
  const [events, releases] = await Promise.all([
    db.deployment_job_events.findMany({ where: { deployment_job_id: deploymentJobId }, orderBy: { created_at: 'asc' } }),
    db.site_releases.findMany({ where: { site_slug: job.site_slug, domain: job.domain }, orderBy: { created_at: 'desc' }, take: 5 })
  ]);
  return {
    ...job,
    events: events.map((event) => ({ ...event, message: redactSecrets(event.message || '') })),
    releases
  };
};

const markReleaseActive = async (siteSlug: string, domain: string, releaseVersion: string, artifactPath: string) => {
  await db.site_releases.updateMany({ where: { site_slug: siteSlug, domain }, data: { active: false } });
  await db.site_releases.create({
    data: {
      site_slug: siteSlug,
      domain,
      release_version: releaseVersion,
      artifact_path: artifactPath,
      active: true
    }
  });
};

const rollbackToLastGoodRelease = async (job: RollbackCandidateJob, reason: string) => {
  const release = await db.site_releases.findFirst({
    where: { site_slug: job.site_slug, domain: job.domain, active: false },
    orderBy: { created_at: 'desc' }
  });
  if (!release) {
    await emitEvent(job.id, 'rollback', 'warn', 'No prior release found for rollback');
    return false;
  }

  const { currentLink } = getReleasePaths(job.site_slug, job.domain, release.release_version);
  await switchCurrentSymlink(currentLink, release.artifact_path);
  await db.site_releases.updateMany({ where: { site_slug: job.site_slug, domain: job.domain }, data: { active: false } });
  await db.site_releases.update({ where: { id: release.id }, data: { active: true } });
  await emitEvent(job.id, 'rollback', 'warn', `Rolled back to release ${release.release_version}`, { reason });
  return true;
};

export const requestRollback = async (deploymentJobId: string, initiatedBy: string) => {
  const job = await db.deployment_jobs.findUnique({ where: { id: deploymentJobId } });
  if (!job) throw new Error('Deployment job not found');
  if (!['failed', 'success'].includes(job.status)) {
    throw new Error('Rollback is only allowed for failed/successful jobs');
  }

  const rolledBack = await rollbackToLastGoodRelease(job, 'manual_rollback');
  if (!rolledBack) throw new Error('No previous release available for rollback');

  await db.deployment_jobs.update({
    where: { id: deploymentJobId },
    data: {
      status: 'rolled_back',
      current_phase: 'rollback',
      finished_at: new Date()
    }
  });

  await logAdminActivity({
    user_id: initiatedBy,
    site_id: job.site_id,
    action: 'DEPLOYMENT_ROLLBACK',
    entity: 'deployment_jobs',
    entity_id: job.id,
    meta: { site_slug: job.site_slug, domain: job.domain }
  });
};

const writeMetrics = async (payload: Record<string, unknown>) => {
  const metricsDir = path.join(DEPLOYMENT_CONFIG.workspaceDir, 'metrics');
  await mkdir(metricsDir, { recursive: true });
  const line = JSON.stringify({ at: nowIso(), ...payload });
  await writeFile(path.join(metricsDir, 'deployment-metrics.log'), `${line}\n`, { flag: 'a' });
};

export const processDeploymentJob = async (deploymentJobId: string) => {
  const startedAt = Date.now();
  const job = await db.deployment_jobs.findUnique({ where: { id: deploymentJobId } });
  if (!job) return;

  await acquireLock(job.site_slug, job.domain, job.id);

  try {
    await updateJob(job.id, { status: 'running', started_at: new Date() });

    await setPhase(job.id, 'validate_input', 'Validating deployment payload');
    assertDomainAllowed(job.domain);

    const site = await db.sites.findUnique({ where: { id: job.site_id } });
    if (!site) throw new Error('Site not found for deployment');
    const archiveStat = await lstat(job.archive_path);
    if (!archiveStat.isFile()) throw new Error('Uploaded archive not found');
    if (archiveStat.size > DEPLOYMENT_CONFIG.maxCompressedBytes) throw new Error('Archive size exceeds limit');

    await setPhase(job.id, 'zip_security', 'Running archive safety checks');
    const zipSignature = await isZipSignature(job.archive_path);
    if (!zipSignature) throw new Error('Uploaded file is not a valid ZIP signature');
    const zipEntries = await inspectZipArchive(job.archive_path);
    const zipSummary = validateZipEntries(zipEntries);
    await runMalwareScanHook(job.archive_path);
    await emitEvent(job.id, 'zip_security', 'info', 'Archive validation passed', zipSummary);

    await setPhase(job.id, 'extract_workspace', 'Extracting archive to isolated workspace');
    const workspacePath = await ensureWorkspace(job.id);
    await extractZipSafely(job.archive_path, workspacePath);

    await setPhase(job.id, 'validate_structure', 'Validating app structure');
    await validateStructure(workspacePath);

    await setPhase(job.id, 'prepare_runtime', 'Preparing deployment runtime directories');
    const releaseVersion = `r${Date.now()}`;
    const { releasesDir, releaseDir, currentLink } = getReleasePaths(job.site_slug, job.domain, releaseVersion);
    await mkdir(releasesDir, { recursive: true });

    await setPhase(job.id, 'build_site', 'Running deterministic build command');
    await runCommand('npm', ['ci', '--ignore-scripts'], { cwd: workspacePath, timeoutMs: DEPLOYMENT_CONFIG.maxBuildSeconds * 1000 });
    await runCommand('npm', ['run', 'build'], { cwd: workspacePath, timeoutMs: DEPLOYMENT_CONFIG.maxBuildSeconds * 1000 });

    await setPhase(job.id, 'deploy_artifact', 'Deploying build artifact atomically');
    await rm(releaseDir, { recursive: true, force: true });
    await mkdir(releaseDir, { recursive: true });
    await cp(workspacePath, releaseDir, { recursive: true });
    await switchCurrentSymlink(currentLink, releaseDir);
    await markReleaseActive(job.site_slug, job.domain, releaseVersion, releaseDir);
    await cleanOldReleases(job.site_slug, job.domain);

    await setPhase(job.id, 'configure_nginx', 'Generating and applying nginx site config');
    const nginxConfigPath = await configureNginx(job.domain, job.requested_port || DEPLOYMENT_CONFIG.defaultPort);
    await emitEvent(job.id, 'configure_nginx', 'info', 'Nginx config generated', { nginxConfigPath });

    await setPhase(job.id, 'provision_ssl', 'Provisioning/renewing SSL certificate');
    const sslResult = await configureSsl(job.domain);
    await emitEvent(job.id, 'provision_ssl', 'info', 'SSL provisioning complete', sslResult as Record<string, unknown>);

    await setPhase(job.id, 'health_checks', 'Running internal and external health checks');
    await runHealthChecks(job.domain, job.requested_port || DEPLOYMENT_CONFIG.defaultPort, job.id);

    await setPhase(job.id, 'finalize', 'Finalizing deployment');
    await db.sites.update({
      where: { id: job.site_id },
      data: { domain: job.domain, nginx_port: job.requested_port || DEPLOYMENT_CONFIG.defaultPort }
    });
    await updateJob(job.id, { status: 'success', current_phase: 'finalize', finished_at: new Date(), error_code: null, error_summary: null });
    await emitEvent(job.id, 'finalize', 'info', 'Deployment completed successfully');

    await writeMetrics({
      deploymentJobId: job.id,
      status: 'success',
      duration_ms: Date.now() - startedAt,
      site_slug: job.site_slug,
      domain: job.domain
    });
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : 'Deployment failed');
    await emitEvent(job.id, assertValidPhase(job.current_phase || 'finalize'), 'error', message);

    await db.deployment_jobs.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        finished_at: new Date(),
        error_code: 'DEPLOYMENT_FAILED',
        error_summary: message
      }
    });

    const rolledBack = await rollbackToLastGoodRelease(job, 'automatic_failure');
    if (rolledBack) {
      await db.deployment_jobs.update({
        where: { id: job.id },
        data: { status: 'rolled_back', current_phase: 'rollback', finished_at: new Date() }
      });
    }

    await writeMetrics({
      deploymentJobId: job.id,
      status: rolledBack ? 'rolled_back' : 'failed',
      duration_ms: Date.now() - startedAt,
      failed_phase: job.current_phase || 'unknown',
      site_slug: job.site_slug,
      domain: job.domain
    });
  } finally {
    await releaseLock(job.site_slug, job.domain);
    await rm(safeResolveUnder(DEPLOYMENT_CONFIG.workspaceDir, job.id), { recursive: true, force: true }).catch(() => undefined);
  }
};

export const persistUploadedArchive = async (sourcePath: string, fileName: string) => {
  await mkdir(DEPLOYMENT_CONFIG.uploadDir, { recursive: true });
  const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const targetPath = safeResolveUnder(DEPLOYMENT_CONFIG.uploadDir, safeName);
  await copyFile(sourcePath, targetPath);
  return targetPath;
};

export const getDeploymentStats = async () => {
  const jobs = await db.deployment_jobs.findMany({
    where: { created_at: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    select: { status: true, started_at: true, finished_at: true, current_phase: true }
  });
  const success = jobs.filter((item) => item.status === 'success').length;
  const failed = jobs.filter((item) => item.status === 'failed').length;
  const rolledBack = jobs.filter((item) => item.status === 'rolled_back').length;
  const durations = jobs
    .filter((item) => item.started_at && item.finished_at)
    .map((item) => (item.finished_at!.getTime() - item.started_at!.getTime()) / 1000);

  const failedByPhase = jobs.reduce<Record<string, number>>((acc, item) => {
    if (item.status !== 'failed') return acc;
    const key = item.current_phase || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    success_rate: jobs.length ? success / jobs.length : 0,
    failed_count: failed,
    rolled_back_count: rolledBack,
    avg_duration_seconds: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    failed_phase_count: failedByPhase
  };
};
