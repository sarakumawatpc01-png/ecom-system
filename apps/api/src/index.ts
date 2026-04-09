import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import sitesRoutes from './routes/sites';
import productsRoutes from './routes/products';
import categoriesRoutes from './routes/categories';
import ordersRoutes from './routes/orders';
import customersRoutes from './routes/customers';
import reviewsRoutes from './routes/reviews';
import blogRoutes from './routes/blog';
import mediaRoutes from './routes/media';
import meeshoRoutes from './routes/import/meesho';
import aiConfigRoutes from './routes/ai/config';
import aiJobsRoutes from './routes/ai/jobs';
import aiImageRoutes from './routes/ai/image';
import aiVideoRoutes from './routes/ai/video';
import aiCopyRoutes from './routes/ai/copywriting';
import seoAuditRoutes from './routes/seo/audit';
import seoAgentRoutes from './routes/seo/agent';
import seoSchemaRoutes from './routes/seo/schema';
import seoGscRoutes from './routes/seo/gsc';
import analyticsRoutes from './routes/analytics';
import adsRoutes from './routes/ads';
import landingPageRoutes from './routes/landingPages';
import abTestsRoutes from './routes/abTests';
import redirectsRoutes from './routes/redirects';
import heatmapsRoutes from './routes/heatmaps';
import notificationsRoutes from './routes/notifications';
import feedRoutes from './routes/feed/googleMerchant';
import infraRoutes from './routes/infra';
import { db } from './lib/db';
import { authenticate } from './middleware/auth';
import { apiRateLimit } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { runStartupAudit } from './services/startupAudit';

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(apiRateLimit);
const authRateLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false });
const protectedRateLimit = rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false });

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'api', time: new Date().toISOString() }));
app.get('/api/health/startup', async (_req, res) => {
  const audit = await runStartupAudit();
  return res.status(audit.ok ? 200 : 503).json({
    ...audit,
    service: 'api',
    mode: 'strict-startup-audit',
    time: new Date().toISOString()
  });
});

app.use('/auth', authRateLimit, authRoutes);

app.use('/api', protectedRateLimit, authenticate);
app.use('/api/sites', sitesRoutes);
app.use('/api/ai/config', aiConfigRoutes);
app.get('/api/analytics/overview', async (_req, res) => {
  const [sites, products, orders, customers] = await Promise.all([
    db.sites.count({ where: { is_deleted: false } }),
    db.products.count({ where: { is_deleted: false } }),
    db.orders.count(),
    db.customers.count()
  ]);
  return res.json({ ok: true, data: { sites, products, orders, customers } });
});
app.get('/api/ads/overview', async (_req, res) => {
  const paidOrders = await db.orders.count({ where: { payment_status: 'paid' } });
  return res.json({
    ok: true,
    data: { active_platforms: ['google', 'meta'], paid_orders: paidOrders, recommendations_ready: true }
  });
});
app.use('/api/infra', infraRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use('/api/:siteId/products', productsRoutes);
app.use('/api/:siteId/categories', categoriesRoutes);
app.use('/api/:siteId/orders', ordersRoutes);
app.use('/api/:siteId/customers', customersRoutes);
app.use('/api/:siteId/reviews', reviewsRoutes);
app.use('/api/:siteId/blog', blogRoutes);
app.use('/api/:siteId/media', mediaRoutes);
app.use('/api/:siteId/analytics', analyticsRoutes);
app.use('/api/:siteId/ads', adsRoutes);
app.use('/api/:siteId/import/meesho', meeshoRoutes);
app.use('/api/:siteId/ai', aiJobsRoutes);
app.use('/api/:siteId/ai/image', aiImageRoutes);
app.use('/api/:siteId/ai/video', aiVideoRoutes);
app.use('/api/:siteId/ai/rewrite', aiCopyRoutes);
app.use('/api/:siteId/seo', seoAuditRoutes);
app.use('/api/:siteId/seo', seoAgentRoutes);
app.use('/api/:siteId/seo', seoSchemaRoutes);
app.use('/api/:siteId/seo', seoGscRoutes);
app.use('/api/:siteId/landing-pages', landingPageRoutes);
app.use('/api/:siteId/ab-tests', abTestsRoutes);
app.use('/api/:siteId/redirects', redirectsRoutes);
app.use('/api/:siteId/heatmaps', heatmapsRoutes);
app.use('/api/:siteId/feed', feedRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
