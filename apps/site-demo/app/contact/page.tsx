import type { Metadata } from 'next';
import { buildPageMetadata } from '../lib/site';

export const metadata: Metadata = buildPageMetadata('Contact Demo Store', 'Contact Demo Store support for orders, delivery, and product help.', '/contact');

export default function ContactPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Contact Demo Store</h1>
      <p>Reach out for support, order tracking, and product questions.</p>
    </main>
  );
}
