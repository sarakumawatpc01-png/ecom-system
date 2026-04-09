import type { Metadata } from 'next';

type BlogPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
  const title = slug.replace(/-/g, ' ');
  return {
    title: `${title} | Demo Store Blog`,
    description: `Read ${title} and practical ecommerce tips from Demo Store.`,
    alternates: { canonical: `https://${siteDomain}/blog/${slug}` }
  };
}

export default async function BlogPostPage({ params }: BlogPageProps) {
  const { slug } = await params;
  return (
    <main style={{ padding: 24 }}>
      <h1>{slug.replace(/-/g, ' ')}</h1>
      <p>Blog post scaffold for article rendering and schema enhancements.</p>
    </main>
  );
}
