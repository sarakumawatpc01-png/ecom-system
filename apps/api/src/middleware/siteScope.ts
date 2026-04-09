import { NextFunction, Response } from 'express';
import { AppRequest } from '../types';

export const injectSiteScope = (req: AppRequest, res: Response, next: NextFunction) => {
  const routeSiteId = req.params.siteId;
  req.ctx = { ...(req.ctx || {}), siteId: routeSiteId };

  const user = req.ctx.user;
  if (!routeSiteId || !user) {
    return next();
  }

  if (user.role === 'super_admin') {
    return next();
  }

  if (!user.sites.includes(routeSiteId)) {
    return res.status(403).json({ ok: false, message: 'Site access denied' });
  }

  return next();
};
