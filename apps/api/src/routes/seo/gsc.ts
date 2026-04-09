import { Router } from 'express';
import { injectSiteScope } from '../../middleware/siteScope';
import { notImplemented } from '../../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/gsc/performance', notImplemented);
router.get('/gsc/keywords', notImplemented);

export default router;
