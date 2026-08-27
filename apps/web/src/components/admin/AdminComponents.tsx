import { ReactNode, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getStatusColor } from '@/lib/utils';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 h-1 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatGrid({ stats }: { stats: { label: string; value: string | number; icon?: ReactNode; color?: string }[] }) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="admin-card-elevated group p-5">
          {s.icon && (
            <div className={`grid h-11 w-11 place-items-center rounded-xl ${s.color || 'bg-indigo-50 text-indigo-600'}`}>
              {s.icon}
            </div>
          )}
          <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900">{s.value}</p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
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
    return (
      <div className="admin-card p-12 text-center">
        <p className="text-sm font-medium text-slate-500">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="admin-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40">
            <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3.5 ${c.nowrap !== false ? 'whitespace-nowrap' : ''}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={(row.id as string) || i} className="transition-colors hover:bg-indigo-50/30">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3.5 text-slate-700 ${c.nowrap !== false ? 'whitespace-nowrap' : 'whitespace-normal'} ${c.key === 'actions' ? 'relative overflow-visible' : ''}`}
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
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-500">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      <p className="text-sm font-medium">Loading...</p>
    </div>
  );
}

export function ActionBtn({ onClick, children, variant = 'primary' }: { onClick: () => void; children: ReactNode; variant?: 'primary' | 'danger' | 'success' }) {
  const styles = {
    primary: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 ring-indigo-200/60',
    danger: 'text-red-600 bg-red-50 hover:bg-red-100 ring-red-200/60',
    success: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 ring-emerald-200/60',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 transition-colors ${styles[variant]}`}
    >
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="admin-card w-full max-h-[85vh] max-w-lg overflow-y-auto p-6 shadow-2xl shadow-indigo-900/10" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 h-1 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
        <h3 className="mb-4 text-lg font-bold text-slate-900">{title}</h3>
        <dl className="space-y-3 rounded-xl bg-slate-50/80 p-4 text-sm ring-1 ring-slate-100">
          {fields.map((f) => (
            <div key={f.label} className="grid grid-cols-3 gap-2">
              <dt className="font-semibold text-slate-500">{f.label}</dt>
              <dd className="col-span-2 break-words text-slate-900">{f.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
        {actions && <div className="mt-6 flex flex-wrap justify-end gap-2">{actions}</div>}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="admin-card w-full max-w-md p-6 shadow-2xl shadow-indigo-900/10" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 h-1 w-10 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
        <h3 className="mb-4 text-lg font-bold text-slate-900">{title}</h3>
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">{error}</p>}
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {fields.map((f) => (
            <div key={f.name}>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                {f.label}{f.required && <span className="text-red-500"> *</span>}
              </label>
              {f.type === 'textarea' ? (
                <textarea className="input w-full focus:border-indigo-500 focus:ring-indigo-500" rows={3} value={values[f.name]} placeholder={f.placeholder} onChange={(e) => setField(f.name, e.target.value)} />
              ) : f.type === 'select' ? (
                <select className="input w-full focus:border-indigo-500 focus:ring-indigo-500" value={values[f.name]} onChange={(e) => setField(f.name, e.target.value)}>
                  <option value="">Select...</option>
                  {(f.options || []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  className="input w-full focus:border-indigo-500 focus:ring-indigo-500"
                  type={f.type === 'number' ? 'number' : f.type === 'password' ? 'password' : f.type === 'email' ? 'email' : 'text'}
                  value={values[f.name]}
                  placeholder={f.placeholder}
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary text-sm" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-admin text-sm" onClick={submit} disabled={saving}>{saving ? 'Saving...' : submitLabel}</button>
        </div>
      </div>
    </div>
  );
}
