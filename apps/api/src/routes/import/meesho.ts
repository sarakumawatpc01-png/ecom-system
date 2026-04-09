import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../lib/db';
import { injectSiteScope } from '../../middleware/siteScope';
import { scrapeMeesho } from '../../services/meeshoScraper';
import { getSiteId, toPagination } from '../../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const urlSchema = z.object({
  source_url: z.string().url(),
  auto_publish: z.boolean().optional()
});

router.post('/url', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = urlSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const log = await db.meesho_import_log.create({
    data: {
      site_id: siteId,
      source_url: parsed.data.source_url,
      status: 'processing',
      started_at: new Date()
    }
  });
  try {
    const result = await scrapeMeesho(parsed.data.source_url);
    const imported = Array.isArray(result.products) ? result.products.length : 0;
    await db.meesho_import_log.update({
      where: { id: log.id },
        data: {
          status: 'done',
          products_found: imported,
          products_imported: imported,
        completed_at: new Date()
      }
    });
    return res.status(201).json({ ok: true, data: { log_id: log.id, imported } });
  } catch (error) {
    await db.meesho_import_log.update({
      where: { id: log.id },
      data: { status: 'failed', error_message: error instanceof Error ? error.message : 'Import failed', completed_at: new Date() }
    });
    return res.status(500).json({ ok: false, message: 'Import failed' });
  }
});

router.post('/bulk', async (req, res) => {
  const siteId = getSiteId(req);
  const urls = Array.isArray(req.body?.urls) ? req.body.urls.map((url: unknown) => String(url)) : [];
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  if (urls.length === 0) return res.status(400).json({ ok: false, message: 'urls is required' });
  const queued: string[] = [];
  for (const url of urls) {
    const parsed = urlSchema.safeParse({ source_url: url });
    if (!parsed.success) continue;
    const log = await db.meesho_import_log.create({
      data: {
        site_id: siteId,
        source_url: parsed.data.source_url,
        status: 'queued'
      }
    });
    queued.push(log.id);
  }
  return res.status(201).json({ ok: true, data: { queued } });
});

router.get('/logs', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const { skip, limit } = toPagination(req);
  const [items, total] = await Promise.all([
    db.meesho_import_log.findMany({ where: { site_id: siteId }, orderBy: { created_at: 'desc' }, skip, take: limit }),
    db.meesho_import_log.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { items, total } });
});

router.get('/logs/:id', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const item = await db.meesho_import_log.findFirst({ where: { site_id: siteId, id: req.params.id } });
  if (!item) return res.status(404).json({ ok: false, message: 'Log not found' });
  return res.json({ ok: true, data: item });
});

export default router;
