import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Demo Store',
  description: 'Learn about Demo Store, our mission, and customer commitment.'
};

export default function AboutPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>About Demo Store</h1>
      <p>Demo Store is a sample storefront used to validate the multi-site ecommerce architecture.</p>
    </main>
  );
}
