import type { Metadata } from 'next';
import { buildPageMetadata } from '../lib/site';

export const metadata: Metadata = {
  ...buildPageMetadata('Your Account | Demo Store', 'Manage account details and order history.', '/account'),
  robots: { index: false, follow: true }
};

export default function AccountPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Your Account</h1>
      <p>Account page (kept noindex).</p>
    </main>
  );
}
