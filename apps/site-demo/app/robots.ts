import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
  const base = `https://${siteDomain}`;
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/cart', '/checkout', '/account', '/api']
      }
    ],
    sitemap: `${base}/sitemap.xml`
  };
}
