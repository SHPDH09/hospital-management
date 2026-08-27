import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock, ShieldCheck, Search, RotateCcw } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import {
  PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn,
  EditModal, EditField, DetailModal, RowActions,
} from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const PC_BASE = '/api/v1/admin/payment-console';
async function pcRequest<T = unknown>(path: string, body?: unknown, withAccess = false, method = 'POST'): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` };
  if (withAccess) headers['x-payment-access'] = sessionStorage.getItem('payment_access') || '';
  const res = await fetch(`${PC_BASE}/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.json().catch(() => ({ success: false, error: 'Invalid response' }));
}

function useAdminList(endpoint: string, params = '') {
  return useQuery({ queryKey: [endpoint, params], queryFn: () => api.get(`${endpoint}${params}`) });
}

type Row = Record<string, unknown>;

async function loginAs(path: string) {
  const res = await api.post<{ accessToken: string; refreshToken: string; redirectTo: string }>(path);
  if (res.success && res.data) {
    api.setTokens(res.data.accessToken, res.data.refreshToken);
    window.location.href = res.data.redirectTo;
  } else {
    alert(res.error || 'Could not log in as this user');
  }
}

async function confirmDelete(path: string, label: string, onDone: () => void) {
  if (!window.confirm(`Delete this ${label}? This action cannot be undone.`)) return;
  const res = await api.delete(path);
  if (res.success) onDone();
  else alert(res.error || 'Delete failed');
}

// ─── Organizations (Hospitals / Clinics) ─────────────────────────────────────

export function AdminHospitalsPage() {
  return <OrgListPage type="HOSPITAL" title="Hospital Management" subtitle="Manage all hospitals on the platform" />;
}

export function AdminClinicsPage() {
  return <OrgListPage type="CLINIC" title="Clinic Management" subtitle="Manage all clinics on the platform" />;
}

const ORG_EDIT_FIELDS: EditField[] = [
  { name: 'name', label: 'Name' },
  { name: 'email', label: 'Email' },
  { name: 'phone', label: 'Phone' },
  { name: 'city', label: 'City' },
  { name: 'state', label: 'State' },
  { name: 'address', label: 'Address', type: 'textarea' },
];

const ORG_CREATE_FIELDS: EditField[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'ownerName', label: 'Owner / Admin Name', required: true },
  { name: 'email', label: 'Login Email', type: 'email', required: true },
  { name: 'password', label: 'Password', type: 'password', required: true, placeholder: 'Min 8 characters' },
  { name: 'phone', label: 'Phone' },
  { name: 'city', label: 'City' },
  { name: 'state', label: 'State' },
  { name: 'address', label: 'Address', type: 'textarea' },
];

function OrgListPage({ type, title, subtitle }: { type: string; title: string; subtitle: string }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, refetch } = useAdminList('/admin/organizations', `?type=${type}&search=${search}&limit=50`);
  const entity = type === 'CLINIC' ? 'Clinic' : 'Hospital';

  const openDetails = async (row: Row) => {
    const res = await api.get(`/admin/organizations/${row.id}`);
    if (res.success && res.data) setViewing(res.data as Row);
    else alert(res.error || 'Could not load details');
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader title={title} subtitle={subtitle} actions={
        <>
          <input className="input text-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button type="button" className="btn-primary text-sm whitespace-nowrap" onClick={() => setCreating(true)}>+ Add {entity}</button>
        </>
      } />
      {isLoading ? <LoadingState /> : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'city', label: 'City' },
            { key: 'verificationStatus', label: 'Status', render: (r) => <StatusBadge status={r.verificationStatus as string} /> },
            { key: 'doctors', label: 'Doctors', render: (r) => String((r._count as { doctors?: number })?.doctors || 0) },
            { key: 'actions', label: 'Actions', nowrap: false, render: (r) => (
              <RowActions>
                <ActionBtn onClick={() => openDetails(r)}>View Details</ActionBtn>
                <ActionBtn onClick={() => setEditing(r)}>Edit</ActionBtn>
                {r.verificationStatus === 'PENDING' && (
                  <ActionBtn variant="success" onClick={() => api.patch(`/admin/organizations/${r.id}/status`, { verificationStatus: 'APPROVED', isPubliclyListed: true }).then(() => refetch())}>Approve</ActionBtn>
                )}
                {r.verificationStatus === 'APPROVED' && (
                  <ActionBtn variant="danger" onClick={() => api.patch(`/admin/organizations/${r.id}/status`, { isActive: false, verificationStatus: 'SUSPENDED' }).then(() => refetch())}>Block</ActionBtn>
                )}
                {r.verificationStatus === 'SUSPENDED' && (
                  <ActionBtn variant="success" onClick={() => api.patch(`/admin/organizations/${r.id}/status`, { isActive: true, verificationStatus: 'APPROVED' }).then(() => refetch())}>Unblock</ActionBtn>
                )}
                <ActionBtn onClick={() => loginAs(`/admin/organizations/${r.id}/impersonate`)}>Login as Admin</ActionBtn>
                <ActionBtn variant="danger" onClick={() => confirmDelete(`/admin/organizations/${r.id}`, 'organization', refetch)}>Delete</ActionBtn>
              </RowActions>
            )},
          ]}
          rows={(data?.data as Row[]) || []}
        />
      )}
      {viewing && (
        <DetailModal
          title={String(viewing.name)}
          fields={[
            { label: 'Type', value: String(viewing.type) },
            { label: 'Status', value: <StatusBadge status={String(viewing.verificationStatus)} /> },
            { label: 'Email', value: String(viewing.email || '—') },
            { label: 'Phone', value: String(viewing.phone || '—') },
            { label: 'City', value: String(viewing.city || '—') },
            { label: 'Address', value: String(viewing.address || '—') },
            { label: 'Doctors', value: String((viewing._count as { doctors?: number })?.doctors || 0) },
            { label: 'Appointments', value: String((viewing._count as { appointments?: number })?.appointments || 0) },
          ]}
          onClose={() => setViewing(null)}
          actions={<ActionBtn onClick={() => loginAs(`/admin/organizations/${viewing.id}/impersonate`)}>Login as Admin</ActionBtn>}
        />
      )}
      {editing && (
        <EditModal
          title="Edit Organization"
          fields={ORG_EDIT_FIELDS}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            const res = await api.patch(`/admin/organizations/${editing.id}`, values);
            if (!res.success) throw new Error(res.error || 'Update failed');
            setEditing(null);
            refetch();
          }}
        />
      )}
      {creating && (
        <EditModal
          title={`Add ${entity}`}
          fields={ORG_CREATE_FIELDS}
          submitLabel={`Create ${entity}`}
          onClose={() => setCreating(false)}
          onSave={async (values) => {
            const res = await api.post('/admin/organizations', { ...values, type });
            if (!res.success) throw new Error(res.error || 'Create failed');
            setCreating(false);
            refetch();
          }}
        />
      )}
    </DashboardLayout>
  );
}

// ─── Doctors ─────────────────────────────────────────────────────────────────

const DOCTOR_EDIT_FIELDS: EditField[] = [
  { name: 'fullName', label: 'Full Name' },
  { name: 'specialization', label: 'Specialization' },
  { name: 'qualification', label: 'Qualification' },
  { name: 'experience', label: 'Experience (years)', type: 'number' },
  { name: 'consultationFee', label: 'Consultation Fee', type: 'number' },
  { name: 'registrationNumber', label: 'Registration Number' },
];

export function AdminDoctorsPage() {
  const [editing, setEditing] = useState<Row | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, refetch } = useAdminList('/admin/doctors', '?limit=50');
  const { data: orgData } = useAdminList('/admin/organizations', '?limit=100');
  const orgOptions = ((orgData?.data as Row[]) || []).map((o) => ({ value: String(o.id), label: String(o.name) }));
  const doctorCreateFields: EditField[] = [
    { name: 'organizationId', label: 'Organization', type: 'select', options: orgOptions, required: true },
    { name: 'fullName', label: 'Full Name', required: true },
    { name: 'email', label: 'Login Email', type: 'email', required: true },
    { name: 'password', label: 'Password', type: 'password', required: true, placeholder: 'Min 8 characters' },
    { name: 'specialization', label: 'Specialization' },
    { name: 'qualification', label: 'Qualification' },
    { name: 'experience', label: 'Experience (years)', type: 'number' },
    { name: 'consultationFee', label: 'Consultation Fee', type: 'number' },
  ];

  const openDetails = async (row: Row) => {
    const res = await api.get(`/admin/doctors/${row.id}`);
    if (res.success && res.data) setViewing(res.data as Row);
    else alert(res.error || 'Could not load details');
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Doctor Management" subtitle="View, edit, block, impersonate or remove doctors" actions={
        <button type="button" className="btn-primary text-sm whitespace-nowrap" onClick={() => setCreating(true)}>+ Add Doctor</button>
      } />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'fullName', label: 'Name' },
          { key: 'specialization', label: 'Specialization' },
          { key: 'org', label: 'Organization', render: (r) => String((r.organization as { name?: string })?.name || '-') },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'BLOCKED'} /> },
          { key: 'actions', label: 'Actions', nowrap: false, render: (r) => (
            <RowActions>
              <ActionBtn onClick={() => openDetails(r)}>View Details</ActionBtn>
              <ActionBtn onClick={() => setEditing(r)}>Edit</ActionBtn>
              <ActionBtn variant={r.isActive ? 'danger' : 'success'} onClick={() => api.patch(`/admin/doctors/${r.id}/status`, { isActive: !r.isActive }).then(() => refetch())}>
                {r.isActive ? 'Block' : 'Unblock'}
              </ActionBtn>
              <ActionBtn onClick={() => loginAs(`/admin/doctors/${r.id}/impersonate`)}>Login as Doctor</ActionBtn>
              <ActionBtn variant="danger" onClick={() => confirmDelete(`/admin/doctors/${r.id}`, 'doctor', refetch)}>Delete</ActionBtn>
            </RowActions>
          )},
        ]} rows={(data?.data as Row[]) || []} />
      )}
      {viewing && (
        <DetailModal
          title={String(viewing.fullName)}
          fields={[
            { label: 'Email', value: String((viewing.user as { email?: string })?.email || '—') },
            { label: 'Organization', value: String((viewing.organization as { name?: string })?.name || '—') },
            { label: 'Specialization', value: String(viewing.specialization || '—') },
            { label: 'Qualification', value: String(viewing.qualification || '—') },
            { label: 'Experience', value: viewing.experience != null ? `${viewing.experience} years` : '—' },
            { label: 'Fee', value: formatCurrency(Number(viewing.consultationFee || 0)) },
            { label: 'Appointments', value: String((viewing._count as { appointments?: number })?.appointments || 0) },
            { label: 'Status', value: <StatusBadge status={(viewing.user as { isActive?: boolean })?.isActive !== false ? 'ACTIVE' : 'BLOCKED'} /> },
          ]}
          onClose={() => setViewing(null)}
        />
      )}
      {editing && (
        <EditModal title="Edit Doctor" fields={DOCTOR_EDIT_FIELDS} initial={editing} onClose={() => setEditing(null)}
          onSave={async (values) => {
            const res = await api.patch(`/admin/doctors/${editing.id}`, values);
            if (!res.success) throw new Error(res.error || 'Update failed');
            setEditing(null);
            refetch();
          }}
        />
      )}
      {creating && (
        <EditModal title="Add Doctor" fields={doctorCreateFields} submitLabel="Create Doctor" onClose={() => setCreating(false)}
          onSave={async (values) => {
            const res = await api.post('/admin/doctors', values);
            if (!res.success) throw new Error(res.error || 'Create failed');
            setCreating(false);
            refetch();
          }}
        />
      )}
    </DashboardLayout>
  );
}

// ─── Patients ────────────────────────────────────────────────────────────────

const PATIENT_EDIT_FIELDS: EditField[] = [
  { name: 'fullName', label: 'Full Name' },
  { name: 'alternatePhone', label: 'Alternate Phone' },
  { name: 'bloodGroup', label: 'Blood Group' },
  { name: 'city', label: 'City' },
  { name: 'state', label: 'State' },
  { name: 'address', label: 'Address', type: 'textarea' },
];

const PATIENT_CREATE_FIELDS: EditField[] = [
  { name: 'fullName', label: 'Full Name', required: true },
  { name: 'email', label: 'Login Email', type: 'email', required: true },
  { name: 'password', label: 'Password', type: 'password', required: true, placeholder: 'Min 8 characters' },
  { name: 'phone', label: 'Phone' },
  { name: 'city', label: 'City' },
  { name: 'state', label: 'State' },
];

export function AdminPatientsPage() {
  const [editing, setEditing] = useState<Row | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const { data, isLoading, refetch } = useAdminList('/admin/patients', '?limit=50');

  const openDetails = async (row: Row) => {
    const res = await api.get(`/admin/patients/${row.id}`);
    if (res.success && res.data) setViewing(res.data as Row);
    else alert(res.error || 'Could not load details');
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Patient Management" subtitle="View, edit, block, impersonate or remove patients" actions={
        <button type="button" className="btn-primary text-sm whitespace-nowrap" onClick={() => setCreating(true)}>+ Add Patient</button>
      } />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'fullName', label: 'Name' },
          { key: 'email', label: 'Email', render: (r) => String((r.user as { email?: string })?.email || '-') },
          { key: 'city', label: 'City' },
          { key: 'appointments', label: 'Appointments', render: (r) => String((r._count as { appointments?: number })?.appointments || 0) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={(r.user as { isActive?: boolean })?.isActive ? 'ACTIVE' : 'BLOCKED'} /> },
          { key: 'actions', label: 'Actions', nowrap: false, render: (r) => {
            const active = (r.user as { isActive?: boolean })?.isActive;
            return (
              <RowActions>
                <ActionBtn onClick={() => openDetails(r)}>View Details</ActionBtn>
                <ActionBtn onClick={() => setEditing(r)}>Edit</ActionBtn>
                <ActionBtn variant={active ? 'danger' : 'success'} onClick={() => api.patch(`/admin/patients/${r.id}/status`, { isActive: !active }).then(() => refetch())}>{active ? 'Block' : 'Unblock'}</ActionBtn>
                <ActionBtn onClick={() => loginAs(`/admin/patients/${r.id}/impersonate`)}>Login as Patient</ActionBtn>
                <ActionBtn variant="danger" onClick={() => confirmDelete(`/admin/patients/${r.id}`, 'patient', refetch)}>Delete</ActionBtn>
              </RowActions>
            );
          }},
        ]} rows={(data?.data as Row[]) || []} />
      )}
      {viewing && (
        <DetailModal
          title={String(viewing.fullName)}
          fields={[
            { label: 'Email', value: String((viewing.user as { email?: string })?.email || '—') },
            { label: 'Phone', value: String((viewing.user as { phone?: string })?.phone || '—') },
            { label: 'City', value: String(viewing.city || '—') },
            { label: 'State', value: String(viewing.state || '—') },
            { label: 'Blood Group', value: String(viewing.bloodGroup || '—') },
            { label: 'Appointments', value: String((viewing._count as { appointments?: number })?.appointments || 0) },
            { label: 'Status', value: <StatusBadge status={(viewing.user as { isActive?: boolean })?.isActive ? 'ACTIVE' : 'BLOCKED'} /> },
          ]}
          onClose={() => setViewing(null)}
        />
      )}
      {editing && (
        <EditModal title="Edit Patient" fields={PATIENT_EDIT_FIELDS} initial={editing} onClose={() => setEditing(null)}
          onSave={async (values) => {
            const res = await api.patch(`/admin/patients/${editing.id}`, values);
            if (!res.success) throw new Error(res.error || 'Update failed');
            setEditing(null);
            refetch();
          }}
        />
      )}
      {creating && (
        <EditModal title="Add Patient" fields={PATIENT_CREATE_FIELDS} submitLabel="Create Patient" onClose={() => setCreating(false)}
          onSave={async (values) => {
            const res = await api.post('/admin/patients', values);
            if (!res.success) throw new Error(res.error || 'Create failed');
            setCreating(false);
            refetch();
          }}
        />
      )}
    </DashboardLayout>
  );
}

// ─── Appointments ────────────────────────────────────────────────────────────

export function AdminAppointmentsPage() {
  const [viewing, setViewing] = useState<Row | null>(null);
  const { data, isLoading, refetch } = useAdminList('/admin/appointments', '?limit=50');

  const openDetails = async (row: Row) => {
    const res = await api.get(`/admin/appointments/${row.id}`);
    if (res.success && res.data) setViewing(res.data as Row);
    else alert(res.error || 'Could not load details');
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Appointment Management" subtitle="Platform-wide appointment visibility and control" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'date', label: 'Date', render: (r) => formatDate(r.appointmentDate as string) },
          { key: 'time', label: 'Time', render: (r) => String(r.startTime) },
          { key: 'patient', label: 'Patient', render: (r) => String((r.patient as { fullName?: string })?.fullName) },
          { key: 'doctor', label: 'Doctor', render: (r) => String((r.doctor as { fullName?: string })?.fullName) },
          { key: 'org', label: 'Organization', render: (r) => String((r.organization as { name?: string })?.name) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'actions', label: 'Actions', nowrap: false, render: (r) => (
            <RowActions>
              <ActionBtn onClick={() => openDetails(r)}>View Details</ActionBtn>
              {r.status !== 'CANCELLED' && (
                <ActionBtn variant="danger" onClick={() => api.patch(`/admin/appointments/${r.id}/status`, { status: 'CANCELLED' }).then(() => refetch())}>Cancel</ActionBtn>
              )}
            </RowActions>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
      {viewing && (
        <DetailModal
          title="Appointment Details"
          fields={[
            { label: 'Date', value: formatDate(String(viewing.appointmentDate)) },
            { label: 'Time', value: String(viewing.startTime) },
            { label: 'Patient', value: String((viewing.patient as { fullName?: string })?.fullName || '—') },
            { label: 'Doctor', value: String((viewing.doctor as { fullName?: string })?.fullName || '—') },
            { label: 'Hospital', value: String((viewing.organization as { name?: string })?.name || '—') },
            { label: 'Status', value: <StatusBadge status={String(viewing.status)} /> },
            { label: 'Type', value: String(viewing.type || 'consultation') },
            { label: 'Notes', value: String(viewing.notes || '—') },
          ]}
          onClose={() => setViewing(null)}
        />
      )}
    </DashboardLayout>
  );
}

// ─── Payments (PIN-protected Cashfree console) ───────────────────────────────

interface PaymentResult {
  id: string; orderId?: string | null; paymentId?: string | null; invoiceNumber?: string | null;
  amount: number; currency?: string; method?: string | null; status: string; liveStatus?: string | null;
  organization?: { name?: string; email?: string | null; phone?: string | null } | null; plan?: string | null;
  createdAt: string; paidAt?: string | null;
}

const SEARCH_TYPES = [
  { value: 'auto', label: 'All fields' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'orderId', label: 'Cashfree Order ID' },
  { value: 'paymentId', label: 'Cashfree Payment ID' },
  { value: 'upi', label: 'UPI ID' },
  { value: 'txn', label: 'Transaction / Invoice No.' },
];

function PaymentPinGate({ isSet, onUnlock }: { isSet: boolean; onUnlock: (token: string) => void }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!/^\d{4,6}$/.test(pin)) return setError('PIN must be 4-6 digits');
    if (!isSet && pin !== confirm) return setError('PINs do not match');
    setBusy(true);
    const res = await pcRequest<{ accessToken: string }>(isSet ? 'pin/verify' : 'pin/setup', { pin });
    setBusy(false);
    if (res.success && res.data?.accessToken) onUnlock(res.data.accessToken);
    else setError(res.error || 'Failed');
  };

  return (
    <div className="mx-auto max-w-sm">
      <div className="card p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-50 text-primary-600">
          {isSet ? <Lock className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">{isSet ? 'Enter Payment PIN' : 'Set up Payment PIN'}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {isSet ? 'This section is protected. Enter your PIN to continue.' : 'Create a 4-6 digit PIN to secure the payment console.'}
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <input className="input mt-4 text-center tracking-[0.5em]" type="password" inputMode="numeric" maxLength={6}
          placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter' && isSet) submit(); }} />
        {!isSet && (
          <input className="input mt-2 text-center tracking-[0.5em]" type="password" inputMode="numeric" maxLength={6}
            placeholder="Confirm PIN" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))} />
        )}
        <button type="button" className="btn-primary mt-4 w-full" disabled={busy} onClick={submit}>
          {busy ? 'Please wait…' : isSet ? 'Unlock' : 'Create PIN & Continue'}
        </button>
      </div>
    </div>
  );
}

export function AdminPaymentsPage() {
  const [pinLoading, setPinLoading] = useState(true);
  const [pinIsSet, setPinIsSet] = useState(false);
  const [unlocked, setUnlocked] = useState<boolean>(() => Boolean(sessionStorage.getItem('payment_access')));
  const [type, setType] = useState('auto');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PaymentResult[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    pcRequest<{ isSet: boolean }>('pin/status', undefined, false, 'GET').then((res) => {
      setPinIsSet(Boolean(res.data?.isSet));
      setPinLoading(false);
    });
  }, []);

  const onUnlock = (token: string) => { sessionStorage.setItem('payment_access', token); setUnlocked(true); setPinIsSet(true); };
  const lock = () => { sessionStorage.removeItem('payment_access'); setUnlocked(false); setResults(null); };

  const doSearch = async () => {
    setErr(null); setNote(null); setSearching(true);
    const res = await pcRequest<{ results: PaymentResult[]; note?: string }>('search', { query, type }, true);
    setSearching(false);
    if (res.success) { setResults(res.data?.results || []); setNote(res.data?.note || null); }
    else { setErr(res.error || 'Search failed'); if ((res.error || '').includes('locked')) lock(); }
  };

  const refund = async (r: PaymentResult) => {
    if (!r.orderId) return alert('No gateway order id for this record');
    const input = window.prompt(`Refund amount for order ${r.orderId} (max ${r.amount}):`, String(r.amount));
    if (!input) return;
    const res = await pcRequest('refund', { orderId: r.orderId, amount: Number(input), note: 'Admin refund' }, true);
    if (res.success) { alert('Refund initiated'); doSearch(); }
    else alert(res.error || 'Refund failed');
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Payment Console" subtitle="Search Cashfree transactions and issue refunds" actions={
        unlocked ? <button type="button" className="btn-secondary text-sm" onClick={lock}><Lock className="h-4 w-4" /> Lock</button> : undefined
      } />
      {pinLoading ? <LoadingState /> : !unlocked ? (
        <PaymentPinGate isSet={pinIsSet} onUnlock={onUnlock} />
      ) : (
        <>
          <div className="card mb-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <select className="input sm:w-56" value={type} onChange={(e) => setType(e.target.value)}>
                {SEARCH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input className="input flex-1" placeholder="Search by phone, email, Cashfree ID, UPI, transaction no…"
                value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }} />
              <button type="button" className="btn-primary text-sm" disabled={searching || query.trim().length < 2} onClick={doSearch}>
                <Search className="h-4 w-4" /> {searching ? 'Searching…' : 'Search'}
              </button>
            </div>
            {note && <p className="mt-2 text-xs text-amber-600">{note}</p>}
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          </div>
          {results && (
            results.length === 0 ? (
              <div className="card p-10 text-center text-gray-500">No transactions found</div>
            ) : (
              <AdminTable columns={[
                { key: 'orderId', label: 'Order ID', render: (r) => String((r as unknown as PaymentResult).orderId || '—') },
                { key: 'invoiceNumber', label: 'Invoice', render: (r) => String((r as unknown as PaymentResult).invoiceNumber || '—') },
                { key: 'organization', label: 'Customer', render: (r) => { const o = (r as unknown as PaymentResult).organization; return o ? `${o.name || ''}${o.email ? ` · ${o.email}` : ''}` : '—'; } },
                { key: 'amount', label: 'Amount', render: (r) => formatCurrency((r as unknown as PaymentResult).amount) },
                { key: 'status', label: 'Status', render: (r) => <StatusBadge status={(r as unknown as PaymentResult).status} /> },
                { key: 'liveStatus', label: 'Gateway (live)', render: (r) => String((r as unknown as PaymentResult).liveStatus || '—') },
                { key: 'date', label: 'Date', render: (r) => formatDate((r as unknown as PaymentResult).createdAt) },
                { key: 'actions', label: 'Actions', render: (r) => {
                  const row = r as unknown as PaymentResult;
                  return row.status === 'COMPLETED'
                    ? <ActionBtn variant="danger" onClick={() => refund(row)}><span className="inline-flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" /> Refund</span></ActionBtn>
                    : <span className="text-xs text-gray-400">—</span>;
                } },
              ]} rows={(results as unknown as Record<string, unknown>[])} />
            )
          )}
        </>
      )}
    </DashboardLayout>
  );
}
