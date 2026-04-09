import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';
import { buildPageMetadata, siteUrl } from './lib/site';

export const metadata: Metadata = { ...buildPageMetadata('Demo Storefront', 'Public storefront with shared API, SEO, and DB integration.', '/'), robots: { index: true, follow: true } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Inter, Arial, sans-serif' }}>
        <Script id="ga4" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${process.env.NEXT_PUBLIC_GA4_ID || ''}');`}
        </Script>
        <Script id="openreplay" strategy="afterInteractive">
          {`window.__openReplayProjectKey='${process.env.NEXT_PUBLIC_OPENREPLAY_KEY || ''}';`}
        </Script>
        <Script
          id="website-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'Demo Store',
              url: siteUrl
            })
          }}
        />
        {children}
      </body>
    </html>
  );
}
