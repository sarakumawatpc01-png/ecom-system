export const buildProductSchema = (data: Record<string, unknown>) => ({
  '@context': 'https://schema.org',
  ...data
});
