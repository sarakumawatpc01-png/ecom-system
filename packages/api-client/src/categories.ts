import { apiGet } from './http';

export const getCategories = (baseUrl: string, siteId: string) => apiGet(baseUrl, `/api/${siteId}/categories`);
