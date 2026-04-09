import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

const navItems = ['Dashboard', 'Products', 'Categories', 'Orders', 'Customers', 'Reviews', 'Blog', 'SEO', 'Heatmaps', 'Landing Pages', 'Analytics', 'Settings'];

export const metadata: Metadata = {
  title: 'Per-Site Admin Panel',
  description: 'Site-scoped administration panel for ecommerce operations.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable} style={{ margin: 0, background: '#0F0F0F', color: '#F1F1F1' }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <aside style={{ width: 220, borderRight: '1px solid #2E2E2E', padding: 16, background: '#1A1A1A' }}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Site Admin</h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
              {navItems.map((item) => (
                <li key={item} style={{ color: '#9CA3AF', fontSize: 13 }}>
                  {item}
                </li>
              ))}
            </ul>
          </aside>
          <div style={{ flex: 1 }}>
            <header style={{ height: 56, borderBottom: '1px solid #2E2E2E', display: 'flex', alignItems: 'center', padding: '0 16px', background: '#1A1A1A' }}>
              <span style={{ color: '#9CA3AF', fontSize: 13 }}>Scoped to site context from JWT or /admin/[siteId]</span>
            </header>
            <main style={{ padding: 24 }}>{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
