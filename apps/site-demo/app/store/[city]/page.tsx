import type { Metadata } from 'next';
import { slugToDisplayText } from '../../lib/slug';
import { buildPageMetadata, siteUrl } from '../../lib/site';

type StorePageProps = {
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { city } = await params;
  const cityName = slugToDisplayText(city);
  return buildPageMetadata(
    `Demo Store in ${cityName}`,
    `Visit Demo Store information for ${cityName}, including support and local delivery details.`,
    `/store/${city}`
  );
}

export default async function StoreCityPage({ params }: StorePageProps) {
  const { city } = await params;
  const cityName = slugToDisplayText(city);
  return (
    <main style={{ padding: 24 }}>
      <h1>Demo Store {cityName}</h1>
      <p>Local store page scaffold for location-based discovery.</p>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'LocalBusiness',
            name: `Demo Store ${cityName}`,
            url: `${siteUrl}/store/${city}`
          })
        }}
      />
    </main>
  );
}
