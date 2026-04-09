import { Router } from 'express';
import { injectSiteScope } from '../middleware/siteScope';
import { notImplemented } from '../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/google', notImplemented);
router.get('/meta', notImplemented);
router.get('/recommendations', notImplemented);
router.post('/utms', notImplemented);
router.get('/utms', notImplemented);

export default router;
