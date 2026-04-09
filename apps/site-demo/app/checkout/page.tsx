import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checkout | Demo Store',
  description: 'Secure checkout for Demo Store orders.',
  robots: { index: false, follow: true }
};

export default function CheckoutPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Checkout</h1>
      <p>Checkout page scaffold (kept noindex).</p>
    </main>
  );
}
