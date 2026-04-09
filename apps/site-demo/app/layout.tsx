import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Script from 'next/script';

const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
const siteUrl = `https://${siteDomain}`;

export const metadata: Metadata = {
  title: 'Demo Storefront',
  description: 'Public storefront scaffold aligned with shared architecture requirements.',
  alternates: { canonical: siteUrl },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'Inter, Arial, sans-serif' }}>
        <Script id="ga4" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());`}
        </Script>
        <Script id="openreplay" strategy="afterInteractive">
          {`window.__openReplayProjectKey='${process.env.NEXT_PUBLIC_OPENREPLAY_KEY || ''}';`}
        </Script>
        {children}
      </body>
    </html>
  );
}
