import { generateMetadata } from '@ecom/seo';

export const siteId = process.env.SITE_ID || process.env.NEXT_PUBLIC_SITE_ID || '';
export const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
export const siteUrl = `https://${siteDomain}`;
export const apiBase = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:5000';

export const buildPageMetadata = (title: string, description: string, path: string, keywords?: string[]) =>
  generateMetadata({
    title,
    description,
    canonicalUrl: `${siteUrl}${path}`,
    keywords
  });
