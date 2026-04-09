import { Router } from 'express';
import { injectSiteScope } from '../../middleware/siteScope';
import { notImplemented } from '../../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/jobs', notImplemented);
router.get('/jobs/:id', notImplemented);
router.post('/jobs/:id/approve', notImplemented);
router.post('/jobs/:id/reject', notImplemented);
router.post('/rewrite/product/:id', notImplemented);
router.post('/rewrite/batch', notImplemented);

export default router;
