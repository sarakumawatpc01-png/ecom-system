import type { Metadata } from 'next';
import { slugToDisplayText } from '../../lib/slug';
import { buildPageMetadata, siteUrl } from '../../lib/site';

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const display = slugToDisplayText(slug);
  return buildPageMetadata(
    `${display} Price & Details | Demo Store`,
    `Get ${display} with fast shipping and secure payments at Demo Store.`,
    `/products/${slug}`
  );
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const display = slugToDisplayText(slug);
  return (
    <main style={{ padding: 24 }}>
      <h1>Product: {display}</h1>
      <p>Sample product page used for storefront checks and Lighthouse CI.</p>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: display,
            image: [`${siteUrl}/products/${slug}`],
            offers: { '@type': 'Offer', priceCurrency: 'INR', price: '0', availability: 'https://schema.org/InStock' }
          })
        }}
      />
    </main>
  );
}
