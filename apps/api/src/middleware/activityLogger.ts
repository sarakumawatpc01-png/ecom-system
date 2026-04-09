import { NextFunction, Response } from 'express';
import { AppRequest } from '../types';
import { logAdminActivity } from '../services/activityLog';

const isWriteMethod = (method: string) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
const isAdminRole = (role?: string) => ['super_admin', 'site_admin', 'editor'].includes(String(role || ''));

export const adminActivityLogger = (req: AppRequest, res: Response, next: NextFunction) => {
  if (!isWriteMethod(req.method)) return next();
  const role = req.ctx?.user?.role;
  const userId = req.ctx?.user?.sub;
  if (!isAdminRole(role) || !userId) return next();

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 400) return;
    const [, entity = 'unknown', entityId = null] = req.path.split('/');
    void logAdminActivity({
      user_id: userId,
      site_id: req.ctx?.siteId || req.params.siteId || null,
      action: `${req.method.toUpperCase()} ${req.path}`,
      entity,
      entity_id: entityId,
      meta: {
        status_code: res.statusCode
      }
    });
  });

  return next();
};
