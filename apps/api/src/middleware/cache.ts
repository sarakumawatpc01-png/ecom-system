import { NextFunction, Response } from 'express';
import { AppRequest } from '../types';

export const cache = (_ttlSeconds = 30) => (_req: AppRequest, _res: Response, next: NextFunction) => next();
