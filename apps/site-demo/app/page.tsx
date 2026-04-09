import type { Metadata } from 'next';

const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
const canonical = `https://${siteDomain}/`;

export const metadata: Metadata = {
  title: 'Buy Demo Products Online | Demo Store',
  description: 'Shop the demo catalog with fast delivery and secure checkout.',
  alternates: { canonical }
};

export default function SiteHome() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Demo Public Site</h1>
      <p>This is a starter storefront app wired to the shared platform architecture.</p>
      <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="/search">Search</a>
        <a href="/blog">Blog</a>
      </nav>
    </main>
  );
}
