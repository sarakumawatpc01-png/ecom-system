import { Router } from 'express';
import { injectSiteScope } from '../middleware/siteScope';
import { notImplemented } from '../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/', notImplemented);
router.post('/', notImplemented);
router.get('/:id', notImplemented);
router.put('/:id', notImplemented);
router.delete('/:id', notImplemented);

export default router;
