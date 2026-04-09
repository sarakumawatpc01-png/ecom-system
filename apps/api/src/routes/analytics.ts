import { Router } from 'express';
import { injectSiteScope } from '../middleware/siteScope';
import { notImplemented } from '../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/overview', notImplemented);
router.get('/vitals', notImplemented);
router.get('/funnel', notImplemented);

export default router;
