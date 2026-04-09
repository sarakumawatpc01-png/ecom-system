import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { requireRole } from '../middleware/auth';
import { getSiteId } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const successMetricValues = ['purchase', 'add_to_cart', 'form_submit', 'scroll_50', 'scroll_80'] as const;

const confidenceBand = (value: number) => {
  if (value >= 95) return 'green';
  if (value >= 80) return 'yellow';
  return 'gray';
};

const asNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const computeTwoVariantConfidence = (
  first: { visitors: number; conversions: number },
  second: { visitors: number; conversions: number }
) => {
  if (first.visitors < 10 || second.visitors < 10) return 0;
  const p1 = first.conversions / Math.max(1, first.visitors);
  const p2 = second.conversions / Math.max(1, second.visitors);
  const p = (first.conversions + second.conversions) / Math.max(1, first.visitors + second.visitors);
  const se = Math.sqrt(p * (1 - p) * (1 / Math.max(1, first.visitors) + 1 / Math.max(1, second.visitors)));
  if (se === 0) return 0;
  const z = Math.abs((p1 - p2) / se);
  const confidence = Math.min(99.9, Math.max(0, 50 + z * 16));
  return Number(confidence.toFixed(2));
};

const testSchema = z.object({
  landing_page_id: z.string().uuid().optional(),
  name: z.string().min(2),
  success_metric: z.enum(successMetricValues).default('purchase'),
  min_sample_size: z.number().int().min(100).max(50_000).default(1000),
  ad_sources: z
    .object({
      google_campaign_ids: z.array(z.string().min(1)).optional(),
      meta_campaign_ids: z.array(z.string().min(1)).optional(),
      utm_params: z.record(z.string()).optional()
    })
    .optional(),
  traffic_split: z.record(z.number().int().min(0).max(100)).optional(),
  variants: z.array(
    z.object({
      name: z.string().min(1),
      blocks: z.record(z.unknown()).optional(),
      landing_page_id: z.string().uuid().optional(),
      traffic_pct: z.number().int().min(0).max(100).optional(),
      is_control: z.boolean().optional()
    })
  ).min(2).max(5)
});

router.get('/', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const tests = await db.ab_tests.findMany({
    where: { site_id: siteId },
    include: { variants: true },
    orderBy: { created_at: 'desc' },
    take: 100
  });
  const data = tests.map((test) => {
    const variants = [...test.variants].sort((a, b) => (b.visitors > a.visitors ? 1 : -1));
    const [first, second] = variants;
    const confidence = first && second ? computeTwoVariantConfidence(first, second) : 0;
    return {
      ...test,
      confidence_pct: confidence,
      confidence_band: confidenceBand(confidence),
      variants: variants.map((variant) => ({
        ...variant,
        conversion_rate: variant.visitors > 0 ? Number(((variant.conversions / variant.visitors) * 100).toFixed(2)) : 0,
        revenue_per_visitor: variant.visitors > 0 ? Number((asNumber(variant.revenue) / variant.visitors).toFixed(2)) : 0
      }))
    };
  });
  return res.json({ ok: true, data });
});

router.post('/', requireRole('super_admin', 'site_admin'), async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = testSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const payload = parsed.data;
  const splitFromVariants = payload.variants.map((variant) => variant.traffic_pct || 0);
  const splitFromRecord = Object.values(payload.traffic_split || {});
  const splitValues = splitFromRecord.length > 0 ? splitFromRecord : splitFromVariants;
  const splitTotal = splitValues.reduce((acc, value) => acc + value, 0);
  if (splitValues.length > 0 && splitTotal !== 100) {
    return res.status(400).json({ ok: false, message: 'Traffic split must sum to 100%' });
  }
  const normalizedSplit =
    splitFromRecord.length > 0
      ? payload.traffic_split || {}
      : payload.variants.reduce<Record<string, number>>((acc, variant, index) => {
          acc[variant.name] = variant.traffic_pct || Math.floor(100 / payload.variants.length) || (index === 0 ? 100 : 0);
          return acc;
        }, {});
  const test = await db.ab_tests.create({
    data: {
      site_id: siteId,
      landing_page_id: payload.landing_page_id || null,
      name: payload.name,
      status: 'draft',
      success_metric: payload.success_metric,
      traffic_split: {
        allocation: normalizedSplit,
        min_sample_size: payload.min_sample_size,
        ad_sources: payload.ad_sources || {}
      } as any,
      variants: {
        create: payload.variants.map((variant) => ({
          name: variant.name,
          landing_page_id: variant.landing_page_id || null,
          blocks: (variant.blocks || {}) as any,
          traffic_pct: normalizedSplit[variant.name] || variant.traffic_pct || null,
          is_control: Boolean(variant.is_control)
        }))
      }
    },
    include: { variants: true }
  });
  return res.status(201).json({ ok: true, data: test });
});

router.put('/:id/start', requireRole('super_admin', 'site_admin'), async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.ab_tests.updateMany({
    where: { site_id: siteId, id: req.params.id },
    data: { status: 'running', started_at: new Date(), completed_at: null }
  });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Test not found' });
  return res.json({ ok: true });
});

router.put('/:id/resume', requireRole('super_admin', 'site_admin'), async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.ab_tests.updateMany({ where: { site_id: siteId, id: req.params.id }, data: { status: 'running' } });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Test not found' });
  return res.json({ ok: true });
});

router.put('/:id/pause', requireRole('super_admin', 'site_admin'), async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await db.ab_tests.updateMany({ where: { site_id: siteId, id: req.params.id }, data: { status: 'paused' } });
  if (result.count === 0) return res.status(404).json({ ok: false, message: 'Test not found' });
  return res.json({ ok: true });
});

router.put('/:id/complete', requireRole('super_admin', 'site_admin'), async (req, res) => {
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

router.put('/:id/declare-winner', requireRole('super_admin', 'site_admin'), async (req, res) => {
  const siteId = getSiteId(req);
  const winnerVariantId = req.body?.winner_variant_id ? String(req.body.winner_variant_id) : '';
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  if (!winnerVariantId) return res.status(400).json({ ok: false, message: 'winner_variant_id is required' });
  const test = await db.ab_tests.findFirst({ where: { site_id: siteId, id: req.params.id }, include: { variants: true } });
  if (!test) return res.status(404).json({ ok: false, message: 'Test not found' });
  const winner = test.variants.find((variant) => variant.id === winnerVariantId);
  if (!winner) return res.status(400).json({ ok: false, message: 'winner_variant_id does not belong to this test' });
  const ordered = [...test.variants].sort((a, b) => b.conversions - a.conversions);
  const confidence = ordered.length >= 2 ? computeTwoVariantConfidence(ordered[0], ordered[1]) : 0;
  if (confidence < 95 && req.body?.force !== true) {
    return res
      .status(400)
      .json({ ok: false, message: 'Confidence below 95%. Pass force=true to override.', confidence_pct: confidence });
  }
  await db.ab_tests.update({
    where: { id: test.id },
    data: {
      status: 'completed',
      winner_variant_id: winner.id,
      winner_id: winner.id,
      significance: confidence as any,
      completed_at: new Date(),
      ended_at: new Date()
    }
  });
  if (winner.landing_page_id) {
    await db.landing_pages.updateMany({
      where: { site_id: siteId, id: winner.landing_page_id },
      data: { is_published: true, status: 'active' }
    });
  }
  return res.json({ ok: true, data: { winner_variant_id: winner.id, confidence_pct: confidence, confidence_band: confidenceBand(confidence) } });
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
  const variants = [...test.variants].sort((a, b) => (b.conversions > a.conversions ? 1 : -1));
  const confidence = variants.length >= 2 ? computeTwoVariantConfidence(variants[0], variants[1]) : 0;
  return res.json({
    ok: true,
    data: {
      test,
      summary,
      confidence_pct: confidence,
      confidence_band: confidenceBand(confidence),
      variants: variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        visitors: variant.visitors,
        conversions: variant.conversions,
        conversion_rate: variant.visitors > 0 ? Number(((variant.conversions / variant.visitors) * 100).toFixed(2)) : 0,
        revenue: asNumber(variant.revenue),
        revenue_per_visitor: variant.visitors > 0 ? Number((asNumber(variant.revenue) / variant.visitors).toFixed(2)) : 0
      }))
    }
  });
});

router.post('/:id/track', async (req, res) => {
  const siteId = getSiteId(req);
  const variantId = String(req.body?.variant_id || '');
  const eventType = String(req.body?.event_type || 'view');
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  if (!variantId) return res.status(400).json({ ok: false, message: 'variant_id is required' });
  const test = await db.ab_tests.findFirst({ where: { site_id: siteId, id: req.params.id }, include: { variants: true } });
  if (!test) return res.status(404).json({ ok: false, message: 'Test not found' });
  const variant = test.variants.find((item) => item.id === variantId);
  if (!variant) return res.status(400).json({ ok: false, message: 'variant_id does not belong to test' });
  const normalizedEvent = eventType.trim().toLowerCase();
  const shouldCountVisitor = normalizedEvent === 'view';
  const successMetric = (test.success_metric || 'purchase').trim().toLowerCase();
  const isConversion = normalizedEvent === successMetric;
  const revenue = Number(req.body?.revenue || 0);
  if (shouldCountVisitor || isConversion || revenue > 0) {
    await db.ab_test_variants.update({
      where: { id: variant.id },
      data: {
        visitors: shouldCountVisitor ? { increment: 1 } : undefined,
        conversions: isConversion ? { increment: 1 } : undefined,
        revenue: revenue > 0 ? ({ increment: revenue } as any) : undefined
      }
    });
  }
  const event = await db.heatmap_events.create({
    data: {
      site_id: siteId,
      session_id: req.body?.session_id ? String(req.body.session_id) : `ab-${Date.now()}`,
      event_type: `ab_${eventType}`,
      page_url: String(req.body?.page_url || '/'),
      payload: { ab_test_id: test.id, variant_id: variantId }
    }
  });
  const refreshed = await db.ab_tests.findFirst({ where: { id: test.id }, include: { variants: true } });
  const ordered = [...(refreshed?.variants || [])].sort((a, b) => b.conversions - a.conversions);
  const confidence = ordered.length >= 2 ? computeTwoVariantConfidence(ordered[0], ordered[1]) : 0;
  if (refreshed) {
    await db.ab_tests.update({ where: { id: refreshed.id }, data: { significance: confidence as any } });
  }
  return res.status(201).json({ ok: true, data: { event, confidence_pct: confidence, confidence_band: confidenceBand(confidence) } });
});

export default router;
