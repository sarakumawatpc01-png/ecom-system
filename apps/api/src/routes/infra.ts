import { Router } from 'express';
import { requireRole } from '../middleware/auth';
import { notImplemented } from '../utils/routeHelpers';

const router = Router();
router.use(requireRole('super_admin'));
router.get('/sites/status', notImplemented);
router.post('/sites/:id/restart', notImplemented);
router.post('/sites/:id/rebuild', notImplemented);
router.get('/server/metrics', notImplemented);
router.get('/backups', notImplemented);
router.post('/backups/trigger', notImplemented);
router.get('/logs/:appName', notImplemented);

export default router;
