import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Lock, ShieldCheck, Search, RotateCcw } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { handleImpersonate } from './AdminDashboard';
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

// ─── Organizations (Hospitals / Clinics) ─────────────────────────────────────

export function AdminHospitalsPage() {
  return <OrgListPage type="HOSPITAL" title="Hospital Management" subtitle="Manage all hospitals on the platform" />;
}

export function AdminClinicsPage() {
  return <OrgListPage type="CLINIC" title="Clinic Management" subtitle="Manage all clinics on the platform" />;
}

function OrgListPage({ type, title, subtitle }: { type: string; title: string; subtitle: string }) {
  const [search, setSearch] = useState('');
  const { data, isLoading, refetch } = useAdminList('/admin/organizations', `?type=${type}&search=${search}&limit=50`);

  return (
    <DashboardLayout portal="admin">
      <PageHeader title={title} subtitle={subtitle} actions={
        <input className="input text-sm" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
      } />
      {isLoading ? <LoadingState /> : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'city', label: 'City' },
            { key: 'verificationStatus', label: 'Status', render: (r) => <StatusBadge status={r.verificationStatus as string} /> },
            { key: 'doctors', label: 'Doctors', render: (r) => String((r._count as { doctors?: number })?.doctors || 0) },
            { key: 'actions', label: 'Actions', render: (r) => (
              <div className="flex flex-wrap gap-2">
                {r.verificationStatus === 'PENDING' && (
                  <ActionBtn variant="success" onClick={() => api.patch(`/admin/organizations/${r.id}/status`, { verificationStatus: 'APPROVED', isPubliclyListed: true }).then(() => refetch())}>Approve</ActionBtn>
                )}
                {r.verificationStatus === 'APPROVED' && (
                  <ActionBtn variant="danger" onClick={() => api.patch(`/admin/organizations/${r.id}/status`, { isActive: false, verificationStatus: 'SUSPENDED' }).then(() => refetch())}>Suspend</ActionBtn>
                )}
                {r.verificationStatus === 'SUSPENDED' && (
                  <ActionBtn variant="success" onClick={() => api.patch(`/admin/organizations/${r.id}/status`, { isActive: true, verificationStatus: 'APPROVED' }).then(() => refetch())}>Activate</ActionBtn>
                )}
                <ActionBtn onClick={() => handleImpersonate(r.id as string)}>Login as Admin</ActionBtn>
              </div>
            )},
          ]}
          rows={(data?.data as Record<string, unknown>[]) || []}
        />
      )}
    </DashboardLayout>
  );
}

// ─── Doctors ─────────────────────────────────────────────────────────────────

export function AdminDoctorsPage() {
  const { data, isLoading, refetch } = useAdminList('/admin/doctors', '?limit=50');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Doctor Management" subtitle="Approve, verify, suspend doctors platform-wide" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'fullName', label: 'Name' },
          { key: 'specialization', label: 'Specialization' },
          { key: 'org', label: 'Organization', render: (r) => String((r.organization as { name?: string })?.name || '-') },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'SUSPENDED'} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <ActionBtn variant={r.isActive ? 'danger' : 'success'} onClick={() => api.patch(`/admin/doctors/${r.id}/status`, { isActive: !r.isActive }).then(() => refetch())}>
              {r.isActive ? 'Suspend' : 'Activate'}
            </ActionBtn>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

// ─── Patients ────────────────────────────────────────────────────────────────

export function AdminPatientsPage() {
  const { data, isLoading, refetch } = useAdminList('/admin/patients', '?limit=50');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Patient Management" subtitle="View and manage all patients" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'fullName', label: 'Name' },
          { key: 'email', label: 'Email', render: (r) => String((r.user as { email?: string })?.email || '-') },
          { key: 'city', label: 'City' },
          { key: 'appointments', label: 'Appointments', render: (r) => String((r._count as { appointments?: number })?.appointments || 0) },
          { key: 'actions', label: 'Actions', render: (r) => {
            const active = (r.user as { isActive?: boolean })?.isActive;
            return <ActionBtn variant={active ? 'danger' : 'success'} onClick={() => api.patch(`/admin/patients/${r.id}/status`, { isActive: !active }).then(() => refetch())}>{active ? 'Block' : 'Unblock'}</ActionBtn>;
          }},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

// ─── Appointments ────────────────────────────────────────────────────────────

export function AdminAppointmentsPage() {
  const { data, isLoading, refetch } = useAdminList('/admin/appointments', '?limit=50');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Appointment Management" subtitle="Platform-wide appointment visibility" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'date', label: 'Date', render: (r) => formatDate(r.appointmentDate as string) },
          { key: 'time', label: 'Time', render: (r) => String(r.startTime) },
          { key: 'patient', label: 'Patient', render: (r) => String((r.patient as { fullName?: string })?.fullName) },
          { key: 'doctor', label: 'Doctor', render: (r) => String((r.doctor as { fullName?: string })?.fullName) },
          { key: 'org', label: 'Organization', render: (r) => String((r.organization as { name?: string })?.name) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'actions', label: 'Actions', render: (r) => r.status !== 'CANCELLED' && (
            <ActionBtn variant="danger" onClick={() => api.patch(`/admin/appointments/${r.id}/status`, { status: 'CANCELLED' }).then(() => refetch())}>Cancel</ActionBtn>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

// ─── Payments ────────────────────────────────────────────────────────────────

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
          {isSet ? 'This section is protected. Enter your PIN to continue.' : 'Create a 4-6 digit PIN to secure the payment console. You will need it each time you open this section.'}
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <input
          className="input mt-4 text-center tracking-[0.5em]" type="password" inputMode="numeric" maxLength={6}
          placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter' && isSet) submit(); }}
        />
        {!isSet && (
          <input
            className="input mt-2 text-center tracking-[0.5em]" type="password" inputMode="numeric" maxLength={6}
            placeholder="Confirm PIN" value={confirm} onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
          />
        )}
        <button className="btn-primary mt-4 w-full" disabled={busy} onClick={submit}>
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
        unlocked ? <button className="btn-secondary text-sm" onClick={lock}><Lock className="h-4 w-4" /> Lock</button> : undefined
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
              <button className="btn-primary text-sm" disabled={searching || query.trim().length < 2} onClick={doSearch}>
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
