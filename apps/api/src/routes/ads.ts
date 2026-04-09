import { Router } from 'express';
import { z } from 'zod';
import { db } from '../lib/db';
import { injectSiteScope } from '../middleware/siteScope';
import { getSiteId } from '../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);

const asNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toDate = (value: unknown) => {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const utmSchema = z.object({
  campaign_name: z.string().min(2),
  source: z.string().min(2),
  medium: z.string().min(2),
  campaign: z.string().min(2),
  content: z.string().optional(),
  term: z.string().optional(),
  base_url: z.string().url()
});

const buildUtmUrl = (input: z.infer<typeof utmSchema>) => {
  const url = new URL(input.base_url);
  url.searchParams.set('utm_source', input.source);
  url.searchParams.set('utm_medium', input.medium);
  url.searchParams.set('utm_campaign', input.campaign);
  if (input.content) url.searchParams.set('utm_content', input.content);
  if (input.term) url.searchParams.set('utm_term', input.term);
  return url.toString();
};

router.get('/google', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const orders = await db.orders.findMany({ where: { site_id: siteId, payment_status: 'paid' }, take: 2000 });
  const attributedOrders = orders.filter((order: any) => {
    const meta = (order.meta || {}) as Record<string, unknown>;
    const utmSource = String(meta.utm_source || '');
    return utmSource.includes('google');
  });
  const revenue = attributedOrders.reduce((acc: number, order: any) => acc + asNumber(order.total), 0);
  return res.json({ ok: true, data: { platform: 'google', attributed_orders: attributedOrders.length, revenue, status: 'connected' } });
});

router.get('/meta', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const orders = await db.orders.findMany({ where: { site_id: siteId, payment_status: 'paid' }, take: 2000 });
  const attributedOrders = orders.filter((order: any) => {
    const meta = (order.meta || {}) as Record<string, unknown>;
    const utmSource = String(meta.utm_source || '');
    return utmSource.includes('meta') || utmSource.includes('facebook') || utmSource.includes('instagram');
  });
  const revenue = attributedOrders.reduce((acc: number, order: any) => acc + asNumber(order.total), 0);
  return res.json({ ok: true, data: { platform: 'meta', attributed_orders: attributedOrders.length, revenue, status: 'connected' } });
});

router.get('/performance', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const from = toDate(req.query.from) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toDate(req.query.to) || new Date();
  const [site, orders, spendEvents] = await Promise.all([
    db.sites.findUnique({ where: { id: siteId } }),
    db.orders.findMany({ where: { site_id: siteId, payment_status: 'paid', created_at: { gte: from, lte: to } }, take: 5000 }),
    db.heatmap_events.findMany({
      where: { site_id: siteId, event_type: 'ad_spend', created_at: { gte: from, lte: to } },
      take: 5000
    })
  ]);
  let googleSpend = 0;
  let metaSpend = 0;
  spendEvents.forEach((event: any) => {
    const payload = (event.payload || {}) as Record<string, unknown>;
    const amount = asNumber(payload.amount);
    const platform = String(payload.platform || '');
    if (platform === 'google') googleSpend += amount;
    if (platform === 'meta') metaSpend += amount;
  });
  const totalSpend = googleSpend + metaSpend;
  const revenue = orders.reduce((acc: number, order: any) => acc + asNumber(order.total), 0);
  const roas = totalSpend > 0 ? revenue / totalSpend : 0;
  const cpa = orders.length > 0 ? totalSpend / orders.length : 0;
  const budgetConfig = ((site?.config || {}) as Record<string, unknown>).ad_budgets as Record<string, unknown> | undefined;
  const monthlyBudget = asNumber(budgetConfig?.monthly_total);
  const budgetUtilization = monthlyBudget > 0 ? Math.min(100, (totalSpend / monthlyBudget) * 100) : 0;
  return res.json({
    ok: true,
    data: {
      cards: {
        total_spend: totalSpend,
        ad_revenue: revenue,
        blended_roas: Number(roas.toFixed(2)),
        cpa: Number(cpa.toFixed(2))
      },
      site_breakdown: [
        {
          site_id: siteId,
          site_name: site?.name || 'Unknown site',
          google_spend: googleSpend,
          meta_spend: metaSpend,
          total_spend: totalSpend,
          ad_attributed_revenue: revenue,
          roas: Number(roas.toFixed(2)),
          cpa: Number(cpa.toFixed(2)),
          top_performing_campaign: 'n/a',
          budget_utilization_pct: Number(budgetUtilization.toFixed(2))
        }
      ]
    }
  });
});

router.get('/recommendations', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const sourceSummary = await db.orders.findMany({ where: { site_id: siteId, payment_status: 'paid' }, take: 2000 });
  const paidRevenue = sourceSummary.reduce((acc: number, order: any) => acc + asNumber(order.total), 0);
  return res.json({
    ok: true,
    data: [
      {
        type: 'budget',
        level: 'medium',
        expected_impact: 'Improve ROAS by reducing waste',
        confidence: 0.72,
        message: 'Pause low-performing campaigns with ROAS < 1.5 and reallocate budget to top SKU cohorts.'
      },
      {
        type: 'creative',
        level: 'high',
        expected_impact: 'Increase CTR',
        confidence: 0.68,
        message: `Current paid revenue snapshot is ₹${paidRevenue.toFixed(2)}. Refresh top ads every 14 days to avoid fatigue.`
      }
    ]
  });
});

router.post('/utms', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const parsed = utmSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid payload', issues: parsed.error.issues });
  const url = buildUtmUrl(parsed.data);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  const saved = await db.heatmap_events.create({
    data: {
      site_id: siteId,
      session_id: 'utm-library',
      event_type: 'utm_saved',
      page_url: url,
      payload: {
        ...parsed.data,
        generated_url: url,
        qr_url: qrUrl
      }
    }
  });
  return res.status(201).json({ ok: true, data: { id: saved.id, ...parsed.data, generated_url: url, qr_url: qrUrl } });
});

router.get('/utms', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const from = toDate(req.query.from);
  const to = toDate(req.query.to);
  const rows = await db.heatmap_events.findMany({
    where: {
      site_id: siteId,
      event_type: 'utm_saved',
      ...(from || to ? { created_at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    },
    orderBy: { created_at: 'desc' },
    take: 500
  });
  const data = rows
    .map((row: any) => ({ id: row.id, created_at: row.created_at, ...(row.payload as Record<string, unknown>) }))
    .filter((row: any) => {
      if (req.query.source && row.source !== String(req.query.source)) return false;
      if (req.query.medium && row.medium !== String(req.query.medium)) return false;
      if (req.query.campaign && row.campaign !== String(req.query.campaign)) return false;
      return true;
    });
  return res.json({ ok: true, data });
});

router.get('/budget-tracker', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const site = await db.sites.findUnique({ where: { id: siteId } });
  const config = (site?.config || {}) as Record<string, unknown>;
  const budgets = (config.ad_budgets || {}) as Record<string, unknown>;
  const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const spendEvents = await db.heatmap_events.findMany({
    where: { site_id: siteId, event_type: 'ad_spend', created_at: { gte: from } },
    take: 5000
  });
  let googleSpend = 0;
  let metaSpend = 0;
  spendEvents.forEach((event: any) => {
    const payload = (event.payload || {}) as Record<string, unknown>;
    const amount = asNumber(payload.amount);
    if (payload.platform === 'google') googleSpend += amount;
    if (payload.platform === 'meta') metaSpend += amount;
  });
  const googleBudget = asNumber(budgets.google);
  const metaBudget = asNumber(budgets.meta);
  const forecastDays = (spend: number, budget: number) => {
    if (spend <= 0 || budget <= 0) return null;
    const daysElapsed = Math.max(1, new Date().getDate());
    const dailyBurn = spend / daysElapsed;
    const remaining = Math.max(0, budget - spend);
    return dailyBurn > 0 ? Math.ceil(remaining / dailyBurn) : null;
  };
  return res.json({
    ok: true,
    data: {
      google: {
        budget: googleBudget,
        spent: googleSpend,
        utilization_pct: googleBudget > 0 ? Number(((googleSpend / googleBudget) * 100).toFixed(2)) : 0,
        forecast_days_to_exhaustion: forecastDays(googleSpend, googleBudget)
      },
      meta: {
        budget: metaBudget,
        spent: metaSpend,
        utilization_pct: metaBudget > 0 ? Number(((metaSpend / metaBudget) * 100).toFixed(2)) : 0,
        forecast_days_to_exhaustion: forecastDays(metaSpend, metaBudget)
      }
    }
  });
});

router.get('/attribution', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const from = toDate(req.query.from) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toDate(req.query.to) || new Date();
  const orders = await db.orders.findMany({
    where: { site_id: siteId, payment_status: 'paid', created_at: { gte: from, lte: to } },
    take: 5000
  });
  const breakdown: Record<string, { orders: number; revenue: number }> = {};
  orders.forEach((order: any) => {
    const meta = (order.meta || {}) as Record<string, unknown>;
    const source = String(meta.utm_source || meta.source || 'direct');
    const current = breakdown[source] || { orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += asNumber(order.total);
    breakdown[source] = current;
  });
  return res.json({ ok: true, data: breakdown });
});

export default router;
