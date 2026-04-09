import { Router } from 'express';
import { injectSiteScope } from '../middleware/siteScope';
import { notImplemented } from '../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/', notImplemented);
router.post('/', notImplemented);
router.get('/:slug', notImplemented);
router.put('/:id', notImplemented);
router.delete('/:id', notImplemented);
router.post('/bulk', notImplemented);
router.get('/:id/images', notImplemented);
router.post('/:id/images', notImplemented);
router.delete('/:id/images/:imageId', notImplemented);
router.post('/:id/videos', notImplemented);
router.get('/:id/variants', notImplemented);
router.post('/:id/variants', notImplemented);

export default router;
