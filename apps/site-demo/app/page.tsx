const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

export const metadata = {
  title: 'Demo Store',
  description: 'Demo multi-site storefront scaffold',
  alternates: { canonical: siteUrl }
};

export default function SiteHome() {
  return (
    <main>
      <h1>Demo Public Site</h1>
      <p>This is a starter storefront app wired to the shared platform architecture.</p>
    </main>
  );
}
