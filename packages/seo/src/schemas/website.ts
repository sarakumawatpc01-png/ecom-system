export const buildWebsiteSchema = (data: Record<string, unknown>) => ({
  '@context': 'https://schema.org',
  ...data
});
