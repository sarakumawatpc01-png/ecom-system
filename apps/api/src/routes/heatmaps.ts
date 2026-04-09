import { Router } from 'express';
import { injectSiteScope } from '../middleware/siteScope';
import { notImplemented } from '../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/pages', notImplemented);
router.get('/sessions', notImplemented);
router.get('/funnels', notImplemented);
router.get('/alerts', notImplemented);
router.get('/:pageUrl', notImplemented);

export default router;
