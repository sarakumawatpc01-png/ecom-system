import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
  const base = `https://${siteDomain}`;
  return [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/blog`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/categories/sample-category`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/products/sample-product`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/store/sample-city`, changeFrequency: 'weekly', priority: 0.5 }
  ];
}
