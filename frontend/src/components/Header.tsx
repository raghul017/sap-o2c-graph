function Header({ stats }: { stats: any }) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        borderBottom: '1px solid #e5e7eb',
        background: '#ffffff',
        minHeight: '48px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>Mapping</span>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
          Order to Cash
        </span>
      </div>
      {stats && (
        <div style={{ fontSize: 12, color: '#9ca3af' }}>
          {stats.total_nodes} nodes · {stats.total_edges} edges
        </div>
      )}
    </header>
  );
}

export { Header };
