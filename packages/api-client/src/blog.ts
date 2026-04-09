import { apiGet } from './http';

export const getBlogPosts = (baseUrl: string, siteId: string) => apiGet(baseUrl, `/api/${siteId}/blog`);
