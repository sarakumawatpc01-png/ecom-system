import type { Metadata } from 'next';
import { slugToDisplayText } from '../../lib/slug';

type BlogPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
  const displayTitle = slugToDisplayText(slug);
  return {
    title: `${displayTitle} | Demo Store Blog`,
    description: `Read ${displayTitle} and practical ecommerce tips from Demo Store.`,
    alternates: { canonical: `https://${siteDomain}/blog/${slug}` }
  };
}

export default async function BlogPostPage({ params }: BlogPageProps) {
  const { slug } = await params;
  const displayTitle = slugToDisplayText(slug);
  return (
    <main style={{ padding: 24 }}>
      <h1>{displayTitle}</h1>
      <p>Blog post scaffold for article rendering and schema enhancements.</p>
    </main>
  );
}
