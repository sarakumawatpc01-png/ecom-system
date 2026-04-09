import type { MetadataRoute } from 'next';
import { getCatalogSlugs } from './lib/catalog';
import { siteUrl } from './lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalog = await getCatalogSlugs();
  const products = catalog.products.length ? catalog.products : ['sample-product'];
  const categories = catalog.categories.length ? catalog.categories : ['sample-category'];
  const blogPosts = catalog.blogPosts.length ? catalog.blogPosts : ['welcome'];

  return [
    { url: `${siteUrl}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/about`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/contact`, changeFrequency: 'monthly', priority: 0.6 },
    ...categories.map((slug) => ({ url: `${siteUrl}/categories/${slug}`, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...products.map((slug) => ({ url: `${siteUrl}/products/${slug}`, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...blogPosts.map((slug) => ({ url: `${siteUrl}/blog/${slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    { url: `${siteUrl}/store/sample-city`, changeFrequency: 'weekly', priority: 0.5 }
  ];
}
