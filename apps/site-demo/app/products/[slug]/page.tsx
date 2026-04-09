import type { Metadata } from 'next';

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
  const display = slug.replace(/-/g, ' ');
  return {
    title: `${display} Price & Details | Demo Store`,
    description: `Get ${display} with fast shipping and secure payments at Demo Store.`,
    alternates: { canonical: `https://${siteDomain}/products/${slug}` }
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  return (
    <main style={{ padding: 24 }}>
      <h1>Product: {slug.replace(/-/g, ' ')}</h1>
      <p>Sample product page used for storefront checks and Lighthouse CI.</p>
    </main>
  );
}
