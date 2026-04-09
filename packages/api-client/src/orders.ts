import { apiGet } from './http';

export const getOrders = (baseUrl: string, siteId: string) => apiGet(baseUrl, `/api/${siteId}/orders`);
