export function Header({ stats }: { stats: any }) {
  return (
    <header
      className="flex items-center justify-between px-6 py-3"
      style={{
        background: '#161B27',
        borderBottom: '1px solid #1E2D3D',
        minHeight: '52px',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm font-semibold tracking-wide text-slate-100">SAP O2C Graph Explorer</span>
        <span className="font-mono text-xs text-slate-500">Graph + SQL Copilot</span>
      </div>
      {stats && (
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{stats.total_nodes?.toLocaleString()} nodes</span>
          <span className="text-slate-600">·</span>
          <span>{stats.total_edges?.toLocaleString()} edges</span>
          <span className="text-slate-600">·</span>
          <span>{stats.by_type?.SalesOrder} orders</span>
          <span className="text-slate-600">·</span>
          <span>{stats.by_type?.BusinessPartner} customers</span>
        </div>
      )}
    </header>
  );
}
