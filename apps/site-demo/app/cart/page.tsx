import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Cart | Demo Store',
  description: 'Review your cart before checkout.',
  robots: { index: false, follow: true }
};

export default function CartPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Your Cart</h1>
      <p>Cart page scaffold (kept noindex).</p>
    </main>
  );
}
