import { Router } from 'express';
import { injectSiteScope } from '../../middleware/siteScope';
import { notImplemented } from '../../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.post('/url', notImplemented);
router.post('/bulk', notImplemented);
router.get('/logs', notImplemented);
router.get('/logs/:id', notImplemented);

export default router;
