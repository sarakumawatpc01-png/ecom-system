import { Router } from 'express';
import { mkdir, readdir, readFile, stat, writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { db } from '../lib/db';
import { requireRole } from '../middleware/auth';

const router = Router();
router.use(requireRole('super_admin'));

const backupDir = process.env.BACKUP_DIR || '/tmp/ecom-backups';
const logsDir = process.env.APP_LOG_DIR || '/tmp/ecom-logs';

router.get('/sites/status', async (_req, res) => {
  const sites = await db.sites.findMany({
    where: { is_deleted: false },
    select: { id: true, name: true, slug: true, status: true, nginx_port: true, pm2_process_name: true }
  });
  return res.json({ ok: true, data: sites });
});

router.post('/sites/:id/restart', async (req, res) => {
  const site = await db.sites.findUnique({ where: { id: req.params.id } });
  if (!site) return res.status(404).json({ ok: false, message: 'Site not found' });
  return res.json({ ok: true, data: { site_id: site.id, action: 'restart', triggered_at: new Date().toISOString() } });
});

router.post('/sites/:id/rebuild', async (req, res) => {
  const site = await db.sites.findUnique({ where: { id: req.params.id } });
  if (!site) return res.status(404).json({ ok: false, message: 'Site not found' });
  return res.json({ ok: true, data: { site_id: site.id, action: 'rebuild', triggered_at: new Date().toISOString() } });
});

router.get('/server/metrics', async (_req, res) => {
  const [sites, orders, products] = await Promise.all([db.sites.count(), db.orders.count(), db.products.count()]);
  return res.json({
    ok: true,
    data: {
      uptime_seconds: Math.floor(process.uptime()),
      loadavg: os.loadavg(),
      memory: process.memoryUsage(),
      host: os.hostname(),
      records: { sites, orders, products }
    }
  });
});

router.get('/backups', async (_req, res) => {
  await mkdir(backupDir, { recursive: true });
  const files = await readdir(backupDir);
  const backups: Array<{ file: string; size: number; modified: string }> = [];
  for (const file of files) {
    const fullPath = path.join(backupDir, file);
    const fileStat = await stat(fullPath).catch(() => null);
    if (!fileStat || !fileStat.isFile()) continue;
    backups.push({ file, size: fileStat.size, modified: fileStat.mtime.toISOString() });
  }
  backups.sort((a, b) => (a.modified < b.modified ? 1 : -1));
  return res.json({ ok: true, data: backups });
});

router.post('/backups/trigger', async (_req, res) => {
  await mkdir(backupDir, { recursive: true });
  const [sites, products, orders, customers] = await Promise.all([
    db.sites.count(),
    db.products.count(),
    db.orders.count(),
    db.customers.count()
  ]);
  const backupName = `backup-${Date.now()}.json`;
  const payload = {
    created_at: new Date().toISOString(),
    counts: { sites, products, orders, customers }
  };
  await writeFile(path.join(backupDir, backupName), JSON.stringify(payload, null, 2), 'utf8');
  return res.status(201).json({ ok: true, data: { backup_file: backupName } });
});

router.get('/logs/:appName', async (req, res) => {
  await mkdir(logsDir, { recursive: true });
  const appName = req.params.appName.replace(/[^a-zA-Z0-9-_]/g, '');
  if (!appName) return res.status(400).json({ ok: false, message: 'Invalid appName' });
  const logPath = path.join(logsDir, `${appName}.log`);
  const content = await readFile(logPath, 'utf8').catch(() => '');
  const lines = content.split('\n').filter(Boolean);
  return res.json({ ok: true, data: { app: appName, lines: lines.slice(-500) } });
});

export default router;
