import { getBlogPosts, getCategories, getProducts } from '@ecom/api-client';
import { db } from '@ecom/db';
import { apiBase, siteId } from './site';

type SlugItem = { slug: string };

const fromApi = async <T>(factory: () => Promise<any>): Promise<T[]> => {
  try {
    const response = await factory();
    const rows = Array.isArray(response?.data) ? response.data : [];
    return rows as T[];
  } catch {
    return [];
  }
};

export const getCatalogSlugs = async () => {
  const [productsFromApi, categoriesFromApi, blogFromApi] = await Promise.all([
    fromApi<SlugItem>(() => getProducts(apiBase, siteId)),
    fromApi<SlugItem>(() => getCategories(apiBase, siteId)),
    fromApi<SlugItem>(() => getBlogPosts(apiBase, siteId))
  ]);

  if (productsFromApi.length || categoriesFromApi.length || blogFromApi.length) {
    return {
      products: productsFromApi.map((item) => item.slug).filter(Boolean),
      categories: categoriesFromApi.map((item) => item.slug).filter(Boolean),
      blogPosts: blogFromApi.map((item) => item.slug).filter(Boolean)
    };
  }

  if (!siteId) {
    return { products: [], categories: [], blogPosts: [] };
  }

  try {
    const [products, categories, blogPosts] = await Promise.all([
      db.products.findMany({ where: { site_id: siteId, is_deleted: false }, select: { slug: true }, take: 500 }),
      db.categories.findMany({ where: { site_id: siteId, is_active: true }, select: { slug: true }, take: 500 }),
      db.blog_posts.findMany({ where: { site_id: siteId, status: 'published' }, select: { slug: true }, take: 500 })
    ]);
    return {
      products: products.map((item) => item.slug),
      categories: categories.map((item) => item.slug),
      blogPosts: blogPosts.map((item) => item.slug)
    };
  } catch {
    return { products: [], categories: [], blogPosts: [] };
  }
};
