import { Router } from 'express';
import { notImplemented } from '../utils/routeHelpers';

const router = Router();
router.post('/email', notImplemented);
router.post('/push', notImplemented);

export default router;
