import { getBlogPosts, getCategories, getProducts } from '@ecom/api-client';
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

  return { products: [], categories: [], blogPosts: [] };
};
