import type { Metadata } from 'next';
import { buildPageMetadata } from '../lib/site';

export const metadata: Metadata = buildPageMetadata('About Demo Store', 'Learn about Demo Store, our mission, and customer commitment.', '/about');

export default function AboutPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>About Demo Store</h1>
      <p>Demo Store is a sample storefront used to validate the multi-site ecommerce architecture.</p>
    </main>
  );
}
