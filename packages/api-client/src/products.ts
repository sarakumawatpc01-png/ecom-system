import { apiGet } from './http';

export const getProducts = (baseUrl: string, siteId: string) => apiGet(baseUrl, `/api/${siteId}/products`);
