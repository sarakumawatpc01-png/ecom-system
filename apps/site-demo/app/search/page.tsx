import type { Metadata } from 'next';
import { buildPageMetadata } from '../lib/site';

export const metadata: Metadata = buildPageMetadata('Search Products | Demo Store', 'Search products quickly across categories on Demo Store.', '/search');

export default function SearchPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Search Products</h1>
      <p>Search route for product discovery and intent capture.</p>
    </main>
  );
}
