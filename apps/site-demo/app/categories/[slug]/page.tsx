import type { Metadata } from 'next';
import { slugToDisplayText } from '../../lib/slug';
import { buildPageMetadata } from '../../lib/site';

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const display = slugToDisplayText(slug);
  return buildPageMetadata(
    `${display} Collection | Demo Store`,
    `Explore ${display} products and compare top picks before checkout.`,
    `/categories/${slug}`
  );
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const display = slugToDisplayText(slug);
  return (
    <main style={{ padding: 24 }}>
      <h1>Category: {display}</h1>
      <p>Sample category page used for storefront checks and Lighthouse CI.</p>
    </main>
  );
}
