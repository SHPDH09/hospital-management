import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { AdminRowActions, AdminEditModal } from '@/components/admin/AdminRowActions';
import { api } from '@/lib/api';
import { confirmAction, impersonateOrganization, impersonateUser } from '@/lib/adminActions';
import { formatCurrency, formatDate } from '@/lib/utils';

function useAdminList(endpoint: string, params = '') {
  return useQuery({ queryKey: [endpoint, params], queryFn: () => api.get(`${endpoint}${params}`) });
}

type EditState = {
  type: 'organization' | 'doctor' | 'patient';
  id: string;
  values: Record<string, string | number>;
} | null;

// ─── Organizations (Hospitals / Clinics) ─────────────────────────────────────

export function AdminHospitalsPage() {
  return <OrgListPage type="HOSPITAL" title="Hospital Management" subtitle="Manage all hospitals on the platform" />;
}

export function AdminClinicsPage() {
  return <OrgListPage type="CLINIC" title="Clinic Management" subtitle="Manage all clinics on the platform" />;
}

function OrgListPage({ type, title, subtitle }: { type: string; title: string; subtitle: string }) {
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const { data, isLoading, refetch } = useAdminList('/admin/organizations', `?type=${type}&search=${search}&limit=50`);

  const openEdit = (row: Record<string, unknown>) => {
    setEdit({
      type: 'organization',
      id: row.id as string,
      values: {
        name: String(row.name || ''),
        city: String(row.city || ''),
        phone: String(row.phone || ''),
        email: String(row.email || ''),
      },
    });
  };

  const saveEdit = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      await api.patch(`/admin/organizations/${edit.id}`, edit.values);
      setEdit(null);
      refetch();
    } finally {
      setSaving(false);
    }
  };

  const blockOrg = async (id: string) => {
    if (!confirmAction('Block this organization? It will be hidden from public listings.')) return;
    await api.patch(`/admin/organizations/${id}/status`, { isActive: false, verificationStatus: 'SUSPENDED', isPubliclyListed: false });
    refetch();
  };

  const unblockOrg = async (id: string) => {
    await api.patch(`/admin/organizations/${id}/status`, { isActive: true, verificationStatus: 'APPROVED', isPubliclyListed: true });
    refetch();
  };

  const deleteOrg = async (id: string, name: string) => {
    if (!confirmAction(`Permanently delete "${name}"? This cannot be undone.`)) return;
    const res = await api.delete(`/admin/organizations/${id}`);
    if (!res.success) alert(res.error || 'Delete failed');
    refetch();
  };

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
            { key: 'actions', label: 'Actions', render: (r) => {
              const suspended = r.verificationStatus === 'SUSPENDED' || r.isActive === false;
              return (
                <AdminRowActions
                  onEdit={() => openEdit(r)}
                  onDelete={() => deleteOrg(r.id as string, String(r.name))}
                  isBlocked={suspended}
                  onBlock={!suspended ? () => blockOrg(r.id as string) : undefined}
                  onUnblock={suspended ? () => unblockOrg(r.id as string) : undefined}
                  onLoginAs={() => impersonateOrganization(r.id as string)}
                  loginAsLabel="Login as Admin"
                  extra={r.verificationStatus === 'PENDING' ? (
                    <ActionBtn variant="success" onClick={() => api.patch(`/admin/organizations/${r.id}/status`, { verificationStatus: 'APPROVED', isPubliclyListed: true }).then(() => refetch())}>Approve</ActionBtn>
                  ) : undefined}
                />
              );
            }},
          ]}
          rows={(data?.data as Record<string, unknown>[]) || []}
        />
      )}

      {edit?.type === 'organization' && (
        <AdminEditModal
          title="Edit Organization"
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'city', label: 'City' },
            { key: 'phone', label: 'Phone' },
            { key: 'email', label: 'Email', type: 'email' },
          ]}
          values={edit.values}
          onChange={(key, value) => setEdit({ ...edit, values: { ...edit.values, [key]: value } })}
          onClose={() => setEdit(null)}
          onSave={saveEdit}
          saving={saving}
        />
      )}
    </DashboardLayout>
  );
}

// ─── Doctors ─────────────────────────────────────────────────────────────────

export function AdminDoctorsPage() {
  const [edit, setEdit] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const { data, isLoading, refetch } = useAdminList('/admin/doctors', '?limit=50');

  const saveEdit = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      await api.patch(`/admin/doctors/${edit.id}`, edit.values);
      setEdit(null);
      refetch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Doctor Management" subtitle="Edit, block, delete, or login as doctor" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'fullName', label: 'Name' },
          { key: 'specialization', label: 'Specialization' },
          { key: 'org', label: 'Organization', render: (r) => String((r.organization as { name?: string })?.name || '-') },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'SUSPENDED'} /> },
          { key: 'actions', label: 'Actions', render: (r) => {
            const user = r.user as { isActive?: boolean; id?: string } | undefined;
            const active = r.isActive !== false && user?.isActive !== false;
            return (
              <AdminRowActions
                onEdit={() => setEdit({
                  type: 'doctor',
                  id: r.id as string,
                  values: {
                    fullName: String(r.fullName || ''),
                    specialization: String(r.specialization || ''),
                    qualification: String(r.qualification || ''),
                    experience: Number(r.experience || 0),
                    consultationFee: Number(r.consultationFee || 0),
                  },
                })}
                onDelete={async () => {
                  if (!confirmAction(`Delete doctor "${r.fullName}"?`)) return;
                  const res = await api.delete(`/admin/doctors/${r.id}`);
                  if (res.message) alert(res.message);
                  if (!res.success) alert(res.error || 'Delete failed');
                  refetch();
                }}
                isBlocked={!active}
                onBlock={active ? async () => {
                  if (!confirmAction(`Block doctor "${r.fullName}"?`)) return;
                  await api.patch(`/admin/doctors/${r.id}/status`, { isActive: false });
                  refetch();
                } : undefined}
                onUnblock={!active ? async () => {
                  await api.patch(`/admin/doctors/${r.id}/status`, { isActive: true });
                  refetch();
                } : undefined}
                onLoginAs={user?.id ? () => impersonateUser(user.id!) : undefined}
                loginAsLabel="Login as Doctor"
              />
            );
          }},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}

      {edit?.type === 'doctor' && (
        <AdminEditModal
          title="Edit Doctor"
          fields={[
            { key: 'fullName', label: 'Full Name', required: true },
            { key: 'specialization', label: 'Specialization' },
            { key: 'qualification', label: 'Qualification' },
            { key: 'experience', label: 'Experience (years)', type: 'number' },
            { key: 'consultationFee', label: 'Consultation Fee', type: 'number' },
          ]}
          values={edit.values}
          onChange={(key, value) => setEdit({ ...edit, values: { ...edit.values, [key]: value } })}
          onClose={() => setEdit(null)}
          onSave={saveEdit}
          saving={saving}
        />
      )}
    </DashboardLayout>
  );
}

// ─── Patients ────────────────────────────────────────────────────────────────

export function AdminPatientsPage() {
  const [edit, setEdit] = useState<EditState>(null);
  const [saving, setSaving] = useState(false);
  const { data, isLoading, refetch } = useAdminList('/admin/patients', '?limit=50');
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const { data: duplicates } = useQuery({
    queryKey: ['patient-duplicates'],
    queryFn: () => api.get<{ groups: { matchType: string; confidence: string; patients: { id: string; fullName: string; email: string | null }[] }[] }>('/ai/patients/duplicates'),
  });
  const { data: timeline } = useQuery({
    queryKey: ['patient-timeline', selectedPatient],
    queryFn: () => api.get(`/ai/patients/${selectedPatient}/timeline`),
    enabled: Boolean(selectedPatient),
  });

  const refreshCompletion = (id: string) =>
    api.post(`/ai/patients/${id}/completion`, {}).then(() => refetch());

  const saveEdit = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      await api.patch(`/admin/patients/${edit.id}`, edit.values);
      setEdit(null);
      refetch();
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Patient Management" subtitle="Edit, block, delete, or login as patient" actions={
        <ActionBtn onClick={() => api.post('/ai/patients/batch-completion', {}).then(() => refetch())}>Refresh All Completion %</ActionBtn>
      } />

      {(duplicates?.data?.groups?.length ?? 0) > 0 && (
        <div className="card p-4 mb-4 border-l-4 border-orange-500">
          <p className="font-medium text-sm mb-2">AI Duplicate Detection — {duplicates?.data?.groups.length} group(s)</p>
          {duplicates?.data?.groups.slice(0, 3).map((g, i) => (
            <p key={i} className="text-sm text-gray-600">[{g.confidence}] {g.matchType}: {g.patients.map((p) => p.fullName).join(' · ')}</p>
          ))}
        </div>
      )}

      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'fullName', label: 'Name' },
          { key: 'email', label: 'Email', render: (r) => String((r.user as { email?: string })?.email || '-') },
          { key: 'city', label: 'City' },
          { key: 'completion', label: 'Profile %', render: (r) => {
            const pct = (r.profileCompletionPercent as number) ?? 0;
            return <span className={pct < 70 ? 'text-orange-600 font-medium' : ''}>{pct}%</span>;
          }},
          { key: 'appointments', label: 'Appointments', render: (r) => String((r._count as { appointments?: number })?.appointments || 0) },
          { key: 'actions', label: 'Actions', render: (r) => {
            const user = r.user as { isActive?: boolean; id?: string; email?: string } | undefined;
            const active = user?.isActive !== false;
            return (
              <AdminRowActions
                onEdit={() => setEdit({
                  type: 'patient',
                  id: r.id as string,
                  values: {
                    fullName: String(r.fullName || ''),
                    email: String(user?.email || ''),
                    city: String(r.city || ''),
                    phone: String((user as { phone?: string })?.phone || ''),
                  },
                })}
                onDelete={async () => {
                  if (!confirmAction(`Delete patient "${r.fullName}"?`)) return;
                  const res = await api.delete(`/admin/patients/${r.id}`);
                  if (res.message) alert(res.message);
                  if (!res.success) alert(res.error || 'Delete failed');
                  refetch();
                }}
                isBlocked={!active}
                onBlock={active ? async () => {
                  if (!confirmAction(`Block patient "${r.fullName}"?`)) return;
                  await api.patch(`/admin/patients/${r.id}/status`, { isActive: false });
                  refetch();
                } : undefined}
                onUnblock={!active ? async () => {
                  await api.patch(`/admin/patients/${r.id}/status`, { isActive: true });
                  refetch();
                } : undefined}
                onLoginAs={user?.id ? () => impersonateUser(user.id!) : undefined}
                loginAsLabel="Login as Patient"
                extra={
                  <>
                    <ActionBtn onClick={() => setSelectedPatient(r.id as string)}>Timeline</ActionBtn>
                    <ActionBtn onClick={() => refreshCompletion(r.id as string)}>Score</ActionBtn>
                  </>
                }
              />
            );
          }},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}

      {edit?.type === 'patient' && (
        <AdminEditModal
          title="Edit Patient"
          fields={[
            { key: 'fullName', label: 'Full Name', required: true },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'city', label: 'City' },
            { key: 'phone', label: 'Phone' },
          ]}
          values={edit.values}
          onChange={(key, value) => setEdit({ ...edit, values: { ...edit.values, [key]: value } })}
          onClose={() => setEdit(null)}
          onSave={saveEdit}
          saving={saving}
        />
      )}

      {selectedPatient && timeline?.data ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedPatient(null)}>
          <div className="card p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">{(timeline.data as { patient: { fullName: string }; aiSummary: string }).patient.fullName} — Timeline</h3>
            <p className="text-sm text-gray-600 mb-4">{(timeline.data as { aiSummary: string }).aiSummary}</p>
            <ul className="space-y-2 text-sm">
              {((timeline.data as { events: { date: string; type: string; summary: string }[] }).events || []).map((e, i) => (
                <li key={i} className="border-l-2 border-primary-200 pl-3">
                  <span className="text-xs text-gray-400">{new Date(e.date).toLocaleDateString()} · {e.type}</span>
                  <p>{e.summary}</p>
                </li>
              ))}
            </ul>
            <button type="button" className="btn-ghost mt-4" onClick={() => setSelectedPatient(null)}>Close</button>
          </div>
        </div>
      ) : null}
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
          { key: 'actions', label: 'Actions', render: (r) => (
            <AdminRowActions
              onDelete={r.status !== 'CANCELLED' ? async () => {
                if (!confirmAction('Cancel this appointment?')) return;
                await api.patch(`/admin/appointments/${r.id}/status`, { status: 'CANCELLED' });
                refetch();
              } : undefined}
            />
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
