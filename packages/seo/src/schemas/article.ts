export const buildArticleSchema = (data: Record<string, unknown>) => ({
  '@context': 'https://schema.org',
  ...data
});
