export const buildCategorySchema = (data: Record<string, unknown>) => ({
  '@context': 'https://schema.org',
  ...data
});
