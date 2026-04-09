import { db } from '../client';

export const listSites = () => db.sites.findMany({ where: { is_deleted: false } });
