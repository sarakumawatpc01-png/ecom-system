import { NextFunction, Response } from 'express';
import { AppRequest } from '../types';

const limitWindowMs = 60_000;
const limitPerWindow = 100;
const hits = new Map<string, { count: number; expires: number }>();

export const apiRateLimit = (req: AppRequest, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || entry.expires < now) {
    hits.set(ip, { count: 1, expires: now + limitWindowMs });
    return next();
  }

  if (entry.count >= limitPerWindow) {
    return res.status(429).json({ ok: false, message: 'Rate limit exceeded' });
  }

  entry.count += 1;
  return next();
};
