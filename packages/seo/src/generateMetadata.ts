export type MetaInput = {
  title: string;
  description: string;
  canonicalUrl: string;
  keywords?: string[];
};

export const generateMetadata = (input: MetaInput) => ({
  title: input.title,
  description: input.description,
  alternates: { canonical: input.canonicalUrl },
  keywords: input.keywords ?? []
});
