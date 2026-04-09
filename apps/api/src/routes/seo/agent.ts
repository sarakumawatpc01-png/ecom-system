import { Router } from 'express';
import { notImplemented } from '../../utils/routeHelpers';

const router = Router({ mergeParams: true });
router.get('/opportunities', notImplemented);

export default router;
