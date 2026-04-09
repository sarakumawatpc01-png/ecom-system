import { NextFunction, Request, Response } from 'express';
import { captureApiError } from '../services/monitoring/sentry';

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ ok: false, message: 'Not found' });
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Unexpected error';
  captureApiError(err, { request: { method: _req.method, url: _req.originalUrl } });
  res.status(500).json({ ok: false, message });
};
