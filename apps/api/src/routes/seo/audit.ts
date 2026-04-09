import { Router } from 'express';
import { injectSiteScope } from '../../middleware/siteScope';
import { notImplemented } from '../../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/audit', notImplemented);
router.get('/audit/results', notImplemented);
router.put('/audit/:id/fix', notImplemented);

export default router;
