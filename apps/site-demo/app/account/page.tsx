import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your Account | Demo Store',
  description: 'Manage account details and order history.',
  robots: { index: false, follow: true }
};

export default function AccountPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Your Account</h1>
      <p>Account page scaffold (kept noindex).</p>
    </main>
  );
}
