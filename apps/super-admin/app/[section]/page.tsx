import type { Metadata } from 'next';

type SectionPageProps = {
  params: Promise<{ section: string }>;
};

const titleFromSection = (section: string) => section.split('-').map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join(' ');

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params;
  const title = titleFromSection(section);
  return {
    title: `${title} | Super Admin`,
    description: `Manage ${title} for all sites from the super admin panel.`
  };
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  const title = titleFromSection(section);
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>{title}</h1>
      <p style={{ color: '#9CA3AF' }}>
        This module is globally scoped across all sites and uses the top-header site selector context when needed.
      </p>
    </section>
  );
}
