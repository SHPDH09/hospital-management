import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { HospitalLogo } from '@/components/HospitalLogo';
import { api, apiBaseUrl } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const AM_BASE = '/admin/appointment-management';

export function AppointmentManagementDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['am-dashboard'],
    queryFn: () => api.get('/admin/appointments/dashboard'),
  });
  const stats = data?.data as Record<string, unknown> | undefined;
  const todayStats = stats?.todayStats as Record<string, number> | undefined;

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Appointment Management"
        subtitle="Central booking & scheduling — patient to consultation lifecycle"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`${AM_BASE}/appointments`} className="btn-primary text-sm">All Appointments</Link>
            <Link to={`${AM_BASE}/today`} className="btn-secondary text-sm">Today's Appointments</Link>
            <a href={`${apiBaseUrl}/admin/appointments/export`} className="btn-secondary text-sm" target="_blank" rel="noreferrer">Export CSV</a>
          </div>
        }
      />
      {isLoading ? <LoadingState /> : stats && (
        <>
          <StatGrid stats={[
            { label: 'Total Appointments', value: Number(stats.totalAppointments || 0) },
            { label: "Today's Appointments", value: Number(stats.todayAppointments || 0) },
            { label: 'Upcoming', value: Number(stats.upcomingAppointments || 0) },
            { label: 'Completed', value: Number(stats.completed || 0) },
            { label: 'Cancelled', value: Number(stats.cancelled || 0) },
            { label: 'Rescheduled', value: Number(stats.rescheduled || 0) },
            { label: 'No Show', value: Number(stats.noShow || 0) },
            { label: 'Pending Confirmation', value: Number(stats.pendingConfirmation || 0) },
            { label: 'Online Consultations', value: Number(stats.onlineConsultations || 0) },
            { label: 'Emergency', value: Number(stats.emergencyAppointments || 0) },
            { label: 'Referral Appointments', value: Number(stats.referralAppointments || 0) },
            { label: 'Ad Attribution', value: Number(stats.advertisementAppointments || 0) },
          ]} />
          {todayStats && (
            <div className="mt-8 card p-6">
              <h3 className="font-semibold mb-4">Today's Quick Stats</h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
                {[
                  { label: 'Total', value: todayStats.total },
                  { label: 'Confirmed', value: todayStats.confirmed },
                  { label: 'Pending', value: todayStats.pending },
                  { label: 'Completed', value: todayStats.completed },
                  { label: 'Cancelled', value: todayStats.cancelled },
                  { label: 'No Show', value: todayStats.noShow },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-2xl font-bold">{s.value ?? 0}</p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

export function AppointmentManagementListPage({ todayOnly = false }: { todayOnly?: boolean }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [orgType, setOrgType] = useState('');
  const qc = useQueryClient();

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (orgType) params.set('organizationType', orgType);
  if (todayOnly) {
    const today = new Date().toISOString().slice(0, 10);
    params.set('dateFrom', today);
    params.set('dateTo', today);
  }
  params.set('limit', '50');

  const { data, isLoading } = useQuery({
    queryKey: ['am-appointments', params.toString(), todayOnly],
    queryFn: () => api.get(`/admin/appointments?${params.toString()}`),
  });

  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={todayOnly ? "Today's Appointments" : 'All Appointments'}
        subtitle="Platform-wide appointment registry"
        actions={<Link to={AM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <input className="input text-sm" placeholder="APT ID, patient, doctor, hospital..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input text-sm w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED', 'REJECTED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input text-sm w-auto" value={orgType} onChange={(e) => setOrgType(e.target.value)}>
          <option value="">All Providers</option>
          <option value="HOSPITAL">Hospital</option>
          <option value="CLINIC">Clinic</option>
        </select>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable
          columns={[
            { key: 'aptId', label: 'Appointment', render: (r) => (
              <div>
                <p className="font-mono text-xs font-medium">{String(r.appointmentNumber)}</p>
                <p className="text-xs text-gray-500">{formatDate(r.appointmentDate as string)} {String(r.startTime)}</p>
              </div>
            )},
            { key: 'patient', label: 'Patient', render: (r) => {
              const p = r.patient as { fullName?: string; globalPatientId?: string };
              return (
                <div>
                  <p className="font-medium">{p?.fullName}</p>
                  <p className="text-xs text-gray-500">{p?.globalPatientId}</p>
                </div>
              );
            }},
            { key: 'doctor', label: 'Doctor', render: (r) => String((r.doctor as { fullName?: string })?.fullName) },
            { key: 'org', label: 'Provider', render: (r) => {
              const org = r.organization as { name?: string; type?: string };
              return `${org?.name} (${org?.type})`;
            }},
            { key: 'type', label: 'Type', render: (r) => String(r.type).replace(/_/g, ' ') },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
            { key: 'payment', label: 'Payment', render: (r) => <StatusBadge status={String(r.paymentStatus)} /> },
            { key: 'actions', label: 'Actions', render: (r) => (
              <div className="flex flex-wrap gap-1">
                <Link to={`${AM_BASE}/appointments/${r.id}`} className="text-xs text-primary-600 font-medium">Manage</Link>
                {r.status === 'CONFIRMED' && (
                  <ActionBtn onClick={() => api.post(`/admin/appointments/${r.id}/check-in`, {}).then(() => qc.invalidateQueries({ queryKey: ['am-appointments'] }))}>Check-In</ActionBtn>
                )}
                {!['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(String(r.status)) && (
                  <ActionBtn variant="danger" onClick={() => {
                    const reason = prompt('Cancellation reason:');
                    if (reason) api.post(`/admin/appointments/${r.id}/cancel`, { reason }).then(() => qc.invalidateQueries({ queryKey: ['am-appointments'] }));
                  }}>Cancel</ActionBtn>
                )}
              </div>
            )},
          ]}
          rows={rows}
          emptyMessage="No appointments found"
        />
      )}
    </DashboardLayout>
  );
}

export function AppointmentManagementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['am-appointment', id],
    queryFn: () => api.get(`/admin/appointments/${id}`),
    enabled: Boolean(id),
  });

  const overview = data?.data as {
    appointment: Record<string, unknown>;
    auditLogs: Record<string, unknown>[];
  } | undefined;

  const apt = overview?.appointment;
  const patient = apt?.patient as Record<string, unknown> | undefined;
  const doctor = apt?.doctor as Record<string, unknown> | undefined;
  const org = apt?.organization as Record<string, unknown> | undefined;
  const bills = apt?.bills as Record<string, unknown>[] | undefined;

  if (isLoading) return <DashboardLayout portal="admin"><LoadingState /></DashboardLayout>;
  if (!apt) return <DashboardLayout portal="admin"><p>Appointment not found</p></DashboardLayout>;

  const updateStatus = async (status: string) => {
    await api.patch(`/admin/appointments/${id}/status`, { status });
    qc.invalidateQueries({ queryKey: ['am-appointment', id] });
  };

  const checkIn = async () => {
    await api.post(`/admin/appointments/${id}/check-in`, {});
    qc.invalidateQueries({ queryKey: ['am-appointment', id] });
  };

  const cancel = async () => {
    const reason = prompt('Cancellation reason:');
    if (!reason) return;
    await api.post(`/admin/appointments/${id}/cancel`, { reason });
    qc.invalidateQueries({ queryKey: ['am-appointment', id] });
  };

  const reschedule = async () => {
    const newDate = prompt('New date (YYYY-MM-DD):');
    const newTime = prompt('New time (HH:MM):');
    if (!newDate || !newTime) return;
    await api.post(`/admin/appointments/${id}/reschedule`, { appointmentDate: newDate, startTime: newTime });
    qc.invalidateQueries({ queryKey: ['am-appointment', id] });
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={String(apt.appointmentNumber)}
        subtitle={`${formatDate(apt.appointmentDate as string)} at ${String(apt.startTime)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => navigate(`${AM_BASE}/appointments`)}>← Back</button>
            {apt.status === 'PENDING' && <button type="button" className="btn-primary text-sm" onClick={() => updateStatus('CONFIRMED')}>Confirm</button>}
            {apt.status === 'CONFIRMED' && <button type="button" className="btn-primary text-sm" onClick={checkIn}>Check-In</button>}
            {apt.status === 'CHECKED_IN' && <button type="button" className="btn-primary text-sm" onClick={() => updateStatus('IN_CONSULTATION')}>Start Consultation</button>}
            {apt.status === 'IN_CONSULTATION' && <button type="button" className="btn-primary text-sm" onClick={() => updateStatus('COMPLETED')}>Complete</button>}
            {!['CANCELLED', 'COMPLETED'].includes(String(apt.status)) && (
              <>
                <button type="button" className="btn-secondary text-sm" onClick={reschedule}>Reschedule</button>
                <button type="button" className="btn text-sm border border-red-200 text-red-600" onClick={cancel}>Cancel</button>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Patient</h3>
          <p className="font-medium">{String(patient?.fullName)}</p>
          <p className="text-sm text-gray-500 font-mono">{String(patient?.globalPatientId)}</p>
          <p className="text-sm text-gray-500 mt-1">{(patient?.user as { phone?: string })?.phone}</p>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Doctor</h3>
          <p className="font-medium">{String(doctor?.fullName)}</p>
          <p className="text-sm text-gray-500">{String(doctor?.specialization)}</p>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Provider</h3>
          <HospitalLogo organization={{ name: org?.name as string, logoUrl: org?.logoUrl as string }} size="sm" showName />
          <p className="text-sm text-gray-500 mt-2">{String(org?.city)}, {String(org?.state)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-4"><p className="text-xs text-gray-500">Status</p><div className="mt-1"><StatusBadge status={String(apt.status)} /></div></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Type</p><p className="mt-1 font-medium">{String(apt.type).replace(/_/g, ' ')}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Payment</p><div className="mt-1"><StatusBadge status={String(apt.paymentStatus)} /></div></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Token</p><p className="mt-1 font-medium">{String(apt.tokenNumber ?? '—')}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Source</p><p className="mt-1 font-medium">{String(apt.referralSource ?? 'DIRECT')}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Online</p><p className="mt-1 font-medium">{apt.isOnline ? 'Yes' : 'No'}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Emergency</p><p className="mt-1 font-medium">{apt.isEmergency ? 'Yes' : 'No'}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Checked In</p><p className="mt-1 font-medium">{apt.checkedInAt ? formatDate(apt.checkedInAt as string) : '—'}</p></div>
      </div>

      {Boolean(apt.referralName) && (
        <div className="card p-4 mb-6 bg-green-50">
          <p className="text-sm text-green-800">
            🟢 Referral: {String(apt.referralName)} ({String(apt.referralSource)}) — ID: {String(apt.referralId || '—')}
          </p>
        </div>
      )}

      {bills && bills.length > 0 && (
        <div className="card p-6 mb-6">
          <h3 className="font-semibold mb-4">Payment / Invoice</h3>
          <AdminTable columns={[
            { key: 'bill', label: 'Bill #', render: (r) => String(r.billNumber) },
            { key: 'total', label: 'Total', render: (r) => formatCurrency(Number(r.total)) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          ]} rows={bills} />
        </div>
      )}

      {overview?.auditLogs && overview.auditLogs.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Audit Trail</h3>
          <AdminTable columns={[
            { key: 'action', label: 'Action' },
            { key: 'user', label: 'By', render: (r) => String((r.user as { email?: string })?.email || 'System') },
            { key: 'date', label: 'When', render: (r) => formatDate(r.createdAt as string) },
          ]} rows={overview.auditLogs} />
        </div>
      )}
    </DashboardLayout>
  );
}
