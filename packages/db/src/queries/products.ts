import { db } from '../client';

export const listProductsBySite = (site_id: string) =>
  db.products.findMany({ where: { site_id, is_deleted: false } });
