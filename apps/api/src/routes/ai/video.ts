import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { getSiteId } from '../../utils/request';
import { decryptText } from '../../utils/crypto';
import { saveUploadedMedia } from '../../services/mediaStore';
import { generateVideoWithProvider } from '../../services/ai/mediaGeneration';
import { captureApiError } from '../../services/monitoring/sentry';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const videoSchema = z.object({
  prompt: z.string().min(3),
  duration_seconds: z.number().int().positive().max(120).optional(),
  product_id: z.string().uuid().optional()
});

router.post('/generate', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = videoSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const config = await db.ai_model_config.findFirst({
    where: { task_type: 'video_generation', is_active: true },
    orderBy: { priority: 'asc' }
  });
  if (!config) return res.status(400).json({ ok: false, message: 'No active AI config found for video_generation' });
  const apiKey = decryptText(config.api_key_encrypted, process.env.AI_CONFIG_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'dev-encryption-secret');
  if (!apiKey) return res.status(400).json({ ok: false, message: 'AI API key decryption failed' });

  const job = await db.ai_jobs.create({
    data: {
      site_id: siteId,
      entity_type: parsed.data.product_id ? 'product' : 'media',
      entity_id: parsed.data.product_id || null,
      task_type: 'video_generation',
      provider: config.provider,
      model: config.model,
      status: 'running',
      input_payload: parsed.data
    }
  });
  try {
    const generated = await generateVideoWithProvider({
      provider: config.provider,
      model: config.model,
      apiKey,
      prompt: parsed.data.prompt,
      settings: { ...(config.settings as Record<string, unknown>), duration_seconds: parsed.data.duration_seconds }
    });
    const media = await saveUploadedMedia({
      siteId,
      filename: `generated-${Date.now()}.mp4`,
      mimeType: 'video/mp4',
      sourceUrl: generated.mediaUrl
    });
    await db.ai_jobs.update({
      where: { id: job.id },
      data: { status: 'needs_approval', output_payload: ({ media, provider_output: generated.raw } as any) }
    });
    return res.status(201).json({ ok: true, data: { job_id: job.id, media } });
  } catch (error) {
    await db.ai_jobs.update({
      where: { id: job.id },
      data: { status: 'failed', error_message: error instanceof Error ? error.message : 'Video generation failed' }
    });
    captureApiError(error, { ai_job: { id: job.id, task_type: 'video_generation', site_id: siteId } });
    return res.status(500).json({ ok: false, message: error instanceof Error ? error.message : 'Video generation failed' });
  }
});

export default router;
