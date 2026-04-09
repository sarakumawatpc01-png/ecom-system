import { Router } from 'express';
import { injectSiteScope } from '../middleware/siteScope';
import { notImplemented } from '../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.post('/upload', notImplemented);
router.get('/', notImplemented);
router.delete('/:id', notImplemented);

export default router;
