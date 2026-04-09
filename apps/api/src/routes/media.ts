import { Router } from 'express';
import { z } from 'zod';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId } from '../utils/request';
import { deleteMedia, listMedia, saveUploadedMedia } from '../services/mediaStore';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const uploadSchema = z.object({
  filename: z.string().min(1),
  mime_type: z.string().min(3),
  content_base64: z.string().optional(),
  source_url: z.string().url().optional()
});

router.post('/upload', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = uploadSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  if (!parsed.data.content_base64 && !parsed.data.source_url) {
    return res.status(400).json({ ok: false, message: 'Provide content_base64 or source_url' });
  }
  const media = await saveUploadedMedia({
    siteId,
    filename: parsed.data.filename,
    mimeType: parsed.data.mime_type,
    contentBase64: parsed.data.content_base64,
    sourceUrl: parsed.data.source_url
  });
  return res.status(201).json({ ok: true, data: media });
});

router.get('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const items = await listMedia(siteId);
  return res.json({ ok: true, data: items });
});

router.delete('/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const ok = await deleteMedia(siteId, req.params.id);
  if (!ok) return res.status(404).json({ ok: false, message: 'Media not found' });
  return res.json({ ok: true });
});

export default router;
