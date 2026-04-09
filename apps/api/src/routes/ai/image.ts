import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { getSiteId } from '../../utils/request';
import { saveUploadedMedia } from '../../services/mediaStore';

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

  const generatedText = Buffer.from(`Generated image placeholder for: ${parsed.data.prompt}`, 'utf8').toString('base64');
  const media = await saveUploadedMedia({
    siteId,
    filename: `generated-${Date.now()}.png`,
    mimeType: 'image/png',
    contentBase64: generatedText
  });

  const job = await db.ai_jobs.create({
    data: {
      site_id: siteId,
      entity_type: parsed.data.product_id ? 'product' : 'media',
      entity_id: parsed.data.product_id || null,
      task_type: 'image_generation',
      provider: 'internal',
      model: 'placeholder-image-generator',
      status: 'completed',
      input_payload: parsed.data,
      output_payload: media
    }
  });
  return res.status(201).json({ ok: true, data: { job_id: job.id, media } });
});

export default router;
