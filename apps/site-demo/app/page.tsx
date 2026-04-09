import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { buildPageMetadata, siteUrl } from './lib/site';

export const metadata: Metadata = buildPageMetadata(
  'Buy Demo Products Online | Demo Store',
  'Shop the demo catalog with fast delivery and secure checkout.',
  '/'
);

export default function SiteHome() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Demo Public Site</h1>
      <p>This storefront is wired to shared API, SEO, and DB packages in the monorepo.</p>
      <Image
        src={`data:image/svg+xml;utf8,${encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#1A1A1A"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#F1F1F1" font-size="54">Demo Store</text></svg>'
        )}`}
        alt="Demo Store hero banner"
        width={1200}
        height={630}
        priority
      />
      <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/about">About</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/search">Search</Link>
        <Link href="/blog">Blog</Link>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Demo Store',
            url: siteUrl
          })
        }}
      />
    </main>
  );
}
