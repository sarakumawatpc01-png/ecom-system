import { AppRequest } from '../types';

export const getSiteId = (req: AppRequest): string | null => req.ctx?.siteId || req.params.siteId || null;

export const toPagination = (req: AppRequest) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 25), 100);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 25;
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};
