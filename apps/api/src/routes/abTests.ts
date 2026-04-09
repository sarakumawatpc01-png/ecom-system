import { Router } from 'express';
import { injectSiteScope } from '../middleware/siteScope';
import { notImplemented } from '../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.post('/', notImplemented);
router.put('/:id/start', notImplemented);
router.put('/:id/pause', notImplemented);
router.put('/:id/complete', notImplemented);
router.get('/:id/results', notImplemented);
router.post('/:id/track', notImplemented);

export default router;
