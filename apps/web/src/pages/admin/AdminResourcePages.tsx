import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn, EditModal, EditField } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

function useAdminList(endpoint: string, params = '') {
  return useQuery({ queryKey: [endpoint, params], queryFn: () => api.get(`${endpoint}${params}`) });
}

type Row = Record<string, unknown>;

// Issue an impersonation token for a user-backed row and switch into their portal.
async function loginAs(path: string) {
  const res = await api.post<{ accessToken: string; refreshToken: string; redirectTo: string }>(path);
  if (res.success && res.data) {
    api.setTokens(res.data.accessToken, res.data.refreshToken);
    window.location.href = res.data.redirectTo;
  } else {
    alert(res.error || 'Could not log in as this user');
  }
}

// Confirm and delete a record, refreshing the list on success.
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

function OrgListPage({ type, title, subtitle }: { type: string; title: string; subtitle: string }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Row | null>(null);
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
              </div>
            )},
          ]}
          rows={(data?.data as Row[]) || []}
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
  const { data, isLoading, refetch } = useAdminList('/admin/doctors', '?limit=50');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Doctor Management" subtitle="Edit, block, impersonate or remove doctors platform-wide" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'fullName', label: 'Name' },
          { key: 'specialization', label: 'Specialization' },
          { key: 'org', label: 'Organization', render: (r) => String((r.organization as { name?: string })?.name || '-') },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'BLOCKED'} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <ActionBtn onClick={() => setEditing(r)}>Edit</ActionBtn>
              <ActionBtn variant={r.isActive ? 'danger' : 'success'} onClick={() => api.patch(`/admin/doctors/${r.id}/status`, { isActive: !r.isActive }).then(() => refetch())}>
                {r.isActive ? 'Block' : 'Unblock'}
              </ActionBtn>
              <ActionBtn onClick={() => loginAs(`/admin/doctors/${r.id}/impersonate`)}>Login as Doctor</ActionBtn>
              <ActionBtn variant="danger" onClick={() => confirmDelete(`/admin/doctors/${r.id}`, 'doctor', refetch)}>Delete</ActionBtn>
            </div>
          )},
        ]} rows={(data?.data as Row[]) || []} />
      )}
      {editing && (
        <EditModal
          title="Edit Doctor"
          fields={DOCTOR_EDIT_FIELDS}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            const res = await api.patch(`/admin/doctors/${editing.id}`, values);
            if (!res.success) throw new Error(res.error || 'Update failed');
            setEditing(null);
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

export function AdminPatientsPage() {
  const [editing, setEditing] = useState<Row | null>(null);
  const { data, isLoading, refetch } = useAdminList('/admin/patients', '?limit=50');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Patient Management" subtitle="Edit, block, impersonate or remove patients" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'fullName', label: 'Name' },
          { key: 'email', label: 'Email', render: (r) => String((r.user as { email?: string })?.email || '-') },
          { key: 'city', label: 'City' },
          { key: 'appointments', label: 'Appointments', render: (r) => String((r._count as { appointments?: number })?.appointments || 0) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={(r.user as { isActive?: boolean })?.isActive ? 'ACTIVE' : 'BLOCKED'} /> },
          { key: 'actions', label: 'Actions', render: (r) => {
            const active = (r.user as { isActive?: boolean })?.isActive;
            return (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <ActionBtn onClick={() => setEditing(r)}>Edit</ActionBtn>
                <ActionBtn variant={active ? 'danger' : 'success'} onClick={() => api.patch(`/admin/patients/${r.id}/status`, { isActive: !active }).then(() => refetch())}>{active ? 'Block' : 'Unblock'}</ActionBtn>
                <ActionBtn onClick={() => loginAs(`/admin/patients/${r.id}/impersonate`)}>Login as Patient</ActionBtn>
                <ActionBtn variant="danger" onClick={() => confirmDelete(`/admin/patients/${r.id}`, 'patient', refetch)}>Delete</ActionBtn>
              </div>
            );
          }},
        ]} rows={(data?.data as Row[]) || []} />
      )}
      {editing && (
        <EditModal
          title="Edit Patient"
          fields={PATIENT_EDIT_FIELDS}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            const res = await api.patch(`/admin/patients/${editing.id}`, values);
            if (!res.success) throw new Error(res.error || 'Update failed');
            setEditing(null);
            refetch();
          }}
        />
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

export function AdminPaymentsPage() {
  const { data, isLoading } = useAdminList('/admin/payments', '?limit=50');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Payment Management" subtitle="All platform transactions" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'transactionId', label: 'Transaction ID', render: (r) => String(r.transactionId || r.id) },
          { key: 'patient', label: 'Patient', render: (r) => String((r.bill as { patient?: { fullName?: string } })?.patient?.fullName) },
          { key: 'org', label: 'Hospital', render: (r) => String((r.bill as { organization?: { name?: string } })?.organization?.name) },
          { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount as number) },
          { key: 'method', label: 'Gateway' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'date', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}
