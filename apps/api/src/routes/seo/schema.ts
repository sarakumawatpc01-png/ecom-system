import { Router } from 'express';
import { injectSiteScope } from '../../middleware/siteScope';
import { notImplemented } from '../../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/schema/:pageType/:id', notImplemented);
router.put('/schema/:pageType/:id', notImplemented);
router.post('/sitemap/regenerate', notImplemented);
router.get('/meta/:pageType/:id', notImplemented);
router.put('/meta/:pageType/:id', notImplemented);

export default router;
