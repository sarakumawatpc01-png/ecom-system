import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const testSchema = z.object({
  landing_page_id: z.string().uuid(),
  name: z.string().min(2),
  traffic_split: z.record(z.number()).optional(),
  variants: z.array(
    z.object({
      name: z.string().min(1),
      blocks: z.record(z.unknown()),
      is_control: z.boolean().optional()
    })
  )
});

router.post('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = testSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const test = await db.ab_tests.create({
    data: {
      site_id: siteId,
      landing_page_id: parsed.data.landing_page_id,
      name: parsed.data.name,
      status: 'draft',
      traffic_split: parsed.data.traffic_split || {},
      variants: {
        create: parsed.data.variants.map((variant) => ({
          name: variant.name,
          blocks: variant.blocks,
          is_control: Boolean(variant.is_control)
        }))
      }
    },
    include: { variants: true }
  });
  return res.status(201).json({ ok: true, data: test });
});

router.put('/:id/start', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.ab_tests.updateMany({
    where: { site_id: siteId, id: req.params.id },
    data: { status: 'running', started_at: new Date(), completed_at: null }
  });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Test not found' });
  return res.json({ ok: true });
});

router.put('/:id/pause', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.ab_tests.updateMany({ where: { site_id: siteId, id: req.params.id }, data: { status: 'paused' } });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Test not found' });
  return res.json({ ok: true });
});

router.put('/:id/complete', async (req, res) => {
  const siteId = getSiteId(req);
  const winnerVariantId = req.body?.winner_variant_id ? String(req.body.winner_variant_id) : null;
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.ab_tests.updateMany({
    where: { site_id: siteId, id: req.params.id },
    data: { status: 'completed', completed_at: new Date(), winner_variant_id: winnerVariantId }
  });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Test not found' });
  return res.json({ ok: true });
});

router.get('/:id/results', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const test = await db.ab_tests.findFirst({ where: { site_id: siteId, id: req.params.id }, include: { variants: true } });
  if (!test) return res.status(404).json({ ok: false, message: 'Test not found' });
  const events = await db.heatmap_events.findMany({ where: { site_id: siteId, event_type: { startsWith: 'ab_' } }, take: 5000 });
  const filtered = events.filter((item: (typeof events)[number]) => {
    const payload = item.payload as Record<string, unknown>;
    return payload && payload.ab_test_id === test.id;
  });
  const summary = filtered.reduce((acc: Record<string, number>, event: (typeof filtered)[number]) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {});
  return res.json({ ok: true, data: { test, summary } });
});

router.post('/:id/track', async (req, res) => {
  const siteId = getSiteId(req);
  const variantId = String(req.body?.variant_id || '');
  const eventType = String(req.body?.event_type || 'view');
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  if (!variantId) return res.status(400).json({ ok: false, message: 'variant_id is required' });
  const test = await db.ab_tests.findFirst({ where: { site_id: siteId, id: req.params.id } });
  if (!test) return res.status(404).json({ ok: false, message: 'Test not found' });
  const event = await db.heatmap_events.create({
    data: {
      site_id: siteId,
      session_id: req.body?.session_id ? String(req.body.session_id) : `ab-${Date.now()}`,
      event_type: `ab_${eventType}`,
      page_url: String(req.body?.page_url || '/'),
      payload: { ab_test_id: test.id, variant_id: variantId }
    }
  });
  return res.status(201).json({ ok: true, data: event });
});

export default router;
