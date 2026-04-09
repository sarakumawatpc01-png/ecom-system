import { generateMetadata } from '@ecom/seo/src/generateMetadata';

export const metadata = generateMetadata({
  title: 'Demo Store',
  description: 'Demo multi-site storefront scaffold',
  canonicalUrl: 'https://example.com'
});

export default function SiteHome() {
  return (
    <main>
      <h1>Demo Public Site</h1>
      <p>This is a starter storefront app wired to the shared platform architecture.</p>
    </main>
  );
}
