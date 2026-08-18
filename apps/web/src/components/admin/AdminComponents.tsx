import { ReactNode } from 'react';
import { getStatusColor } from '@/lib/utils';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-gray-500 mt-1 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function StatGrid({ stats }: { stats: { label: string; value: string | number; icon?: ReactNode; color?: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((s) => (
        <div key={s.label} className="card p-5">
          <div className="flex items-center gap-3">
            {s.icon && <div className={`p-2 rounded-lg ${s.color || 'bg-primary-50 text-primary-600'}`}>{s.icon}</div>}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-xl font-bold mt-0.5">{s.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminTable({ columns, rows, emptyMessage = 'No data found' }: {
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }[];
  rows: Record<string, unknown>[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <div className="card p-12 text-center text-gray-500">{emptyMessage}</div>;
  }
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-gray-500">
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-medium whitespace-nowrap">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={(row.id as string) || i} className="border-t border-gray-100 hover:bg-gray-50">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 whitespace-nowrap">
                    {c.render ? c.render(row) : String(row[c.key] ?? '-')}
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

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${getStatusColor(status)}`}>{status}</span>;
}

export function LoadingState() {
  return <div className="text-center py-16 text-gray-500">Loading...</div>;
}

export function ActionBtn({ onClick, children, variant = 'primary' }: { onClick: () => void; children: ReactNode; variant?: 'primary' | 'danger' | 'success' }) {
  const colors = { primary: 'text-primary-600', danger: 'text-red-600', success: 'text-green-600' };
  return (
    <button onClick={onClick} className={`text-xs font-medium hover:underline ${colors[variant]}`}>
      {children}
    </button>
  );
}
