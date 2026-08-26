import { ReactNode, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, Ban, LogIn, ShieldCheck } from 'lucide-react';

export type AdminRowActionsProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  onBlock?: () => void;
  onUnblock?: () => void;
  isBlocked?: boolean;
  onLoginAs?: () => void;
  loginAsLabel?: string;
  extra?: ReactNode;
  disabled?: boolean;
};

export function AdminRowActions({
  onEdit,
  onDelete,
  onBlock,
  onUnblock,
  isBlocked,
  onLoginAs,
  loginAsLabel = 'Login as Admin',
  extra,
  disabled,
}: AdminRowActionsProps) {
  const [open, setOpen] = useState(false);

  const items: { key: string; label: string; icon: ReactNode; onClick: () => void; className?: string }[] = [];

  if (onEdit) {
    items.push({
      key: 'edit',
      label: 'Edit',
      icon: <Pencil className="h-3.5 w-3.5" />,
      onClick: () => { setOpen(false); onEdit(); },
    });
  }

  if (isBlocked && onUnblock) {
    items.push({
      key: 'unblock',
      label: 'Unblock',
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      onClick: () => { setOpen(false); onUnblock(); },
      className: 'text-green-700 hover:bg-green-50',
    });
  } else if (onBlock) {
    items.push({
      key: 'block',
      label: 'Block',
      icon: <Ban className="h-3.5 w-3.5" />,
      onClick: () => { setOpen(false); onBlock(); },
      className: 'text-orange-700 hover:bg-orange-50',
    });
  }

  if (onLoginAs) {
    items.push({
      key: 'login',
      label: loginAsLabel,
      icon: <LogIn className="h-3.5 w-3.5" />,
      onClick: () => { setOpen(false); onLoginAs(); },
      className: 'text-primary-700 hover:bg-primary-50',
    });
  }

  if (onDelete) {
    items.push({
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      onClick: () => { setOpen(false); onDelete(); },
      className: 'text-red-700 hover:bg-red-50',
    });
  }

  if (items.length === 0 && !extra) return null;

  return (
    <div className="relative inline-flex items-center gap-2">
      {extra}
      {items.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1 lg:hidden">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={disabled}
                onClick={item.onClick}
                className={`inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium ${item.className || 'text-gray-700 hover:bg-gray-50'} disabled:opacity-50`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>

          <div className="hidden lg:block">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Actions
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      disabled={disabled}
                      onClick={item.onClick}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-gray-50 ${item.className || 'text-gray-700'} disabled:opacity-50`}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type FieldDef = {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'number';
  required?: boolean;
};

export function AdminEditModal({
  title,
  fields,
  values,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  title: string;
  fields: FieldDef[];
  values: Record<string, string | number>;
  onChange: (key: string, value: string) => void;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              <input
                type={field.type || 'text'}
                className="input w-full"
                required={field.required}
                value={values[field.key] ?? ''}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
