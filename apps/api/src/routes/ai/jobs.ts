import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { getSiteId, toPagination } from '../../utils/request';
import { executeAiProvider } from '../../services/ai/providerExecutor';
import { decryptText } from '../../utils/crypto';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const rewriteSchema = z.object({
  instructions: z.string().optional(),
  fields: z.array(z.enum(['name', 'description', 'short_description', 'seo_title', 'seo_description'])).optional()
});

const cryptoSecret = process.env.AI_CONFIG_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'dev-encryption-secret';
const decryptApiKey = (cipher: string) => decryptText(cipher, cryptoSecret);

const getActiveConfig = async (taskType: string) =>
  db.ai_model_config.findFirst({
    where: { task_type: taskType, is_active: true },
    orderBy: [{ priority: 'asc' }, { created_at: 'desc' }]
  });

const queueAndRunRewrite = async (siteId: string, taskType: string, entityId: string, prompt: string) => {
  const config = await getActiveConfig(taskType);
  const job = await db.ai_jobs.create({
    data: {
      site_id: siteId,
      entity_type: 'product',
      entity_id: entityId,
      task_type: taskType,
      provider: config?.provider || null,
      model: config?.model || null,
      status: config ? 'running' : 'queued',
      input_payload: { prompt }
    }
  });
  if (!config) return job;
  const apiKey = decryptApiKey(config.api_key_encrypted);
  if (!apiKey) {
    await db.ai_jobs.update({ where: { id: job.id }, data: { status: 'failed', error_message: 'Unable to decrypt API key' } });
    return job;
  }
  try {
    const output = await executeAiProvider({
      provider: config.provider,
      model: config.model,
      apiKey,
      prompt,
      taskType,
      settings: (config.settings as Record<string, unknown>) || {}
    });
    await db.ai_jobs.update({ where: { id: job.id }, data: { status: 'completed', output_payload: output as any } });
  } catch (error) {
    await db.ai_jobs.update({
      where: { id: job.id },
      data: { status: 'failed', error_message: error instanceof Error ? error.message : 'AI provider execution failed' }
    });
  }
  return job;
};

router.get('/jobs', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.ai_jobs.findMany({ where: { site_id: siteId }, orderBy: { created_at: 'desc' }, skip, take: limit }),
    db.ai_jobs.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.get('/jobs/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const job = await db.ai_jobs.findFirst({ where: { site_id: siteId, id: req.params.id } });
  if (!job) return res.status(404).json({ ok: false, message: 'Job not found' });
  return res.json({ ok: true, data: job });
});

router.post('/jobs/:id/approve', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const job = await db.ai_jobs.findFirst({ where: { site_id: siteId, id: req.params.id } });
  if (!job) return res.status(404).json({ ok: false, message: 'Job not found' });
  if (job.entity_type === 'product' && job.entity_id && job.output_payload) {
    const payload = job.output_payload as Record<string, unknown>;
    await db.products.updateMany({
      where: { site_id: siteId, id: job.entity_id },
      data: {
        description: typeof payload.description === 'string' ? payload.description : undefined,
        short_description: typeof payload.short_description === 'string' ? payload.short_description : undefined,
        seo_title: typeof payload.seo_title === 'string' ? payload.seo_title : undefined,
        seo_description: typeof payload.seo_description === 'string' ? payload.seo_description : undefined
      }
    });
  }
  const updated = await db.ai_jobs.update({ where: { id: job.id }, data: { status: 'approved' } });
  return res.json({ ok: true, data: updated });
});

router.post('/jobs/:id/reject', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.ai_jobs.updateMany({
    where: { site_id: siteId, id: req.params.id },
    data: { status: 'rejected', error_message: req.body?.reason ? String(req.body.reason) : null }
  });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Job not found' });
  return res.json({ ok: true });
});

router.post('/rewrite/product/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = rewriteSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const product = await db.products.findFirst({ where: { site_id: siteId, id: req.params.id, is_deleted: false } });
  if (!product) return res.status(404).json({ ok: false, message: 'Product not found' });
  const fields = parsed.data.fields || ['description', 'short_description', 'seo_title', 'seo_description'];
  const prompt =
    `Rewrite product content in a high-conversion style for ${product.name}. Fields: ${fields.join(', ')}.\n` +
    `Current description: ${product.description || ''}\n` +
    `Current short description: ${product.short_description || ''}\n` +
    `Additional instructions: ${parsed.data.instructions || 'Keep concise and SEO friendly.'}`;
  const job = await queueAndRunRewrite(siteId, 'copywriting', product.id, prompt);
  return res.status(201).json({ ok: true, data: job });
});

router.post('/rewrite/batch', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const ids = Array.isArray(req.body?.product_ids) ? req.body.product_ids.map((v: unknown) => String(v)) : [];
  if (ids.length === 0) return res.status(400).json({ ok: false, message: 'product_ids is required' });
  let created = 0;
  for (const id of ids) {
    const product = await db.products.findFirst({ where: { site_id: siteId, id, is_deleted: false } });
    if (!product) continue;
    const prompt = `Rewrite product content for ${product.name}. Keep SEO optimized and conversion-focused.`;
    await queueAndRunRewrite(siteId, 'copywriting', product.id, prompt);
    created += 1;
  }
  return res.status(201).json({ ok: true, data: { queued: created, requested: ids.length } });
});

export default router;
