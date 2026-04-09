import type { Metadata } from 'next';

type StorePageProps = {
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { city } = await params;
  const siteDomain = process.env.SITE_DOMAIN || 'localhost:3001';
  const cityName = city.replace(/-/g, ' ');
  return {
    title: `Demo Store in ${cityName}`,
    description: `Visit Demo Store information for ${cityName}, including support and local delivery details.`,
    alternates: { canonical: `https://${siteDomain}/store/${city}` }
  };
}

export default async function StoreCityPage({ params }: StorePageProps) {
  const { city } = await params;
  return (
    <main style={{ padding: 24 }}>
      <h1>Demo Store {city.replace(/-/g, ' ')}</h1>
      <p>Local store page scaffold for location-based discovery.</p>
    </main>
  );
}
