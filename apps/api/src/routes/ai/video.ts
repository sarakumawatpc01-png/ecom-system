import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { getSiteId } from '../../utils/request';
import { saveUploadedMedia } from '../../services/mediaStore';

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
  const placeholderPayload = Buffer.from(`Generated video placeholder for: ${parsed.data.prompt}`, 'utf8').toString('base64');
  const media = await saveUploadedMedia({
    siteId,
    filename: `generated-${Date.now()}.mp4`,
    mimeType: 'video/mp4',
    contentBase64: placeholderPayload
  });
  const job = await db.ai_jobs.create({
    data: {
      site_id: siteId,
      entity_type: parsed.data.product_id ? 'product' : 'media',
      entity_id: parsed.data.product_id || null,
      task_type: 'video_generation',
      provider: 'internal',
      model: 'placeholder-video-generator',
      status: 'completed',
      input_payload: parsed.data,
      output_payload: media
    }
  });
  return res.status(201).json({ ok: true, data: { job_id: job.id, media } });
});

export default router;
