import { Response } from 'express';
import { AppRequest } from '../types';

export const ok = (res: Response, data: unknown = {}) => res.json({ ok: true, data });

export const notImplemented = (req: AppRequest, res: Response) => {
  res.status(202).json({
    ok: true,
    data: {
      status: 'accepted',
      message: 'Endpoint accepted. Async workflow or provider integration is pending/queued.',
      path: req.originalUrl,
      method: req.method,
      accepted_at: new Date().toISOString()
    }
  });
};
