import type { Metadata } from 'next';
import { buildPageMetadata } from '../lib/site';

export const metadata: Metadata = {
  ...buildPageMetadata('Your Cart | Demo Store', 'Review your cart before checkout.', '/cart'),
  robots: { index: false, follow: true }
};

export default function CartPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Your Cart</h1>
      <p>Cart page (kept noindex).</p>
    </main>
  );
}
