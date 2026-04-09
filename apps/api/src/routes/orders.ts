import { Router } from 'express';
import { injectSiteScope } from '../middleware/siteScope';
import { notImplemented } from '../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.use(injectSiteScope);
router.get('/', notImplemented);
router.get('/export', notImplemented);
router.get('/:id', notImplemented);
router.put('/:id/status', notImplemented);
router.post('/:id/refund', notImplemented);
router.post('/webhook/razorpay', notImplemented);
router.post('/webhook/stripe', notImplemented);

export default router;
