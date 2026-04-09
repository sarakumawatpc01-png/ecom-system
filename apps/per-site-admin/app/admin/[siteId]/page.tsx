type SiteScopedPageProps = {
  params: Promise<{ siteId: string }>;
};

export default async function SiteScopedAdminPage({ params }: SiteScopedPageProps) {
  const { siteId } = await params;
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Site Dashboard: {siteId}</h1>
      <p style={{ color: '#9CA3AF' }}>
        This route demonstrates super-admin scoped access via <code>/admin/[siteId]</code> while keeping data isolated to a single site.
      </p>
    </section>
  );
}
