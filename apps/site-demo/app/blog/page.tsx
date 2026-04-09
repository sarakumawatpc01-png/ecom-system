import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Demo Store Blog',
  description: 'Read Demo Store articles, buying guides, and updates.'
};

export default function BlogListingPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Demo Store Blog</h1>
      <p>Blog listing scaffold for SEO and content workflows.</p>
    </main>
  );
}
