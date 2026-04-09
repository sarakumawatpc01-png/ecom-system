export const buildFaqSchema = (data: Record<string, unknown>) => ({
  '@context': 'https://schema.org',
  ...data
});
