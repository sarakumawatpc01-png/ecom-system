import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import SiteSelector from './site-selector';

const navItems = [
  { label: 'Dashboard', href: '/' },
  { label: 'Sites', href: '/sites' },
  { label: 'AI Studio', href: '/ai-studio' },
  { label: 'Import', href: '/import' },
  { label: 'Products', href: '/products' },
  { label: 'Orders', href: '/orders' },
  { label: 'Customers', href: '/customers' },
  { label: 'Reviews', href: '/reviews' },
  { label: 'Content', href: '/content' },
  { label: 'SEO', href: '/seo' },
  { label: 'Heatmaps & Sessions', href: '/heatmaps' },
  { label: 'Ads', href: '/ads' },
  { label: 'Landing Pages', href: '/landing-pages' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Infrastructure', href: '/infrastructure' },
  { label: 'Deploy Site ZIP', href: '/deploy-site-zip' },
  { label: 'Users & Permissions', href: '/users-permissions' },
  { label: 'Settings', href: '/settings' }
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
                  <li key={item.href} style={{ color: '#9CA3AF', fontSize: 13 }}>
                    <Link href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                      {item.label}
                    </Link>
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
