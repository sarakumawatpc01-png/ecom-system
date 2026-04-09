import { Router } from 'express';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { getSiteId } from '../../utils/request';
import { executeAiProvider } from '../../services/ai/providerExecutor';
import { decryptText } from '../../utils/crypto';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const cryptoSecret = process.env.AI_CONFIG_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'dev-encryption-secret';
const decryptApiKey = (cipher: string) => decryptText(cipher, cryptoSecret);

const createCopyJob = async (siteId: string, productId: string, prompt: string) => {
  const config = await db.ai_model_config.findFirst({
    where: { task_type: 'copywriting', is_active: true },
    orderBy: { priority: 'asc' }
  });
  const job = await db.ai_jobs.create({
    data: {
      site_id: siteId,
      entity_type: 'product',
      entity_id: productId,
      task_type: 'copywriting',
      provider: config?.provider || null,
      model: config?.model || null,
      status: config ? 'running' : 'queued',
      input_payload: { prompt }
    }
  });
  if (!config) return job;
  const apiKey = decryptApiKey(config.api_key_encrypted);
  if (!apiKey) return db.ai_jobs.update({ where: { id: job.id }, data: { status: 'failed', error_message: 'Unable to decrypt API key' } });
  const output = await executeAiProvider({
    provider: config.provider,
    model: config.model,
    apiKey,
    prompt,
    taskType: 'copywriting',
    settings: (config.settings as Record<string, unknown>) || {}
  });
  return db.ai_jobs.update({
    where: { id: job.id },
    data: {
      status: 'completed',
      output_payload: ({
        text: output.text,
        description: output.text,
        short_description: output.text.slice(0, 160),
        seo_title: output.text.slice(0, 60),
        seo_description: output.text.slice(0, 155),
        provider: output.provider,
        model: output.model,
        raw: output.raw
      } as any)
    }
  });
};

router.post('/product/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const product = await db.products.findFirst({ where: { site_id: siteId, id: req.params.id, is_deleted: false } });
  if (!product) return res.status(404).json({ ok: false, message: 'Product not found' });
  const tone = req.body?.tone ? String(req.body.tone) : 'professional';
  const prompt =
    `Generate ecommerce product copy in ${tone} tone.\n` +
    `Product: ${product.name}\nDescription: ${product.description || ''}\n`;
  const job = await createCopyJob(siteId, product.id, prompt);
  return res.status(201).json({ ok: true, data: job });
});

router.post('/batch', async (req, res) => {
  const siteId = getSiteId(req);
  const productIds = Array.isArray(req.body?.product_ids) ? req.body.product_ids.map((id: unknown) => String(id)) : [];
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  if (productIds.length === 0) return res.status(400).json({ ok: false, message: 'product_ids is required' });
  const jobs: string[] = [];
  for (const productId of productIds) {
    const product = await db.products.findFirst({ where: { site_id: siteId, id: productId, is_deleted: false } });
    if (!product) continue;
    const job = await createCopyJob(siteId, product.id, `Generate SEO product copy for ${product.name}`);
    jobs.push(job.id);
  }
  return res.status(201).json({ ok: true, data: { jobs } });
});

export default router;
