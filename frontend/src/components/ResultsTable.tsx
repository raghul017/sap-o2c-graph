interface ResultsTableProps {
  columns?: string[];
  rows?: any[][];
  count?: number;
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  const text = String(value);
  return text.length > 30 ? `${text.slice(0, 30)}…` : text;
}

export function ResultsTable({ columns = [], rows = [], count = 0 }: ResultsTableProps) {
  const visibleRows = rows.slice(0, 20);

  if (!columns.length) {
    return <div className="text-sm text-slate-400">No rows returned.</div>;
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/60">
      <div className="max-h-[200px] overflow-auto scrollbar-thin">
        <table className="min-w-full border-collapse text-left text-xs text-slate-200">
          <thead className="sticky top-0 bg-slate-900/95">
            <tr>
              {columns.map((column) => (
                <th key={column} className="border-b border-slate-800 px-3 py-2 font-semibold text-slate-300">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row.join('|')}`} className={rowIndex % 2 === 0 ? 'bg-slate-900/30' : 'bg-slate-900/60'}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    className="max-w-[180px] truncate border-b border-slate-900/40 px-3 py-2 text-slate-200"
                    title={cell === null || cell === undefined ? '' : String(cell)}
                  >
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {count > visibleRows.length ? (
        <div className="border-t border-slate-800 px-3 py-2 text-[11px] text-slate-400">
          Showing {visibleRows.length} of {count} rows
        </div>
      ) : null}
    </div>
  );
}
