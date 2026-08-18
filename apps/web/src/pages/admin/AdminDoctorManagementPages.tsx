import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { HospitalLogo } from '@/components/HospitalLogo';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { api, apiBaseUrl } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const DM_BASE = '/admin/doctor-management';

async function handleDoctorImpersonate(doctorId: string) {
  const res = await api.post<{ accessToken: string; refreshToken: string; redirectTo: string }>(`/admin/doctors/${doctorId}/impersonate`);
  if (res.success && res.data) {
    api.setTokens(res.data.accessToken, res.data.refreshToken);
    window.location.href = res.data.redirectTo;
  }
}

export function DoctorManagementDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dm-dashboard'],
    queryFn: () => api.get('/admin/doctors/dashboard'),
  });
  const stats = data?.data as Record<string, unknown> | undefined;

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Doctor Management"
        subtitle="Platform-wide doctor lifecycle — registration to suspension"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`${DM_BASE}/doctors`} className="btn-primary text-sm">All Doctors</Link>
            <a href={`${apiBaseUrl}/admin/doctors/export`} className="btn-secondary text-sm" target="_blank" rel="noreferrer">Export CSV</a>
          </div>
        }
      />
      {isLoading ? <LoadingState /> : stats && (
        <>
          <StatGrid stats={[
            { label: 'Total Doctors', value: Number(stats.totalDoctors || 0) },
            { label: 'Pending Verification', value: Number(stats.pendingVerification || 0) },
            { label: 'Under Review', value: Number(stats.underReview || 0) },
            { label: 'Verified Doctors', value: Number(stats.verifiedDoctors || 0) },
            { label: 'Active Doctors', value: Number(stats.activeDoctors || 0) },
            { label: 'Suspended', value: Number(stats.suspendedDoctors || 0) },
            { label: 'Rejected', value: Number(stats.rejectedDoctors || 0) },
            { label: 'Re-verification', value: Number(stats.reVerificationRequired || 0) },
            { label: 'Added Today', value: Number(stats.addedToday || 0) },
            { label: 'Added This Month', value: Number(stats.addedThisMonth || 0) },
            { label: 'In Hospitals', value: Number(stats.byHospital || 0) },
            { label: 'In Clinics', value: Number(stats.byClinic || 0) },
            { label: 'Total Appointments', value: Number(stats.totalAppointments || 0) },
            { label: 'Total Reviews', value: Number(stats.totalReviews || 0) },
          ]} />
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Top Specialties</h3>
              <div className="space-y-2">
                {((stats.bySpecialty as { specialty: string; count: number }[]) || []).slice(0, 8).map((s) => (
                  <div key={s.specialty} className="flex justify-between text-sm">
                    <span>{s.specialty}</span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 gap-2">
                <Link to={`${DM_BASE}/doctors`} className="btn-secondary text-sm text-center">Review All Doctors</Link>
                <Link to={`${DM_BASE}/doctors?verificationStatus=PENDING`} className="btn-secondary text-sm text-center">Pending Verification Queue</Link>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

export function DoctorManagementListPage() {
  const [search, setSearch] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [orgType, setOrgType] = useState('');
  const qc = useQueryClient();

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (verificationStatus) params.set('verificationStatus', verificationStatus);
  if (specialization) params.set('specialization', specialization);
  if (orgType) params.set('organizationType', orgType);
  params.set('limit', '50');

  const { data, isLoading } = useQuery({
    queryKey: ['dm-doctors', params.toString()],
    queryFn: () => api.get(`/admin/doctors?${params.toString()}`),
  });

  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="All Doctors"
        subtitle="Platform-wide doctor registry"
        actions={<Link to={DM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <input className="input text-sm" placeholder="Doctor name, ID, registration..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className="input text-sm w-36" placeholder="Specialty" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
        <select className="input text-sm w-auto" value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)}>
          <option value="">All Verification</option>
          {['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'CORRECTION_REQUESTED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input text-sm w-auto" value={orgType} onChange={(e) => setOrgType(e.target.value)}>
          <option value="">All Orgs</option>
          <option value="HOSPITAL">Hospital</option>
          <option value="CLINIC">Clinic</option>
        </select>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Doctor', render: (r) => (
              <div>
                <p className="font-medium">{String(r.fullName)}</p>
                <VerifiedBadge verified={r.verificationStatus === 'APPROVED' && r.accountActivated === true} label="Verified Doctor" />
              </div>
            )},
            { key: 'specialty', label: 'Specialty', render: (r) => String(r.specialization || '—') },
            { key: 'location', label: 'Location', render: (r) => {
              const org = r.organization as { city?: string; state?: string } | undefined;
              return `${org?.city || ''}, ${org?.state || ''}`;
            }},
            { key: 'verification', label: 'Verification', render: (r) => <StatusBadge status={String(r.verificationStatus)} /> },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
            { key: 'orgs', label: 'Organization', render: (r) => {
              const org = r.organization as { name?: string; type?: string } | undefined;
              return org ? `${org.name} (${org.type})` : '—';
            }},
            { key: 'actions', label: 'Actions', render: (r) => (
              <div className="flex flex-wrap gap-1">
                <Link to={`${DM_BASE}/doctors/${r.id}`} className="text-xs text-primary-600 font-medium">Manage</Link>
                <ActionBtn onClick={() => handleDoctorImpersonate(r.id as string)}>Portal</ActionBtn>
                {r.verificationStatus === 'SUSPENDED' ? (
                  <ActionBtn variant="success" onClick={() => api.post(`/admin/doctors/${r.id}/activate`, {}).then(() => qc.invalidateQueries({ queryKey: ['dm-doctors'] }))}>Activate</ActionBtn>
                ) : (
                  <ActionBtn variant="danger" onClick={() => {
                    const reason = prompt('Suspension reason:');
                    if (reason) api.post(`/admin/doctors/${r.id}/suspend`, { reason, fullSuspension: true }).then(() => qc.invalidateQueries({ queryKey: ['dm-doctors'] }));
                  }}>Suspend</ActionBtn>
                )}
              </div>
            )},
          ]}
          rows={rows}
          emptyMessage="No doctors found"
        />
      )}
    </DashboardLayout>
  );
}

const TABS = ['Overview', 'Profile', 'Organizations', 'Schedule', 'Appointments', 'Reviews', 'Services', 'Audit'] as const;

export function DoctorManagementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<typeof TABS[number]>('Overview');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['dm-doctor', id],
    queryFn: () => api.get(`/admin/doctors/${id}`),
    enabled: Boolean(id),
  });

  const overview = data?.data as {
    doctor: Record<string, unknown>;
    stats: Record<string, unknown>;
    associations: Record<string, unknown>[];
    compliance: { level: string; message: string }[];
  } | undefined;

  const doctor = overview?.doctor;
  const stats = overview?.stats;

  const { data: tabData, isLoading: tabLoading } = useQuery({
    queryKey: ['dm-tab', id, tab],
    queryFn: async () => {
      if (tab === 'Appointments') return api.get(`/admin/doctors/${id}/appointments`);
      if (tab === 'Schedule') return api.get(`/admin/doctors/${id}/schedule`);
      if (tab === 'Reviews') return api.get(`/admin/doctors/${id}/reviews`);
      if (tab === 'Services') return api.get(`/admin/doctors/${id}/services`);
      if (tab === 'Audit') return api.get(`/admin/doctors/${id}/audit-logs`);
      return null;
    },
    enabled: Boolean(id) && !['Overview', 'Profile', 'Organizations'].includes(tab),
  });

  if (isLoading) return <DashboardLayout portal="admin"><LoadingState /></DashboardLayout>;
  if (!doctor) return <DashboardLayout portal="admin"><p>Doctor not found</p></DashboardLayout>;

  const suspend = async () => {
    const reason = prompt('Suspension reason (required):');
    if (!reason) return;
    await api.post(`/admin/doctors/${id}/suspend`, { reason, fullSuspension: true, suspendLogin: true });
    qc.invalidateQueries({ queryKey: ['dm-doctor', id] });
  };

  const activate = async () => {
    await api.post(`/admin/doctors/${id}/activate`, {});
    qc.invalidateQueries({ queryKey: ['dm-doctor', id] });
  };

  const reVerify = async () => {
    const reason = prompt('Re-verification reason:');
    if (!reason) return;
    await api.post(`/admin/doctors/${id}/re-verify`, { reason });
    qc.invalidateQueries({ queryKey: ['dm-doctor', id] });
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={String(doctor.fullName)}
        subtitle={`Doctor ID: ${String(doctor.id).slice(0, 8)}...`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => navigate(`${DM_BASE}/doctors`)}>← Back</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => handleDoctorImpersonate(id!)}>Open Portal</button>
            <Link to={`/doctors/${id}`} className="btn-secondary text-sm" target="_blank" rel="noreferrer">Public Profile</Link>
            <button type="button" className="btn-secondary text-sm" onClick={reVerify}>Re-verify</button>
            {doctor.verificationStatus === 'SUSPENDED' ? (
              <button type="button" className="btn-primary text-sm" onClick={activate}>Activate</button>
            ) : (
              <button type="button" className="btn text-sm border border-red-200 text-red-600" onClick={suspend}>Suspend</button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-4 mb-6">
        {doctor.photoUrl ? (
          <img src={String(doctor.photoUrl)} alt="" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl">
            {String(doctor.fullName).charAt(0)}
          </div>
        )}
        <div>
          <VerifiedBadge verified={doctor.verificationStatus === 'APPROVED'} label="Verified Doctor" size="md" />
          <p className="text-sm text-gray-500 mt-1">{String(doctor.specialization || 'General')}</p>
          <div className="flex gap-2 mt-1">
            <StatusBadge status={String(doctor.verificationStatus)} />
            <span className="text-sm text-yellow-600">⭐ {Number(doctor.averageRating || 0).toFixed(1)} ({Number(doctor.reviewCount || 0)} reviews)</span>
          </div>
        </div>
      </div>

      {overview?.compliance && overview.compliance.length > 0 && (
        <div className="mb-6 space-y-2">
          {overview.compliance.map((c) => (
            <div key={c.message} className={`text-sm p-3 rounded-lg ${c.level === 'red' ? 'bg-red-50 text-red-700' : c.level === 'yellow' ? 'bg-yellow-50 text-yellow-800' : 'bg-orange-50 text-orange-800'}`}>
              {c.message}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-6 border-b pb-2">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm rounded-lg ${tab === t ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Appointments', value: stats.appointments },
            { label: 'Patients', value: stats.patients },
            { label: 'Reviews', value: stats.reviews },
            { label: 'Schedule Slots', value: stats.slots },
            { label: 'Revenue', value: formatCurrency(Number(stats.revenue || 0)) },
            { label: 'Consultation Fee', value: formatCurrency(Number(doctor.consultationFee || 0)) },
            { label: 'Experience', value: `${doctor.experience || 0} years` },
            { label: 'Account Activated', value: doctor.accountActivated ? 'Yes' : 'No' },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xl font-bold mt-1">{String(s.value ?? 0)}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'Profile' && (
        <div className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {[
            ['Email', (doctor.user as { email?: string })?.email],
            ['Phone', (doctor.user as { phone?: string })?.phone],
            ['Qualification', doctor.qualification],
            ['Registration #', doctor.registrationNumber],
            ['Languages', (doctor.languages as string[])?.join(', ')],
            ['Bio', doctor.bio],
            ['Joined', formatDate(doctor.createdAt as string)],
            ['Last Login', (doctor.user as { lastLoginAt?: string })?.lastLoginAt ? formatDate((doctor.user as { lastLoginAt: string }).lastLoginAt) : '—'],
          ].map(([label, val]) => (
            <div key={String(label)}><p className="text-gray-500">{String(label)}</p><p className="font-medium">{String(val ?? '—')}</p></div>
          ))}
        </div>
      )}

      {tab === 'Organizations' && overview?.associations && (
        <AdminTable columns={[
          { key: 'org', label: 'Organization', render: (r) => {
            const org = r.organization as { name?: string; type?: string; logoUrl?: string };
            return (
              <div className="flex items-center gap-2">
                <HospitalLogo organization={{ branding: { logoUrl: org?.logoUrl } } as never} size="xs" />
                <span>{org?.name} ({org?.type})</span>
              </div>
            );
          }},
          { key: 'dept', label: 'Department', render: (r) => String((r.department as { name?: string })?.name || '—') },
          { key: 'branch', label: 'Branch', render: (r) => String((r.branch as { name?: string })?.name || '—') },
          { key: 'fee', label: 'Fee', render: (r) => formatCurrency(Number(r.consultationFee || 0)) },
          { key: 'primary', label: 'Primary', render: (r) => r.isPrimary ? 'Yes' : 'No' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
        ]} rows={overview.associations} />
      )}

      {!['Overview', 'Profile', 'Organizations'].includes(tab) && (
        tabLoading ? <LoadingState /> : (
          <DoctorTabContent tab={tab} data={tabData?.data} />
        )
      )}
    </DashboardLayout>
  );
}

function DoctorTabContent({ tab, data }: { tab: string; data: unknown }) {
  const list = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data;
  if (!list || !Array.isArray(list)) return <p className="text-gray-500">No data</p>;

  if (tab === 'Schedule') {
    return <AdminTable columns={[
      { key: 'date', label: 'Date', render: (r) => formatDate(r.date as string) },
      { key: 'start', label: 'Start', render: (r) => String(r.startTime) },
      { key: 'end', label: 'End', render: (r) => String(r.endTime) },
      { key: 'booked', label: 'Booked', render: (r) => r.isBooked ? 'Yes' : 'No' },
    ]} rows={list as Record<string, unknown>[]} />;
  }

  if (tab === 'Appointments') {
    return <AdminTable columns={[
      { key: 'date', label: 'Date', render: (r) => formatDate(r.appointmentDate as string) },
      { key: 'patient', label: 'Patient', render: (r) => String((r.patient as { fullName?: string })?.fullName) },
      { key: 'org', label: 'Organization', render: (r) => String((r.organization as { name?: string })?.name) },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
    ]} rows={list as Record<string, unknown>[]} />;
  }

  if (tab === 'Reviews') {
    return <AdminTable columns={[
      { key: 'rating', label: 'Rating', render: (r) => `⭐ ${r.rating}` },
      { key: 'patient', label: 'Patient', render: (r) => String((r.patient as { fullName?: string })?.fullName) },
      { key: 'comment', label: 'Review', render: (r) => String(r.comment || '').slice(0, 80) },
      { key: 'date', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
    ]} rows={list as Record<string, unknown>[]} />;
  }

  if (tab === 'Services') {
    return <AdminTable columns={[
      { key: 'name', label: 'Service' },
      { key: 'category', label: 'Category' },
      { key: 'price', label: 'Price', render: (r) => formatCurrency(Number(r.price)) },
      { key: 'duration', label: 'Duration', render: (r) => r.duration ? `${r.duration} min` : '—' },
    ]} rows={list as Record<string, unknown>[]} />;
  }

  if (tab === 'Audit') {
    return <AdminTable columns={[
      { key: 'action', label: 'Action' },
      { key: 'user', label: 'By', render: (r) => String((r.user as { email?: string })?.email || 'System') },
      { key: 'date', label: 'When', render: (r) => formatDate(r.createdAt as string) },
    ]} rows={list as Record<string, unknown>[]} />;
  }

  return null;
}
