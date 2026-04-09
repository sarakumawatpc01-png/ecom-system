import type { Metadata } from 'next';

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
  const display = slug.replace(/-/g, ' ');
  return {
    title: `${display} Collection | Demo Store`,
    description: `Explore ${display} products and compare top picks before checkout.`,
    alternates: { canonical: `https://${siteDomain}/categories/${slug}` }
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  return (
    <main style={{ padding: 24 }}>
      <h1>Category: {slug.replace(/-/g, ' ')}</h1>
      <p>Sample category page used for storefront checks and Lighthouse CI.</p>
    </main>
  );
}
