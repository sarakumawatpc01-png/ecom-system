import type { Metadata } from 'next';
import { buildPageMetadata } from '../lib/site';

export const metadata: Metadata = {
  ...buildPageMetadata('Checkout | Demo Store', 'Secure checkout for Demo Store orders.', '/checkout'),
  robots: { index: false, follow: true }
};

export default function CheckoutPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Checkout</h1>
      <p>Checkout page (kept noindex).</p>
    </main>
  );
}
