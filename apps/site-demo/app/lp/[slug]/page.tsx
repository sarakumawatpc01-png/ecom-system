import type { Metadata } from 'next';

type LandingPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
  return {
    title: `Landing Page: ${slug.replace(/-/g, ' ')}`,
    description: 'Campaign landing page scaffold from builder output.',
    robots: { index: false, follow: true },
    alternates: { canonical: `https://${siteDomain}/lp/${slug}` }
  };
}

export default async function LandingPage({ params }: LandingPageProps) {
  const { slug } = await params;
  return (
    <main style={{ padding: 24 }}>
      <h1>Landing Page {slug.replace(/-/g, ' ')}</h1>
      <p>Landing page scaffold route for campaign and A/B flows.</p>
    </main>
  );
}
