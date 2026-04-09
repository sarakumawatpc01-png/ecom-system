import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AppRequest, JwtClaims, UserRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export const authenticate = (req: AppRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ ok: false, message: 'Missing authorization header' });
  }

  const token = header.replace('Bearer ', '').trim();
  try {
    const claims = jwt.verify(token, JWT_SECRET) as JwtClaims;
    req.ctx = { ...(req.ctx || {}), user: claims };
    return next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Invalid token' });
  }
};

export const requireRole = (...roles: UserRole[]) => (req: AppRequest, res: Response, next: NextFunction) => {
  const role = req.ctx?.user?.role;
  if (!role || !roles.includes(role)) {
    return res.status(403).json({ ok: false, message: 'Insufficient permissions' });
  }
  return next();
};
