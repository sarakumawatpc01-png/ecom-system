import { NextFunction, Response } from 'express';
import { DEPLOYMENT_CONFIG } from '../config/deployment';
import { AppRequest } from '../types';

const ipHits = new Map<string, { count: number; expires: number }>();
const userHits = new Map<string, { count: number; expires: number }>();

const consume = (store: Map<string, { count: number; expires: number }>, key: string, limit: number) => {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.expires < now) {
    store.set(key, { count: 1, expires: now + DEPLOYMENT_CONFIG.rateLimitWindowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
};

export const deploymentRateLimit = (req: AppRequest, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userId = req.ctx?.user?.sub || 'anonymous';
  if (!consume(ipHits, ip, DEPLOYMENT_CONFIG.rateLimitIpPerWindow)) {
    return res.status(429).json({ ok: false, message: 'Deployment IP rate limit exceeded' });
  }
  if (!consume(userHits, userId, DEPLOYMENT_CONFIG.rateLimitUserPerWindow)) {
    return res.status(429).json({ ok: false, message: 'Deployment user rate limit exceeded' });
  }
  return next();
};

export const requireCsrfHeaderIfConfigured = (req: AppRequest, res: Response, next: NextFunction) => {
  if (!DEPLOYMENT_CONFIG.csrfToken) return next();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) return next();

  const header = String(req.headers['x-super-admin-csrf'] || '').trim();
  if (!header || header !== DEPLOYMENT_CONFIG.csrfToken) {
    return res.status(403).json({ ok: false, message: 'CSRF validation failed' });
  }
  return next();
};
