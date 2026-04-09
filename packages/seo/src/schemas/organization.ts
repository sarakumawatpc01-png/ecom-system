export const buildOrganizationSchema = (data: Record<string, unknown>) => ({
  '@context': 'https://schema.org',
  ...data
});
