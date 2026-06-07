"use client";

type SqlResultGridProps = {
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
};

export function SqlResultGrid({ columns, rows }: SqlResultGridProps) {
  if (columns.length === 0) {
    return <div className="rounded-[8px] bg-slate-50 p-4 text-sm text-slate-600">Run a query to see results.</div>;
  }

  return (
    <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white">
      <div className="max-h-72 overflow-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="sticky top-0 bg-slate-50 text-slate-600">
            <tr>
              {columns.map((column) => (
                <th key={column} className="border-b border-slate-200 px-3 py-2 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column} className="px-3 py-2 text-slate-700">
                    {String(row[column] ?? "NULL")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
