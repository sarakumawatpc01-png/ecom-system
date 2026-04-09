import { Response } from 'express';
import { AppRequest } from '../types';

export const ok = (res: Response, data: unknown = {}) => res.json({ ok: true, data });

export const notImplemented = (req: AppRequest, res: Response) => {
  res.status(501).json({
    ok: false,
    message: 'Endpoint scaffolded but business logic not yet implemented.',
    path: req.originalUrl
  });
};
