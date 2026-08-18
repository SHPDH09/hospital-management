import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { handleImpersonate } from './AdminDashboard';
import { formatCurrency, formatDate } from '@/lib/utils';

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
          { key: 'risk', label: 'No-Show Risk', render: (r) => r.noShowRisk ? <StatusBadge status={r.noShowRisk === 'HIGH' ? 'URGENT' : r.noShowRisk === 'MEDIUM' ? 'PENDING' : 'ACTIVE'} /> : '-' },
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
  const { data: paymentAi } = useQuery({ queryKey: ['ai-payments'], queryFn: () => api.get('/ai/analytics/payments') });
  const alerts = (paymentAi?.data as { alerts?: { severity: string; message: string }[] })?.alerts || [];
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Payment Management" subtitle="All platform transactions" />
      {alerts.length > 0 && (
        <div className="card p-4 mb-4 border-l-4 border-orange-500">
          <p className="font-medium text-sm mb-2">AI Payment Alerts</p>
          {alerts.map((a, i) => <p key={i} className="text-sm text-gray-600">[{a.severity}] {a.message}</p>)}
        </div>
      )}
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
