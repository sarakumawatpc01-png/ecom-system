import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Demo Store',
  description: 'Contact Demo Store support for orders, delivery, and product help.'
};

export default function ContactPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Contact Demo Store</h1>
      <p>Reach out for support, order tracking, and product questions.</p>
    </main>
  );
}
