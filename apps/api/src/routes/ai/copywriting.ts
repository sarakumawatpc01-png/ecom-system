import { Router } from 'express';
import { injectSiteScope } from '../../middleware/siteScope';
import { notImplemented } from '../../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.post('/product/:id', notImplemented);
router.post('/batch', notImplemented);

export default router;
