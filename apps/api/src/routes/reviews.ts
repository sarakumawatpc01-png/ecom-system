import { Router } from 'express';
import { injectSiteScope } from '../middleware/siteScope';
import { notImplemented } from '../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/', notImplemented);
router.get('/flagged', notImplemented);
router.put('/:id/approve', notImplemented);
router.put('/:id/reject', notImplemented);
router.delete('/:id', notImplemented);

export default router;
