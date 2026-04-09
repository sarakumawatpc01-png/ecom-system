import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { notImplemented } from '../utils/routeHelpers';

const router = Router();
router.use(requireRole('super_admin'));
router.get('/', notImplemented);
router.post('/', notImplemented);
router.get('/:id', notImplemented);
router.put('/:id', notImplemented);
router.delete('/:id', notImplemented);
router.put('/:id/status', notImplemented);
router.post('/:id/cache/purge', notImplemented);

export default router;
