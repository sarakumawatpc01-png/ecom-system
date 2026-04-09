export const buildLocalBusinessSchema = (data: Record<string, unknown>) => ({
  '@context': 'https://schema.org',
  ...data
});
