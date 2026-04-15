import { mkdir, rm } from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { Router } from 'express';
import { z } from 'zod';
import { DEPLOYMENT_CONFIG } from '../../config/deployment';
import { requireRole } from '../../middleware/auth';
import { deploymentRateLimit, requireCsrfHeaderIfConfigured } from '../../middleware/deploymentSecurity';
import { deploymentQueue } from '../../queues/deploymentQueue';
import { AppRequest } from '../../types';
import {
  createDeploymentJob,
  getDeploymentJob,
  getDeploymentStats,
  listDeploymentJobs,
  persistUploadedArchive,
  requestRollback
} from '../../services/deployments/service';
import { validateDomainFormat } from '../../services/deployments/domainValidation';
import { toPagination } from '../../utils/request';

const router = Router();

const incomingDir = DEPLOYMENT_CONFIG.incomingUploadDir;
const incomingDirResolved = path.resolve(incomingDir);
void mkdir(incomingDir, { recursive: true });

const resolveIncomingPath = (candidatePath: string) => {
  const resolved = path.resolve(candidatePath);
  if (!resolved.startsWith(`${incomingDirResolved}${path.sep}`)) {
    throw new Error('Invalid upload file path');
  }
  return resolved;
};

const removeIncomingFile = async (candidatePath?: string) => {
  if (!candidatePath) return;
  const safePath = resolveIncomingPath(candidatePath);
  await rm(safePath, { force: true }).catch(() => undefined);
};

const upload = multer({
  dest: incomingDir,
  limits: {
    fileSize: DEPLOYMENT_CONFIG.maxCompressedBytes,
    files: 1
  },
  fileFilter: (_req: unknown, file: { originalname: string; mimetype?: string }, cb: (err: Error | null, ok?: boolean) => void) => {
    const lower = file.originalname.toLowerCase();
    if (!lower.endsWith('.zip')) {
      cb(new Error('Only .zip uploads are supported'));
      return;
    }
    const mime = String(file.mimetype || '').toLowerCase();
    const allowedMimes = ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'];
    if (mime && !allowedMimes.includes(mime)) {
      cb(new Error('Uploaded file must be ZIP')); 
      return;
    }
    cb(null, true);
  }
});

const createSchema = z.object({
  siteSlug: z.string().min(2).max(120),
  siteId: z.string().uuid(),
  siteName: z.string().min(2).max(180),
  domain: z.string().min(3),
  optionalPort: z.coerce.number().int().positive().max(65535).optional()
});

router.use(requireRole('super_admin'));
router.use(requireCsrfHeaderIfConfigured);
router.use(deploymentRateLimit);

router.post('/', upload.single('zipFile'), async (req: AppRequest & { file?: { path: string; originalname: string; size: number } }, res) => {
  const parsed = createSchema.safeParse(req.body || {});
  if (!parsed.success) {
    await removeIncomingFile(req.file?.path);
    return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  }
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'zipFile is required' });
  }
  if (!validateDomainFormat(parsed.data.domain)) {
    await removeIncomingFile(req.file.path);
    return res.status(400).json({ ok: false, message: 'Invalid domain format' });
  }

  try {
    const archivePath = await persistUploadedArchive(resolveIncomingPath(req.file.path), req.file.originalname);
    const { job } = await createDeploymentJob({
      siteSlug: parsed.data.siteSlug,
      siteId: parsed.data.siteId,
      siteName: parsed.data.siteName,
      domain: parsed.data.domain,
      optionalPort: parsed.data.optionalPort,
      initiatedBy: String(req.ctx?.user?.sub || ''),
      archivePath,
      archiveSize: req.file.size,
      idempotencyKey: String(req.headers['idempotency-key'] || '').trim() || undefined
    });

    await deploymentQueue.add({ deploymentJobId: job.id });
    await removeIncomingFile(req.file.path);

    return res.status(202).json({ ok: true, data: { deploymentJobId: job.id, status: job.status } });
  } catch (error) {
    await removeIncomingFile(req.file.path);
    return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'Unable to create deployment job' });
  }
});

router.get('/', async (req, res) => {
  const { skip, limit } = toPagination(req);
  const data = await listDeploymentJobs({
    status: req.query.status ? String(req.query.status) : undefined,
    domain: req.query.domain ? String(req.query.domain) : undefined,
    siteSlug: req.query.siteSlug ? String(req.query.siteSlug) : undefined,
    offset: skip,
    limit
  });
  return res.json({ ok: true, data });
});

router.get('/metrics/summary', async (_req, res) => {
  const metrics = await getDeploymentStats();
  return res.json({ ok: true, data: metrics });
});

router.get('/:id', async (req: AppRequest, res) => {
  const job = await getDeploymentJob(req.params.id);
  if (!job) {
    return res.status(404).json({ ok: false, message: 'Deployment job not found' });
  }
  return res.json({ ok: true, data: job });
});

router.post('/:id/rollback', async (req: AppRequest, res) => {
  try {
    await requestRollback(req.params.id, String(req.ctx?.user?.sub || ''));
    return res.json({ ok: true, data: { deploymentJobId: req.params.id, status: 'rolled_back' } });
  } catch (error) {
    return res.status(400).json({ ok: false, message: error instanceof Error ? error.message : 'Rollback failed' });
  }
});

export default router;
