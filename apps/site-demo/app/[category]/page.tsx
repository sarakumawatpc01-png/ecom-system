import type { Metadata } from 'next';

type GenericCategoryPageProps = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: GenericCategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
  const display = category.replace(/-/g, ' ');
  return {
    title: `${display} Category | Demo Store`,
    description: `Browse ${display} products at Demo Store.`,
    alternates: { canonical: `https://${siteDomain}/${category}` }
  };
}

export default async function GenericCategoryPage({ params }: GenericCategoryPageProps) {
  const { category } = await params;
  return (
    <main style={{ padding: 24 }}>
      <h1>{category.replace(/-/g, ' ')}</h1>
      <p>Generic category route scaffold requested by the public-site structure spec.</p>
    </main>
  );
}
