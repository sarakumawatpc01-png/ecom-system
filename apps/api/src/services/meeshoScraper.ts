export type ScrapedMeeshoVariant = {
  name: string;
  sku?: string;
  price?: number;
  stock?: number;
  options?: Record<string, string>;
  image_url?: string;
};

export type ScrapedMeeshoReview = {
  author_name?: string;
  rating?: number;
  title?: string;
  text?: string;
  body?: string;
  source_id?: string;
  images?: string[];
};

export type ScrapedMeeshoProduct = {
  source_id?: string;
  source_url?: string;
  name: string;
  original_name?: string;
  description?: string;
  original_description?: string;
  short_description?: string;
  sku?: string;
  brand?: string;
  price?: number;
  compare_price?: number;
  currency?: string;
  stock_quantity?: number;
  images?: string[];
  variants?: ScrapedMeeshoVariant[];
  reviews?: ScrapedMeeshoReview[];
};

export type ScrapedMeeshoPayload = {
  sourceUrl: string;
  products: ScrapedMeeshoProduct[];
};

export const scrapeMeesho = async (url: string): Promise<ScrapedMeeshoPayload> => {
  return { sourceUrl: url, products: [] };
};
