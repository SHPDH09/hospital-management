import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, LoadingState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

const subNav = [
  { to: '/admin/emergency', label: 'Dashboard', end: true },
  { to: '/admin/emergency/mode', label: 'Emergency Mode' },
  { to: '/admin/emergency/maintenance', label: 'Maintenance' },
  { to: '/admin/emergency/modules', label: 'Module Switches' },
  { to: '/admin/emergency/payment', label: 'Payment' },
  { to: '/admin/emergency/appointment', label: 'Appointments' },
  { to: '/admin/emergency/suspensions', label: 'Suspensions' },
  { to: '/admin/emergency/users', label: 'User Access' },
  { to: '/admin/emergency/security', label: 'Security' },
  { to: '/admin/emergency/api', label: 'API Control' },
  { to: '/admin/emergency/communication', label: 'Communication' },
  { to: '/admin/emergency/file-upload', label: 'File Upload' },
  { to: '/admin/emergency/read-only', label: 'Read-Only' },
  { to: '/admin/emergency/scheduled', label: 'Scheduled' },
  { to: '/admin/emergency/announcements', label: 'Announcements' },
  { to: '/admin/emergency/recovery', label: 'Recovery' },
  { to: '/admin/emergency/logs', label: 'Audit Logs' },
];

function EmergLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Emergency Control Center" subtitle="Module-wise platform controls — never shut down everything blindly" />
      <nav className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 pb-2">
        {subNav.map((item) => {
          const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <Link key={item.to} to={item.to}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-50')}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </DashboardLayout>
  );
}

function StatusBanner({ status, statusInfo }: { status: string; statusInfo?: { label: string; icon: string; color: string } }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    gray: 'bg-gray-100 border-gray-300 text-gray-800',
  };
  const c = colors[statusInfo?.color || 'green'] || colors.green;
  return (
    <div className={cn('border rounded-xl p-5 mb-6', c)}>
      <p className="text-2xl font-bold">{statusInfo?.icon} {statusInfo?.label || status}</p>
    </div>
  );
}

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">Reason *</label>
      <textarea className="input w-full mt-1" rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Required for all emergency actions" />
    </div>
  );
}

function ConfirmModal({
  open, title, message, onConfirm, onCancel, requirePassword, password, onPasswordChange,
}: {
  open: boolean; title: string; message: string;
  onConfirm: () => void; onCancel: () => void;
  requirePassword?: boolean; password: string; onPasswordChange: (v: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h3 className="font-bold text-lg text-red-700 mb-2">⚠️ {title}</h3>
        <p className="text-sm text-gray-600 mb-4">{message}</p>
        {requirePassword && (
          <input type="password" className="input w-full mb-4" placeholder="Super Admin password" value={password} onChange={(e) => onPasswordChange(e.target.value)} />
        )}
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary text-sm" onClick={onCancel}>Cancel</button>
          <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium" onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50">
      <span className="text-sm">{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={cn('px-3 py-1 rounded-full text-xs font-medium', checked ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
        {checked ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['emergency-dash'], queryFn: () => api.get('/admin/emergency/dashboard') });
  const d = data?.data as Record<string, unknown> | undefined;
  if (isLoading) return <EmergLayout><LoadingState /></EmergLayout>;

  const activeControls = (d?.activeControls as string[]) || [];
  const affectedModules = (d?.affectedModules as string[]) || [];
  const statusInfo = d?.statusInfo as { label: string; icon: string; color: string } | undefined;

  return (
    <EmergLayout>
      <StatusBanner status={String(d?.status)} statusInfo={statusInfo} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Controls', value: activeControls.length },
          { label: 'Affected Modules', value: affectedModules.length },
          { label: 'Active Suspensions', value: d?.activeSuspensions },
          { label: 'Scheduled Maintenance', value: d?.scheduledMaintenanceCount },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-red-600">{String(s.value ?? 0)}</p>
          </div>
        ))}
      </div>
      {(d?.activatedBy || d?.reason) ? (
        <div className="card p-5 mb-6 space-y-2 text-sm">
          <h3 className="font-semibold">Current Emergency Details</h3>
          {d?.activatedBy ? <p><strong>Activated by:</strong> {String(d.activatedBy)}</p> : null}
          {d?.activatedAt ? <p><strong>Activation time:</strong> {formatDate(String(d.activatedAt))}</p> : null}
          {d?.reason ? <p><strong>Reason:</strong> {String(d.reason)}</p> : null}
          {d?.expectedResolutionAt ? <p><strong>Expected resolution:</strong> {formatDate(String(d.expectedResolutionAt))}</p> : null}
        </div>
      ) : null}
      {activeControls.length > 0 && (
        <div className="card p-5 mb-6">
          <h3 className="font-semibold mb-3">Active Emergency Controls</h3>
          <div className="flex flex-wrap gap-2">
            {activeControls.map((c) => (
              <span key={c} className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium">{c}</span>
            ))}
          </div>
        </div>
      )}
      {affectedModules.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Affected Modules</h3>
          <ul className="text-sm text-gray-600 list-disc pl-5">
            {affectedModules.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}
    </EmergLayout>
  );
}

// ─── Emergency Mode ──────────────────────────────────────────────────────────

function EmergencyModePage() {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [expectedResolution, setExpectedResolution] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['emergency-state'], queryFn: () => api.get('/admin/emergency/state') });
  const state = data?.data as Record<string, unknown> | undefined;
  const isActive = Boolean(state?.emergencyModeActive);

  const activate = async () => {
    await api.post('/admin/emergency/activate', {
      reason, confirm: true, password,
      expectedResolutionAt: expectedResolution || undefined,
    });
    setConfirmOpen(false);
    qc.invalidateQueries({ queryKey: ['emergency'] });
    qc.invalidateQueries({ queryKey: ['emergency-dash'] });
    qc.invalidateQueries({ queryKey: ['emergency-state'] });
  };

  const deactivate = async () => {
    await api.post('/admin/emergency/deactivate', { reason });
    qc.invalidateQueries({ queryKey: ['emergency'] });
    qc.invalidateQueries({ queryKey: ['emergency-dash'] });
    qc.invalidateQueries({ queryKey: ['emergency-state'] });
  };

  return (
    <EmergLayout>
      <div className="card p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Activate emergency mode to selectively disable modules. Existing critical patient/clinical access is preserved unless you explicitly disable those modules.
        </p>
        {isActive ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="font-semibold text-red-700">Emergency Mode is ACTIVE</p>
            <ReasonField value={reason} onChange={setReason} />
            <button className="btn-secondary text-sm mt-3" onClick={deactivate} disabled={reason.length < 3}>Deactivate Emergency Mode</button>
          </div>
        ) : (
          <>
            <ReasonField value={reason} onChange={setReason} />
            <div>
              <label className="text-sm font-medium">Expected Resolution Time</label>
              <input type="datetime-local" className="input w-full mt-1" value={expectedResolution} onChange={(e) => setExpectedResolution(e.target.value)} />
            </div>
            <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium" disabled={reason.length < 3}
              onClick={() => setConfirmOpen(true)}>Activate Emergency Mode</button>
          </>
        )}
      </div>
      <ConfirmModal open={confirmOpen} title="Activate Emergency Mode"
        message="This will enable emergency controls. You can selectively disable modules. Super Admin password required."
        requirePassword onConfirm={activate} onCancel={() => setConfirmOpen(false)}
        password={password} onPasswordChange={setPassword} />
    </EmergLayout>
  );
}

// ─── Module Kill Switch ──────────────────────────────────────────────────────

const MODULE_LABELS: Record<string, string> = {
  patientRegistration: 'Patient Registration',
  hospitalRegistration: 'Hospital Registration',
  clinicRegistration: 'Clinic Registration',
  doctorRegistration: 'Doctor Registration',
  appointmentBooking: 'Appointment Booking',
  onlinePayment: 'Online Payment',
  advertisement: 'Advertisement',
  messaging: 'Messaging',
  fileUpload: 'File Upload',
  publicSearch: 'Public Search',
};

function ModulesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['emergency-state'], queryFn: () => api.get('/admin/emergency/state') });
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState('');

  const state = data?.data as Record<string, unknown> | undefined;
  const stateModules = (state?.modules || {}) as Record<string, boolean>;
  const current = Object.keys(MODULE_LABELS).length ? { ...stateModules, ...modules } : modules;

  if (isLoading) return <EmergLayout><LoadingState /></EmergLayout>;

  const save = async () => {
    const patch: Record<string, boolean> = {};
    for (const key of Object.keys(MODULE_LABELS)) {
      if (current[key] !== stateModules[key]) patch[key] = current[key];
    }
    await api.put('/admin/emergency/modules', { reason, modules: patch });
    qc.invalidateQueries({ queryKey: ['emergency'] });
    setReason('');
  };

  return (
    <EmergLayout>
      <div className="card p-6">
        <p className="text-sm text-gray-500 mb-4">Toggle individual modules. Disabling payment only affects payments — not the entire platform.</p>
        <div className="border rounded-lg px-4 mb-4">
          {Object.entries(MODULE_LABELS).map(([key, label]) => (
            <Toggle key={key} label={label}
              checked={current[key] !== false}
              onChange={(v) => setModules((m) => ({ ...m, [key]: v }))} />
          ))}
        </div>
        <ReasonField value={reason} onChange={setReason} />
        <button className="btn-primary text-sm mt-4" onClick={save} disabled={reason.length < 3}>Save Module Switches</button>
      </div>
    </EmergLayout>
  );
}

// ─── Generic section with toggles ────────────────────────────────────────────

function ToggleSection({
  title, endpoint, fields, nestedKey, invertedKeys,
}: {
  title: string;
  endpoint: string;
  nestedKey?: string;
  fields: { key: string; label: string }[];
  invertedKeys?: string[];
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['emergency-state'], queryFn: () => api.get('/admin/emergency/state') });
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState('');

  const state = data?.data as Record<string, unknown> | undefined;
  const nested = nestedKey ? (state?.[nestedKey] as Record<string, boolean>) || {} : (state as Record<string, boolean>) || {};

  const isChecked = (key: string) => {
    const val = values[key] ?? nested[key];
    if (invertedKeys?.includes(key)) return Boolean(val);
    return val !== false;
  };

  if (isLoading) return <EmergLayout><LoadingState /></EmergLayout>;

  const save = async () => {
    const patch: Record<string, boolean> = {};
    for (const f of fields) {
      const val = values[f.key] ?? nested[f.key];
      if (val !== nested[f.key]) patch[f.key] = val;
    }
    const body = nestedKey ? { reason, [nestedKey]: { ...nested, ...patch } } : { reason, ...patch };
    await api.put(`/admin/emergency/${endpoint}`, body);
    qc.invalidateQueries({ queryKey: ['emergency'] });
    setReason('');
  };

  return (
    <EmergLayout>
      <div className="card p-6">
        <h2 className="font-semibold mb-4">{title}</h2>
        <div className="border rounded-lg px-4 mb-4">
          {fields.map((f) => (
            <Toggle key={f.key} label={f.label}
              checked={isChecked(f.key)}
              onChange={(v) => setValues((prev) => ({ ...prev, [f.key]: invertedKeys?.includes(f.key) ? v : v }))} />
          ))}
        </div>
        <ReasonField value={reason} onChange={setReason} />
        <button className="btn-primary text-sm mt-4" onClick={save} disabled={reason.length < 3}>Save</button>
      </div>
    </EmergLayout>
  );
}

function PaymentPage() {
  return (
    <ToggleSection title="Payment Emergency Control" endpoint="payment" nestedKey="payment"
      invertedKeys={['onlinePaymentDisabled', 'razorpayDisabled', 'stripeDisabled', 'subscriptionPurchaseDisabled', 'appointmentPaymentDisabled', 'refundProcessingRestricted']}
      fields={[
        { key: 'onlinePaymentDisabled', label: 'Disable Online Payment' },
        { key: 'razorpayDisabled', label: 'Disable Razorpay' },
        { key: 'stripeDisabled', label: 'Disable Stripe' },
        { key: 'subscriptionPurchaseDisabled', label: 'Disable Subscription Purchase' },
        { key: 'appointmentPaymentDisabled', label: 'Disable Appointment Payment' },
        { key: 'refundProcessingRestricted', label: 'Restrict Refund Processing' },
        { key: 'backupGatewayEnabled', label: 'Enable Backup Gateway' },
      ]} />
  );
}

function AppointmentPage() {
  const qc = useQueryClient();
  const { isLoading } = useQuery({ queryKey: ['emergency-state'], queryFn: () => api.get('/admin/emergency/state') });
  const [form, setForm] = useState({ newAppointmentsDisabled: false, reschedulingDisabled: false, cancellationDisabled: false });
  const [reason, setReason] = useState('');

  if (isLoading) return <EmergLayout><LoadingState /></EmergLayout>;

  const save = async () => {
    await api.put('/admin/emergency/appointment', { reason, appointment: form });
    qc.invalidateQueries({ queryKey: ['emergency'] });
  };

  return (
    <EmergLayout>
      <div className="card p-6">
        <p className="text-sm text-gray-500 mb-4">Existing appointments are never auto-deleted or cancelled.</p>
        <div className="border rounded-lg px-4 mb-4">
          <Toggle label="Disable New Appointments" checked={!form.newAppointmentsDisabled}
            onChange={(v) => setForm((f) => ({ ...f, newAppointmentsDisabled: !v }))} />
          <Toggle label="Disable Rescheduling" checked={!form.reschedulingDisabled}
            onChange={(v) => setForm((f) => ({ ...f, reschedulingDisabled: !v }))} />
          <Toggle label="Disable Cancellation" checked={!form.cancellationDisabled}
            onChange={(v) => setForm((f) => ({ ...f, cancellationDisabled: !v }))} />
        </div>
        <ReasonField value={reason} onChange={setReason} />
        <button className="btn-primary text-sm mt-4" onClick={save} disabled={reason.length < 3}>Save</button>
      </div>
    </EmergLayout>
  );
}

function MaintenancePage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['emergency-state'], queryFn: () => api.get('/admin/emergency/state') });
  const state = data?.data as Record<string, unknown> | undefined;
  const [form, setForm] = useState({
    maintenanceMode: false, maintenanceType: 'full', maintenanceMessage: '', reason: '', password: '',
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const save = async () => {
    await api.put('/admin/emergency/maintenance', { ...form, confirm: true });
    setConfirmOpen(false);
    qc.invalidateQueries({ queryKey: ['emergency'] });
  };

  return (
    <EmergLayout>
      <div className="card p-6 space-y-4">
        <Toggle label="Maintenance Mode" checked={form.maintenanceMode}
          onChange={(v) => setForm((f) => ({ ...f, maintenanceMode: v }))} />
        <div>
          <label className="text-sm font-medium">Maintenance Type</label>
          <select className="input w-full mt-1" value={form.maintenanceType}
            onChange={(e) => setForm((f) => ({ ...f, maintenanceType: e.target.value }))}>
            <option value="full">Full Maintenance — entire public platform unavailable</option>
            <option value="partial">Partial Maintenance — selected modules only</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Maintenance Message</label>
          <textarea className="input w-full mt-1" rows={2} value={form.maintenanceMessage}
            onChange={(e) => setForm((f) => ({ ...f, maintenanceMessage: e.target.value }))}
            placeholder={String(state?.maintenanceMessage || 'We are currently performing scheduled maintenance.')} />
        </div>
        <ReasonField value={form.reason} onChange={(v) => setForm((f) => ({ ...f, reason: v }))} />
        <button className="btn-primary text-sm" disabled={form.reason.length < 3}
          onClick={() => form.maintenanceType === 'full' && form.maintenanceMode ? setConfirmOpen(true) : save()}>
          Save Maintenance Settings
        </button>
      </div>
      <ConfirmModal open={confirmOpen} title="Enable Full Maintenance"
        message="The entire public platform will be unavailable. Super Admin password required."
        requirePassword onConfirm={save} onCancel={() => setConfirmOpen(false)}
        password={form.password} onPasswordChange={(v) => setForm((f) => ({ ...f, password: v }))} />
    </EmergLayout>
  );
}

function SuspensionsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['emergency-suspensions'], queryFn: () => api.get('/admin/emergency/suspensions') });
  const [form, setForm] = useState({
    type: 'ORGANIZATION', targetId: '', reason: 'SECURITY_ISSUE' as string, reasonNotes: '', appointmentResolution: 'none',
  });
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name?: string; fullName?: string }[]>([]);

  const search = async () => {
    const ep = form.type === 'ORGANIZATION' ? 'organizations' : form.type === 'DOCTOR' ? 'doctors' : 'users';
    const res = await api.get(`/admin/emergency/${ep}/search?q=${searchQ}`);
    setSearchResults((res.data as typeof searchResults) || []);
  };

  const suspend = async () => {
    await api.post('/admin/emergency/suspensions', form);
    qc.invalidateQueries({ queryKey: ['emergency-suspensions'] });
    setForm((f) => ({ ...f, targetId: '', reasonNotes: '' }));
  };

  const lift = async (id: string) => {
    const reason = prompt('Reason for lifting suspension:');
    if (!reason || reason.length < 3) return;
    await api.post(`/admin/emergency/suspensions/${id}/lift`, { reason });
    qc.invalidateQueries({ queryKey: ['emergency-suspensions'] });
  };

  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <EmergLayout>
      <div className="card p-6 mb-6 space-y-3">
        <h3 className="font-semibold">Emergency Suspend</h3>
        <select className="input w-full" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
          <option value="ORGANIZATION">Hospital / Clinic</option>
          <option value="DOCTOR">Doctor</option>
          <option value="USER">User / Patient</option>
        </select>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="Search by name..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
          <button className="btn-secondary text-sm" onClick={search}>Search</button>
        </div>
        {searchResults.length > 0 && (
          <div className="border rounded-lg max-h-40 overflow-y-auto">
            {searchResults.map((r) => (
              <button key={r.id} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                onClick={() => { setForm((f) => ({ ...f, targetId: r.id })); setSearchResults([]); }}>
                {r.name || r.fullName || r.id}
              </button>
            ))}
          </div>
        )}
        <select className="input w-full" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}>
          {['SECURITY_ISSUE', 'VERIFICATION_ISSUE', 'POLICY_VIOLATION', 'FRAUD_SUSPICION', 'TECHNICAL_ISSUE', 'OTHER'].map((r) => (
            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <textarea className="input w-full" rows={2} placeholder="Reason details (required)" value={form.reasonNotes}
          onChange={(e) => setForm((f) => ({ ...f, reasonNotes: e.target.value }))} />
        <select className="input w-full" value={form.appointmentResolution} onChange={(e) => setForm((f) => ({ ...f, appointmentResolution: e.target.value }))}>
          <option value="none">No appointment action</option>
          <option value="reassign">Reassign existing appointments</option>
          <option value="cancel">Cancel existing appointments</option>
          <option value="reschedule">Reschedule existing appointments</option>
        </select>
        <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm" disabled={!form.targetId || form.reasonNotes.length < 3}
          onClick={suspend}>Emergency Suspend</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'type', label: 'Type' },
          { key: 'targetName', label: 'Target' },
          { key: 'reason', label: 'Reason' },
          { key: 'suspendedAt', label: 'Suspended', render: (r) => formatDate(String(r.suspendedAt)) },
          { key: 'actions', label: '', render: (r) => (
            <button className="text-sm text-primary-600" onClick={() => lift(String(r.id))}>Lift</button>
          )},
        ]} rows={rows} emptyMessage="No active suspensions" />
      )}
    </EmergLayout>
  );
}

function UsersPage() {
  const [q, setQ] = useState('');
  const [reason, setReason] = useState('');
  const { data, refetch } = useQuery({
    queryKey: ['emergency-users', q],
    queryFn: () => api.get(`/admin/emergency/users/search?q=${q}`),
    enabled: q.length >= 2,
  });
  const users = (data?.data as Record<string, unknown>[]) || [];

  const action = async (userId: string, type: 'block' | 'unblock' | 'force-logout') => {
    if (reason.length < 3) return;
    await api.post(`/admin/emergency/users/${userId}/${type === 'block' ? 'block' : type === 'unblock' ? 'unblock' : 'force-logout'}`, { reason });
    refetch();
  };

  return (
    <EmergLayout>
      <div className="card p-6 space-y-4">
        <input className="input w-full" placeholder="Search user by email..." value={q} onChange={(e) => setQ(e.target.value)} />
        <ReasonField value={reason} onChange={setReason} />
        {users.map((u) => (
          <div key={String(u.id)} className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <p className="font-medium text-sm">{String(u.email)}</p>
              <p className="text-xs text-gray-500">{String(u.role)} · {u.isActive ? 'Active' : 'Blocked'}</p>
            </div>
            <div className="flex gap-2">
              {u.isActive ? (
                <button className="text-xs text-red-600" onClick={() => action(String(u.id), 'block')}>Block</button>
              ) : (
                <button className="text-xs text-green-600" onClick={() => action(String(u.id), 'unblock')}>Unblock</button>
              )}
              <button className="text-xs text-gray-600" onClick={() => action(String(u.id), 'force-logout')}>Force Logout</button>
            </div>
          </div>
        ))}
      </div>
    </EmergLayout>
  );
}

function SecurityPage() {
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [action, setAction] = useState<'all' | 'admins'>('all');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['emergency-state'], queryFn: () => api.get('/admin/emergency/state') });
  const [values, setValues] = useState<Record<string, boolean>>({});

  const security = ((data?.data as Record<string, unknown>)?.security || {}) as Record<string, boolean>;

  const saveSecurity = async () => {
    const patch: Record<string, boolean> = {};
    for (const key of ['disableNewRegistrations', 'disableApiAccess', 'require2fa']) {
      if (values[key] !== undefined && values[key] !== security[key]) patch[key] = values[key];
    }
    await api.put('/admin/emergency/security', { reason, security: { ...security, ...patch }, password });
    qc.invalidateQueries({ queryKey: ['emergency'] });
  };

  const execute = async () => {
    const ep = action === 'all' ? '/admin/emergency/security/force-logout-all' : '/admin/emergency/security/force-logout-admins';
    await api.post(ep, { reason, confirm: true, password });
    setConfirmOpen(false);
  };

  if (isLoading) return <EmergLayout><LoadingState /></EmergLayout>;

  return (
    <EmergLayout>
      <div className="card p-6 mb-6">
        <h2 className="font-semibold mb-4">Security Settings</h2>
        <div className="border rounded-lg px-4 mb-4">
          {[
            { key: 'disableNewRegistrations', label: 'Disable New Registrations' },
            { key: 'disableApiAccess', label: 'Disable API Access' },
            { key: 'require2fa', label: 'Require 2FA' },
          ].map((f) => (
            <Toggle key={f.key} label={f.label}
              checked={values[f.key] ?? security[f.key] ?? false}
              onChange={(v) => setValues((p) => ({ ...p, [f.key]: v }))} />
          ))}
        </div>
        <ReasonField value={reason} onChange={setReason} />
        <button className="btn-primary text-sm mt-4" onClick={saveSecurity} disabled={reason.length < 3}>Save Security Settings</button>
      </div>
      <div className="card p-6 space-y-3">
        <h3 className="font-semibold text-red-700">High-Risk Actions</h3>
        <p className="text-sm text-gray-500">Force logout requires Super Admin password and is logged permanently.</p>
        <div className="flex gap-2">
          <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm" disabled={reason.length < 3}
            onClick={() => { setAction('all'); setConfirmOpen(true); }}>Force Logout All Users</button>
          <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm" disabled={reason.length < 3}
            onClick={() => { setAction('admins'); setConfirmOpen(true); }}>Force Logout Admins</button>
        </div>
      </div>
      <ConfirmModal open={confirmOpen}
        title={action === 'all' ? 'Force Logout All Users' : 'Force Logout All Admins'}
        message="This will immediately revoke all active sessions. This action cannot be undone."
        requirePassword onConfirm={execute} onCancel={() => setConfirmOpen(false)}
        password={password} onPasswordChange={setPassword} />
    </EmergLayout>
  );
}

function RecoveryPage() {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [keepOff, setKeepOff] = useState<string[]>([]);

  const restore = async (all: boolean) => {
    await api.post('/admin/emergency/recovery', { reason, restoreAll: all, keepOff });
    qc.invalidateQueries({ queryKey: ['emergency'] });
  };

  return (
    <EmergLayout>
      <div className="card p-6 space-y-4">
        <p className="text-sm text-gray-600">Restore services after emergency resolution. Choose to restore all or keep specific modules off.</p>
        <div>
          <p className="text-sm font-medium mb-2">Keep OFF after recovery:</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(MODULE_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={keepOff.includes(key)}
                  onChange={(e) => setKeepOff((prev) => e.target.checked ? [...prev, key] : prev.filter((k) => k !== key))} />
                {label}
              </label>
            ))}
          </div>
        </div>
        <ReasonField value={reason} onChange={setReason} />
        <div className="flex gap-2">
          <button className="btn-primary text-sm" disabled={reason.length < 3} onClick={() => restore(true)}>Restore All Services</button>
          <button className="btn-secondary text-sm" disabled={reason.length < 3} onClick={() => restore(false)}>Restore Selected</button>
        </div>
      </div>
    </EmergLayout>
  );
}

function AnnouncementsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['emergency-announcements'], queryFn: () => api.get('/admin/emergency/announcements') });
  const [form, setForm] = useState({
    title: '', message: '', severity: 'WARNING', reason: '',
    displayLocations: ['website'], affectedServices: [] as string[],
  });

  const save = async () => {
    await api.post('/admin/emergency/announcements', form);
    qc.invalidateQueries({ queryKey: ['emergency-announcements'] });
    setForm({ title: '', message: '', severity: 'WARNING', reason: '', displayLocations: ['website'], affectedServices: [] });
  };

  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <EmergLayout>
      <div className="card p-6 mb-6 space-y-3">
        <h3 className="font-semibold">Create Emergency Announcement</h3>
        <input className="input w-full" placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <textarea className="input w-full" rows={3} placeholder="Message — e.g. We are experiencing technical difficulties..."
          value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
        <select className="input w-full" value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
          <option value="INFO">Info</option>
          <option value="WARNING">Warning</option>
          <option value="CRITICAL">Critical</option>
        </select>
        <div className="flex flex-wrap gap-3 text-sm">
          {['website', 'patient_dashboard', 'hospital_crm', 'mobile_app'].map((loc) => (
            <label key={loc} className="flex items-center gap-1">
              <input type="checkbox" checked={form.displayLocations.includes(loc)}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  displayLocations: e.target.checked ? [...f.displayLocations, loc] : f.displayLocations.filter((l) => l !== loc),
                }))} />
              {loc.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
        <ReasonField value={form.reason} onChange={(v) => setForm((f) => ({ ...f, reason: v }))} />
        <button className="btn-primary text-sm" onClick={save} disabled={!form.title || !form.message || form.reason.length < 3}>Publish Announcement</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'title', label: 'Title' },
          { key: 'severity', label: 'Severity' },
          { key: 'isActive', label: 'Active', render: (r) => r.isActive ? 'Yes' : 'No' },
          { key: 'startsAt', label: 'Start', render: (r) => formatDate(String(r.startsAt)) },
        ]} rows={rows} />
      )}
    </EmergLayout>
  );
}

function maintenanceRowStatus(row: Record<string, unknown>): { label: string; className: string } {
  if (!row.isActive) return { label: 'Cancelled', className: 'bg-gray-100 text-gray-600' };
  const now = Date.now();
  const start = new Date(String(row.startAt)).getTime();
  const end = new Date(String(row.endAt)).getTime();
  if (now >= start && now <= end) return { label: 'Active Now', className: 'bg-red-100 text-red-700' };
  if (now < start) return { label: 'Upcoming', className: 'bg-amber-100 text-amber-800' };
  return { label: 'Completed', className: 'bg-green-100 text-green-700' };
}

function ScheduledPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['emergency-scheduled'], queryFn: () => api.get('/admin/emergency/scheduled-maintenance') });
  const [form, setForm] = useState({
    title: '', description: '', maintenanceType: 'full', startAt: '', endAt: '', reason: '',
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.post('/admin/emergency/scheduled-maintenance', form);
      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Failed to schedule maintenance' });
        return;
      }
      qc.invalidateQueries({ queryKey: ['emergency-scheduled'] });
      qc.invalidateQueries({ queryKey: ['platform-status'] });
      setFeedback({
        type: 'success',
        message: 'Maintenance scheduled. All active users will receive an in-app notification, and a banner will appear on every dashboard and the homepage.',
      });
      setForm({ title: '', description: '', maintenanceType: 'full', startAt: '', endAt: '', reason: '' });
    } catch {
      setFeedback({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    if (cancelReason.length < 3) return;
    await api.delete(`/admin/emergency/scheduled-maintenance/${id}`, { reason: cancelReason });
    setCancelReason('');
    qc.invalidateQueries({ queryKey: ['emergency-scheduled'] });
    qc.invalidateQueries({ queryKey: ['platform-status'] });
    setFeedback({ type: 'success', message: 'Scheduled maintenance cancelled.' });
  };

  const rows = (data?.data as Record<string, unknown>[]) || [];
  const canSubmit = form.title.trim().length > 0 && form.startAt && form.endAt && form.reason.length >= 3;

  return (
    <EmergLayout>
      <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4 mb-6 text-sm text-blue-900">
        <p className="font-semibold">How notifications work</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-blue-800/90">
          <li>All active users receive an in-app notification when maintenance is scheduled.</li>
          <li>Admin, CRM, and Patient dashboards show a professional banner with the schedule.</li>
          <li>Visitors on the homepage see a popup and top notice before maintenance begins.</li>
          <li>Maintenance mode activates automatically when the scheduled window starts.</li>
        </ul>
      </div>

      {feedback && (
        <div className={cn(
          'mb-6 rounded-xl border px-4 py-3 text-sm',
          feedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800',
        )}>
          {feedback.message}
        </div>
      )}

      <div className="card p-6 mb-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Schedule Maintenance</h3>
          <p className="text-sm text-gray-500 mt-1">Plan downtime in advance and notify every dashboard automatically.</p>
        </div>
        <input className="input w-full" placeholder="Title — e.g. Database Upgrade" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <textarea className="input w-full" rows={3} placeholder="Description shown to users — e.g. We are upgrading our servers for better performance. Some services may be unavailable."
          value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        <select className="input w-full" value={form.maintenanceType} onChange={(e) => setForm((f) => ({ ...f, maintenanceType: e.target.value }))}>
          <option value="full">Full Platform Maintenance</option>
          <option value="partial">Partial Module Maintenance</option>
        </select>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500">Start (IST)</label>
            <input type="datetime-local" className="input w-full mt-1" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500">End (IST)</label>
            <input type="datetime-local" className="input w-full mt-1" value={form.endAt} onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))} />
          </div>
        </div>
        <ReasonField value={form.reason} onChange={(v) => setForm((f) => ({ ...f, reason: v }))} />
        <button className="btn-primary text-sm" onClick={save} disabled={!canSubmit || saving}>
          {saving ? 'Scheduling…' : 'Schedule & Notify All Users'}
        </button>
      </div>

      {isLoading ? <LoadingState /> : (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Scheduled Windows</h3>
          <AdminTable columns={[
            { key: 'title', label: 'Title' },
            { key: 'status', label: 'Status', render: (r) => {
              const s = maintenanceRowStatus(r);
              return <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', s.className)}>{s.label}</span>;
            }},
            { key: 'maintenanceType', label: 'Type', render: (r) => r.maintenanceType === 'full' ? 'Full' : 'Partial' },
            { key: 'startAt', label: 'Start', render: (r) => formatDate(String(r.startAt)) },
            { key: 'endAt', label: 'End', render: (r) => formatDate(String(r.endAt)) },
            { key: 'actions', label: '', render: (r) => r.isActive && maintenanceRowStatus(r).label !== 'Completed' ? (
              <button type="button" className="text-xs font-medium text-red-600 hover:text-red-800"
                onClick={() => cancel(String(r.id))} disabled={cancelReason.length < 3}>
                Cancel
              </button>
            ) : null },
          ]} rows={rows} emptyMessage="No maintenance windows scheduled yet" />
          {rows.some((r) => r.isActive) && (
            <ReasonField value={cancelReason} onChange={setCancelReason} />
          )}
        </div>
      )}
    </EmergLayout>
  );
}

function LogsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['emergency-logs'], queryFn: () => api.get('/admin/emergency/logs?limit=100') });
  const logs = (data?.data as Record<string, unknown>[]) || [];

  return (
    <EmergLayout>
      <p className="text-sm text-gray-500 mb-4">Immutable emergency audit log. Entries cannot be edited or deleted.</p>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'createdAt', label: 'Date/Time', render: (r) => formatDate(String(r.createdAt)) },
          { key: 'action', label: 'Action' },
          { key: 'performedByEmail', label: 'Performed By', render: (r) => String(r.performedByEmail || 'System') },
          { key: 'reason', label: 'Reason' },
          { key: 'affectedScope', label: 'Affected' },
        ]} rows={logs} emptyMessage="No emergency actions logged yet" />
      )}
    </EmergLayout>
  );
}

function FileUploadPage() {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const { data } = useQuery({ queryKey: ['emergency-state'], queryFn: () => api.get('/admin/emergency/state') });
  const modules = (data?.data as Record<string, unknown>)?.modules as Record<string, boolean> | undefined;
  const enabled = modules?.fileUpload !== false;

  const toggle = async () => {
    await api.put('/admin/emergency/file-upload', { reason, enabled: !enabled });
    qc.invalidateQueries({ queryKey: ['emergency'] });
  };

  return (
    <EmergLayout>
      <div className="card p-6">
        <p className="text-sm text-gray-500 mb-4">Existing files remain safe. Only new uploads are blocked when disabled.</p>
        <Toggle label="File Upload" checked={enabled} onChange={() => {}} />
        <p className="text-sm mt-2">{enabled ? 'Uploads are allowed' : 'File uploads are temporarily unavailable.'}</p>
        <ReasonField value={reason} onChange={setReason} />
        <button className="btn-primary text-sm mt-4" onClick={toggle} disabled={reason.length < 3}>
          {enabled ? 'Disable File Upload' : 'Enable File Upload'}
        </button>
      </div>
    </EmergLayout>
  );
}

function ReadOnlyPage() {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['emergency-state'], queryFn: () => api.get('/admin/emergency/state') });
  const readOnly = Boolean((data?.data as Record<string, unknown>)?.readOnlyMode);

  const toggle = async () => {
    await api.put('/admin/emergency/read-only', { reason, readOnlyMode: !readOnly, password });
    setConfirmOpen(false);
    qc.invalidateQueries({ queryKey: ['emergency'] });
  };

  return (
    <EmergLayout>
      <div className="card p-6">
        <p className="text-sm text-gray-500 mb-4">Users can view data but add/edit/delete/payment/booking are temporarily disabled.</p>
        <Toggle label="Read-Only Mode" checked={readOnly} onChange={() => {}} />
        <ReasonField value={reason} onChange={setReason} />
        <button className="btn-primary text-sm mt-4" disabled={reason.length < 3}
          onClick={() => !readOnly ? setConfirmOpen(true) : toggle()}>
          {readOnly ? 'Disable Read-Only Mode' : 'Enable Read-Only Mode'}
        </button>
      </div>
      <ConfirmModal open={confirmOpen} title="Enable Read-Only Mode"
        message="All write operations will be blocked platform-wide."
        requirePassword onConfirm={toggle} onCancel={() => setConfirmOpen(false)}
        password={password} onPasswordChange={setPassword} />
    </EmergLayout>
  );
}

function ApiPage() {
  return (
    <ToggleSection title="API Emergency Control" endpoint="api" nestedKey="api"
      fields={[
        { key: 'appointmentApi', label: 'Appointment API' },
        { key: 'paymentApi', label: 'Payment API' },
        { key: 'searchApi', label: 'Search API' },
        { key: 'webhookApi', label: 'Webhook API' },
        { key: 'registrationApi', label: 'Registration API' },
      ]} />
  );
}

function CommunicationPage() {
  return (
    <ToggleSection title="Communication Emergency" endpoint="communication" nestedKey="communication"
      fields={[
        { key: 'email', label: 'Email' },
        { key: 'sms', label: 'SMS' },
        { key: 'whatsapp', label: 'WhatsApp' },
        { key: 'push', label: 'Push Notifications' },
      ]} />
  );
}

export function AdminEmergencyPage() {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="mode" element={<EmergencyModePage />} />
      <Route path="maintenance" element={<MaintenancePage />} />
      <Route path="modules" element={<ModulesPage />} />
      <Route path="payment" element={<PaymentPage />} />
      <Route path="appointment" element={<AppointmentPage />} />
      <Route path="suspensions" element={<SuspensionsPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="security" element={<SecurityPage />} />
      <Route path="api" element={<ApiPage />} />
      <Route path="communication" element={<CommunicationPage />} />
      <Route path="file-upload" element={<FileUploadPage />} />
      <Route path="read-only" element={<ReadOnlyPage />} />
      <Route path="scheduled" element={<ScheduledPage />} />
      <Route path="announcements" element={<AnnouncementsPage />} />
      <Route path="recovery" element={<RecoveryPage />} />
      <Route path="logs" element={<LogsPage />} />
      <Route path="*" element={<Navigate to="/admin/emergency" replace />} />
    </Routes>
  );
}
