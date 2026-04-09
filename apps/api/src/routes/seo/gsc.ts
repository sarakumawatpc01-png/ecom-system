import { Router } from 'express';
import { injectSiteScope } from '../../middleware/siteScope';
import { getGscSnapshot, syncGscForSite } from '../../services/monitoring/gsc';
import { getSiteId } from '../../utils/request';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/gsc/performance', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const snapshot = await getGscSnapshot(siteId);
  return res.json({
    ok: true,
    data: {
      property_url: snapshot.property_url,
      clicks: snapshot.clicks,
      impressions: snapshot.impressions,
      ctr: snapshot.ctr,
      average_position: snapshot.average_position
    }
  });
});
router.get('/gsc/keywords', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const snapshot = await getGscSnapshot(siteId);
  return res.json({ ok: true, data: snapshot.top_keywords });
});

router.get('/gsc/alerts', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const snapshot = await getGscSnapshot(siteId);
  return res.json({ ok: true, data: snapshot.alerts });
});

router.post('/gsc/sync', async (req, res) => {
  const siteId = getSiteId(req);
  if (!siteId) return res.status(400).json({ ok: false, message: 'Missing site scope' });
  const result = await syncGscForSite(siteId);
  return res.status(201).json({ ok: true, data: result });
});

export default router;
