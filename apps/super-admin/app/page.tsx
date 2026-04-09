export default function SuperAdminHome() {
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <p style={{ color: '#9CA3AF' }}>Cross-site overview scaffold with global site scoping.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
        {[
          ['Total revenue today', '₹0'],
          ['Total orders today', '0'],
          ['Active sites', '0'],
          ['Pending AI jobs', '0']
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
