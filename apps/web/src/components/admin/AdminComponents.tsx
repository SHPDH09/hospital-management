import { ReactNode, useState } from 'react';
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
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {stats.map((s) => (
        <div key={s.label} className="group card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          {s.icon && <div className={`grid h-11 w-11 place-items-center rounded-xl ${s.color || 'bg-primary-50 text-primary-600'}`}>{s.icon}</div>}
          <p className="mt-4 text-2xl font-bold tracking-tight text-gray-900">{s.value}</p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

export function AdminTable({ columns, rows, emptyMessage = 'No data found' }: {
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode; nowrap?: boolean }[];
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
          <thead className="bg-gray-50/80">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-semibold ${c.nowrap !== false ? 'whitespace-nowrap' : ''}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={(row.id as string) || i} className="border-t border-gray-100 transition-colors hover:bg-gray-50">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 ${c.nowrap !== false ? 'whitespace-nowrap' : 'whitespace-normal'} ${c.key === 'actions' ? 'relative overflow-visible' : ''}`}
                  >
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
    <button type="button" onClick={onClick} className={`text-xs font-medium hover:underline ${colors[variant]}`}>
      {children}
    </button>
  );
}

export function DetailModal({ title, fields, onClose, actions }: {
  title: string;
  fields: { label: string; value: ReactNode }[];
  onClose: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <dl className="space-y-3 text-sm">
          {fields.map((f) => (
            <div key={f.label} className="grid grid-cols-3 gap-2">
              <dt className="text-gray-500 font-medium">{f.label}</dt>
              <dd className="col-span-2 text-gray-900 break-words">{f.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
        {actions && <div className="mt-6 flex flex-wrap gap-2 justify-end">{actions}</div>}
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{children}</div>;
}

export type EditField = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'password' | 'email' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
};

export function EditModal({ title, fields, initial = {}, submitLabel = 'Save', onClose, onSave }: {
  title: string;
  fields: EditField[];
  initial?: Record<string, unknown>;
  submitLabel?: string;
  onClose: () => void;
  onSave: (values: Record<string, unknown>) => Promise<void> | void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const f of fields) seed[f.name] = initial[f.name] == null ? '' : String(initial[f.name]);
    return seed;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (name: string, value: string) => setValues((s) => ({ ...s, [name]: value }));

  const submit = async () => {
    setError(null);
    const missing = fields.filter((f) => f.required && !String(values[f.name] ?? '').trim());
    if (missing.length > 0) {
      setError(`Please fill in: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }
    setSaving(true);
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = values[f.name];
      out[f.name] = f.type === 'number' ? (raw === '' ? null : Number(raw)) : raw;
    }
    try {
      await onSave(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {f.label}{f.required && <span className="text-red-500"> *</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea className="input w-full" rows={3} value={values[f.name]} placeholder={f.placeholder} onChange={(e) => setField(f.name, e.target.value)} />
              ) : f.type === 'select' ? (
                <select className="input w-full" value={values[f.name]} onChange={(e) => setField(f.name, e.target.value)}>
                  <option value="">Select...</option>
                  {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  className="input w-full"
                  type={f.type === 'number' ? 'number' : f.type === 'password' ? 'password' : f.type === 'email' ? 'email' : 'text'}
                  value={values[f.name]}
                  placeholder={f.placeholder}
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button className="btn-secondary text-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-primary text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving...' : submitLabel}</button>
        </div>
      </div>
    </div>
  );
}
