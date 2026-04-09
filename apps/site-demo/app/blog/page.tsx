import type { Metadata } from 'next';
import { buildPageMetadata } from '../lib/site';

export const metadata: Metadata = buildPageMetadata('Demo Store Blog', 'Read Demo Store articles, buying guides, and updates.', '/blog');

export default function BlogListingPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Demo Store Blog</h1>
      <p>Blog listing for SEO and content workflows.</p>
    </main>
  );
}
