import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Products | Demo Store',
  description: 'Search products quickly across categories on Demo Store.'
};

export default function SearchPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Search Products</h1>
      <p>Search functionality scaffold for product discovery.</p>
    </main>
  );
}
