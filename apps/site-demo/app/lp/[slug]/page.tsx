import type { Metadata } from 'next';
import { slugToDisplayText } from '../../lib/slug';
import { buildPageMetadata } from '../../lib/site';

type LandingPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const display = slugToDisplayText(slug);
  return {
    ...buildPageMetadata(`Landing Page: ${display}`, 'Campaign landing page generated from the builder pipeline.', `/lp/${slug}`),
    robots: { index: false, follow: true },
  };
}

export default async function LandingPage({ params }: LandingPageProps) {
  const { slug } = await params;
  const display = slugToDisplayText(slug);
  return (
    <main style={{ padding: 24 }}>
      <h1>Landing Page {display}</h1>
      <p>Landing page route for campaign and A/B traffic flows.</p>
    </main>
  );
}
