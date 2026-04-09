import type { Metadata } from 'next';

type SectionPageProps = {
  params: Promise<{ section: string }>;
};

const titleFromSection = (section: string) => section.split('-').map((token) => token.charAt(0).toUpperCase() + token.slice(1)).join(' ');

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params;
  const title = titleFromSection(section);
  return {
    title: `${title} | Site Admin`,
    description: `Manage ${title} for the current site scope.`
  };
}

export default async function SiteSectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  const title = titleFromSection(section);
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>{title}</h1>
      <p style={{ color: '#9CA3AF' }}>
        This module is restricted to the active site context and does not expose cross-site controls.
      </p>
    </section>
  );
}
