import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { notImplemented } from '../../utils/routeHelpers';

const router = Router();
router.use(requireRole('super_admin', 'site_admin'));
router.get('/', notImplemented);
router.post('/', notImplemented);
router.put('/:id', notImplemented);
router.delete('/:id', notImplemented);
router.post('/test', notImplemented);
router.get('/providers', notImplemented);

export default router;
