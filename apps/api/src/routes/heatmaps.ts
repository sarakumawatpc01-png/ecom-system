import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId } from '../utils/request';
import { executeAiProvider } from '../services/ai/providerExecutor';
import { decryptText } from '../utils/crypto';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const eventSchema = z.object({
  session_id: z.string().min(2),
  event_type: z.string().min(2),
  page_url: z.string().min(1),
  device: z.enum(['desktop', 'mobile', 'tablet']).optional(),
  browser: z.string().min(2).optional(),
  traffic_source: z.string().min(2).optional(),
  duration_sec: z.number().int().min(0).max(86_400).optional(),
  rage_click: z.boolean().optional(),
  css_selector: z.string().optional(),
  payload: z.record(z.unknown()).optional()
});

const toDate = (value: unknown) => {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const cryptoSecret = process.env.AI_CONFIG_ENCRYPTION_SECRET || process.env.JWT_SECRET || 'dev-encryption-secret';
const decryptApiKey = (cipher?: string | null) => (cipher ? decryptText(cipher, cryptoSecret) : null);

const generateInsightSummary = async (
  siteId: string,
  metrics: { pageViews: number; addToCart: number; checkoutStarts: number; purchases: number; rageClicks: number }
) => {
  const baseSummary =
    `Traffic overview: ${metrics.pageViews} views, ${metrics.addToCart} add-to-cart, ` +
    `${metrics.checkoutStarts} checkout starts, ${metrics.purchases} purchases, ${metrics.rageClicks} rage-click signals.`;
  const config = await db.ai_model_config.findFirst({
    where: { site_id: siteId, task_type: 'copywriting', is_active: true },
    orderBy: { priority: 'asc' }
  });
  if (!config) return `${baseSummary} Focus first on pages with high rage clicks and low cart progression.`;
  const apiKey = decryptApiKey(config.api_key_encrypted);
  if (!apiKey) return `${baseSummary} AI summary unavailable: missing provider key decryption.`;
  try {
    const output = await executeAiProvider({
      provider: config.provider,
      model: config.model,
      apiKey,
      taskType: 'copywriting',
      prompt:
        `You are a conversion analyst. Produce a concise plain-English insight from these heatmap metrics:\n` +
        JSON.stringify(metrics),
      settings: (config.settings as Record<string, unknown>) || {}
    });
    return output.text || baseSummary;
  } catch {
    return `${baseSummary} AI summary unavailable; review high-drop-off pages and rage-click clusters.`;
  }
};

router.get('/pages', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const from = toDate(req.query.from);
  const to = toDate(req.query.to);
  const device = req.query.device ? String(req.query.device) : null;
  const grouped = await db.heatmap_events.groupBy({
    by: ['page_url'],
    where: {
      site_id: siteId,
      ...(from || to ? { created_at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    },
    _count: { _all: true }
  });
  if (!device || device === 'all') return res.json({ ok: true, data: grouped });
  const enriched = await Promise.all(
    grouped.map(async (row: any) => {
      const events = await db.heatmap_events.findMany({ where: { site_id: siteId, page_url: row.page_url }, take: 2500 });
      const count = events.filter((item: any) => {
        const payload = (item.payload || {}) as Record<string, unknown>;
        return payload.device === device;
      }).length;
      return { page_url: row.page_url, _count: { _all: count } };
    })
  );
  return res.json({ ok: true, data: enriched });
});

router.get('/sessions', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const from = toDate(req.query.from);
  const to = toDate(req.query.to);
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const rows = await db.heatmap_events.findMany({
    where: {
      site_id: siteId,
      ...(from || to ? { created_at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    },
    orderBy: { created_at: 'desc' },
    take: 5000
  });
  const sessionMap = new Map<string, (typeof rows)>();
  rows.forEach((event: any) => {
    const current = sessionMap.get(event.session_id) || [];
    current.push(event);
    sessionMap.set(event.session_id, current);
  });
  const sessions = Array.from(sessionMap.entries()).map(([sessionId, events]) => {
    const payloads = events.map((event: any) => ((event.payload || {}) as Record<string, unknown>));
    const hasPurchase = events.some((event: any) => ['purchase', 'order_complete', 'ab_purchase'].includes(event.event_type));
    const pageViews = events.filter((event: any) => event.event_type === 'page_view').length;
    const durationSec = payloads.reduce((acc: number, payload: any) => acc + (Number(payload.duration_sec || 0) || 0), 0);
    const rageClicks = payloads.filter((payload: any) => Boolean(payload.rage_click)).length;
    return {
      session_id: sessionId,
      events: events.length,
      page_views: pageViews,
      converted: hasPurchase,
      bounced: !hasPurchase && pageViews <= 1,
      duration_sec: durationSec,
      rage_clicks: rageClicks,
      device: String(payloads.find((payload: any) => payload.device)?.device || ''),
      browser: String(payloads.find((payload: any) => payload.browser)?.browser || ''),
      traffic_source: String(payloads.find((payload: any) => payload.traffic_source)?.traffic_source || ''),
      started_at: events[events.length - 1]?.created_at,
      ended_at: events[0]?.created_at
    };
  });
  const filtered = sessions.filter((session) => {
    if (req.query.converted && String(req.query.converted) === 'true' && !session.converted) return false;
    if (req.query.bounced && String(req.query.bounced) === 'true' && !session.bounced) return false;
    if (req.query.device && String(req.query.device) !== 'all' && session.device !== String(req.query.device)) return false;
    if (req.query.browser && session.browser !== String(req.query.browser)) return false;
    if (req.query.traffic_source && session.traffic_source !== String(req.query.traffic_source)) return false;
    if (req.query.min_duration && session.duration_sec < Number(req.query.min_duration)) return false;
    if (req.query.rage_clicks && String(req.query.rage_clicks) === 'true' && session.rage_clicks === 0) return false;
    return true;
  });
  return res.json({ ok: true, data: filtered.slice(0, limit) });
});

router.get('/funnels', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const [views, carts, checkouts, purchases] = await Promise.all([
    db.heatmap_events.count({ where: { site_id: siteId, event_type: 'page_view' } }),
    db.heatmap_events.count({ where: { site_id: siteId, event_type: 'add_to_cart' } }),
    db.heatmap_events.count({ where: { site_id: siteId, event_type: 'checkout_start' } }),
    db.orders.count({ where: { site_id: siteId } })
  ]);
  return res.json({ ok: true, data: { views, carts, checkouts, purchases } });
});

router.post('/events', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = eventSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const data = parsed.data;
  const event = await db.heatmap_events.create({
    data: {
      site_id: siteId,
      session_id: data.session_id,
      event_type: data.event_type,
      page_url: data.page_url,
      payload: {
        ...(data.payload || {}),
        device: data.device || null,
        browser: data.browser || null,
        traffic_source: data.traffic_source || null,
        duration_sec: data.duration_sec || 0,
        rage_click: Boolean(data.rage_click),
        css_selector: data.css_selector || null
      }
    }
  });
  return res.status(201).json({ ok: true, data: event });
});

router.get('/alerts', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const [pages, purchases] = await Promise.all([
    db.heatmap_events.groupBy({ by: ['page_url'], where: { site_id: siteId, event_type: 'page_view' }, _count: { _all: true } }),
    db.orders.count({ where: { site_id: siteId } })
  ]);
  const highExit = pages.filter((item: (typeof pages)[number]) => item._count._all > 100).slice(0, 5);
  return res.json({
    ok: true,
    data: [
      ...highExit.map((item: (typeof highExit)[number]) => ({
        type: 'traffic',
        page_url: item.page_url,
        level: 'warning',
        count: item._count._all
      })),
      ...(purchases === 0 ? [{ type: 'sales', level: 'critical', message: 'No purchases recorded yet.' }] : [])
    ]
  });
});

router.get('/insights/ai', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const [pageViews, addToCart, checkoutStarts, purchases, rageEvents] = await Promise.all([
    db.heatmap_events.count({ where: { site_id: siteId, event_type: 'page_view' } }),
    db.heatmap_events.count({ where: { site_id: siteId, event_type: 'add_to_cart' } }),
    db.heatmap_events.count({ where: { site_id: siteId, event_type: 'checkout_start' } }),
    db.orders.count({ where: { site_id: siteId } }),
    db.heatmap_events.findMany({ where: { site_id: siteId }, take: 5000, orderBy: { created_at: 'desc' } })
  ]);
  const rageClicks = rageEvents.filter((event: any) => {
    const payload = (event.payload || {}) as Record<string, unknown>;
    return Boolean(payload.rage_click);
  }).length;
  const summary = await generateInsightSummary(siteId, { pageViews, addToCart, checkoutStarts, purchases, rageClicks });
  return res.json({ ok: true, data: { summary, metrics: { pageViews, addToCart, checkoutStarts, purchases, rageClicks } } });
});

router.get('/:pageUrl', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const pageUrl = decodeURIComponent(req.params.pageUrl);
  const events = await db.heatmap_events.findMany({
    where: { site_id: siteId, page_url: pageUrl },
    orderBy: { created_at: 'desc' },
    take: 1000
  });
  return res.json({ ok: true, data: events });
});

export default router;
