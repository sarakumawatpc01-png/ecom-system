import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { getSiteId } from '../../utils/request';
import { decryptText } from '../../utils/crypto';
import { saveUploadedMedia } from '../../services/mediaStore';
import { generateImageWithProvider } from '../../services/ai/mediaGeneration';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const imageSchema = z.object({
  prompt: z.string().min(3),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  product_id: z.string().uuid().optional()
});

router.post('/generate', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = imageSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });

  const config = await db.ai_model_config.findFirst({
    where: { task_type: 'image_generation', is_active: true },
    orderBy: { priority: 'asc' }
  });
  if (!config) return res.status(400).json({ ok: false, message: 'No active AI config found for image_generation' });
  const apiKey = decryptText(config.api_key_encrypted, process.env.AI_CONFIG_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'dev-encryption-secret');
  if (!apiKey) return res.status(400).json({ ok: false, message: 'AI API key decryption failed' });

  const job = await db.ai_jobs.create({
    data: {
      site_id: siteId,
      entity_type: parsed.data.product_id ? 'product' : 'media',
      entity_id: parsed.data.product_id || null,
      task_type: 'image_generation',
      provider: config.provider,
      model: config.model,
      status: 'running',
      input_payload: parsed.data
    }
  });
  try {
    const generated = await generateImageWithProvider({
      provider: config.provider,
      model: config.model,
      apiKey,
      prompt: parsed.data.prompt,
      settings: (config.settings as Record<string, unknown>) || {}
    });
    const media = await saveUploadedMedia({
      siteId,
      filename: `generated-${Date.now()}.png`,
      mimeType: 'image/png',
      sourceUrl: generated.mediaUrl
    });
    await db.ai_jobs.update({
      where: { id: job.id },
      data: { status: 'completed', output_payload: ({ media, provider_output: generated.raw } as any) }
    });
    return res.status(201).json({ ok: true, data: { job_id: job.id, media } });
  } catch (error) {
    await db.ai_jobs.update({
      where: { id: job.id },
      data: { status: 'failed', error_message: error instanceof Error ? error.message : 'Image generation failed' }
    });
    return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Image generation failed' });
  }
});

export default router;
