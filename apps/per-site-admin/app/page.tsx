export default function SiteAdminHome() {
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <p style={{ color: '#9CA3AF' }}>Site-scoped dashboard. Cross-site data is intentionally not shown.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
        {[
          ['Today revenue', '₹0'],
          ['Today orders', '0'],
          ['Active products', '0'],
          ['Pending approvals', '0']
        ].map(([label, value]) => (
          <article key={label} style={{ border: '1px solid #2E2E2E', borderRadius: 10, padding: 12, background: '#1A1A1A' }}>
            <p style={{ margin: 0, color: '#9CA3AF', fontSize: 12 }}>{label}</p>
            <p style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 600 }}>{value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
