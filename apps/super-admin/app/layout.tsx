import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import SiteSelector from './site-selector';

const navItems = [
  'Dashboard',
  'Sites',
  'AI Studio',
  'Import',
  'Products',
  'Orders',
  'Customers',
  'Reviews',
  'Content',
  'SEO',
  'Heatmaps & Sessions',
  'Ads',
  'Landing Pages',
  'Analytics',
  'Infrastructure',
  'Users & Permissions',
  'Settings'
];

export const metadata: Metadata = {
  title: 'Super Admin Panel',
  description: 'Cross-site command centre for the multi-site ecommerce platform.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0F0F0F', color: '#F1F1F1', fontFamily: 'Inter, Arial, sans-serif' }}>
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          <aside style={{ width: 240, borderRight: '1px solid #2E2E2E', padding: 16, background: '#1A1A1A' }}>
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Super Admin</h2>
            <nav>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
                {navItems.map((item) => (
                  <li key={item} style={{ color: '#9CA3AF', fontSize: 13 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
          <div style={{ flex: 1 }}>
            <header
              style={{
                height: 56,
                borderBottom: '1px solid #2E2E2E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                background: '#1A1A1A'
              }}
            >
              <SiteSelector />
              <div style={{ color: '#9CA3AF', fontSize: 13 }}>notifications · admin</div>
            </header>
            <main style={{ padding: 24 }}>{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
