import type { Metadata } from 'next';
import { slugToDisplayText } from '../lib/slug';
import { buildPageMetadata } from '../lib/site';

type GenericCategoryPageProps = {
  params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: GenericCategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const display = slugToDisplayText(category);
  return buildPageMetadata(`${display} Category | Demo Store`, `Browse ${display} products at Demo Store.`, `/${category}`);
}

export default async function GenericCategoryPage({ params }: GenericCategoryPageProps) {
  const { category } = await params;
  const display = slugToDisplayText(category);
  return (
    <main style={{ padding: 24 }}>
      <h1>{display}</h1>
      <p>Generic category route aligned with the public-site structure spec.</p>
    </main>
  );
}
