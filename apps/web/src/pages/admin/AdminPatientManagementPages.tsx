import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { HospitalLogo } from '@/components/HospitalLogo';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { api, apiBaseUrl } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const PM_BASE = '/admin/patient-management';

async function handlePatientImpersonate(patientId: string) {
  const res = await api.post<{ accessToken: string; refreshToken: string; redirectTo: string }>(`/admin/patients/${patientId}/impersonate`);
  if (res.success && res.data) {
    api.setTokens(res.data.accessToken, res.data.refreshToken);
    window.location.href = res.data.redirectTo;
  }
}

export function PatientManagementDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['pm-dashboard'],
    queryFn: () => api.get('/admin/patients/dashboard'),
  });
  const stats = data?.data as Record<string, unknown> | undefined;

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Patient Management"
        subtitle="Global patient registry — one ID across all providers"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`${PM_BASE}/patients`} className="btn-primary text-sm">All Patients</Link>
            <Link to={`${PM_BASE}/duplicates`} className="btn-secondary text-sm">Duplicate Detection</Link>
            <a href={`${apiBaseUrl}/admin/patients/export`} className="btn-secondary text-sm" target="_blank" rel="noreferrer">Export CSV</a>
          </div>
        }
      />
      {isLoading ? <LoadingState /> : stats && (
        <>
          <StatGrid stats={[
            { label: 'Total Patients', value: Number(stats.totalPatients || 0) },
            { label: 'New This Month', value: Number(stats.newPatients || 0) },
            { label: 'Active Patients', value: Number(stats.activePatients || 0) },
            { label: 'Returning Patients', value: Number(stats.returningPatients || 0) },
            { label: 'Verified Patients', value: Number(stats.verifiedPatients || 0) },
            { label: 'Pending Profile', value: Number(stats.pendingProfile || 0) },
            { label: 'Blocked', value: Number(stats.blockedPatients || 0) },
            { label: 'Added Today', value: Number(stats.addedToday || 0) },
            { label: 'Referral Patients', value: Number(stats.referralPatients || 0) },
            { label: 'Direct Patients', value: Number(stats.directPatients || 0) },
            { label: 'Ad Patients', value: Number(stats.advertisementPatients || 0) },
            { label: 'Hospital Links', value: Number(stats.byHospital || 0) },
            { label: 'Clinic Links', value: Number(stats.byClinic || 0) },
            { label: 'Appointments', value: Number(stats.totalAppointments || 0) },
          ]} />
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6">
              <h3 className="font-semibold mb-4">By Gender</h3>
              <div className="space-y-2">
                {((stats.byGender as { gender: string; count: number }[]) || []).map((g) => (
                  <div key={g.gender} className="flex justify-between text-sm">
                    <span>{g.gender}</span><span className="font-medium">{g.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Top States</h3>
              <div className="space-y-2">
                {((stats.byState as { state: string; count: number }[]) || []).slice(0, 6).map((s) => (
                  <div key={s.state} className="flex justify-between text-sm">
                    <span>{s.state}</span><span className="font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-4">Age Groups</h3>
              <div className="space-y-2">
                {((stats.byAgeGroup as { range: string; count: number }[]) || []).map((a) => (
                  <div key={a.range} className="flex justify-between text-sm">
                    <span>{a.range}</span><span className="font-medium">{a.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

export function PatientManagementListPage() {
  const [search, setSearch] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [source, setSource] = useState('');
  const [city, setCity] = useState('');
  const qc = useQueryClient();

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (accountStatus) params.set('accountStatus', accountStatus);
  if (source) params.set('registrationSource', source);
  if (city) params.set('city', city);
  params.set('limit', '50');

  const { data, isLoading } = useQuery({
    queryKey: ['pm-patients', params.toString()],
    queryFn: () => api.get(`/admin/patients?${params.toString()}`),
  });

  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="All Patients"
        subtitle="Global patient registry with PAT-ID"
        actions={<Link to={PM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <input className="input text-sm" placeholder="Name, PAT-ID, email, mobile..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className="input text-sm w-32" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <select className="input text-sm w-auto" value={accountStatus} onChange={(e) => setAccountStatus(e.target.value)}>
          <option value="">All Status</option>
          {['ACTIVE', 'PENDING_PROFILE', 'UNVERIFIED', 'BLOCKED', 'SUSPENDED', 'DEACTIVATED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input text-sm w-auto" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All Sources</option>
          {['DIRECT', 'REFERRAL', 'AASHA', 'ADVERTISEMENT', 'GOOGLE', 'WEBSITE', 'CAMPAIGN'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Patient', render: (r) => (
              <div>
                <p className="font-medium">{String(r.fullName)}</p>
                <p className="text-xs text-gray-500 font-mono">{String(r.globalPatientId)}</p>
              </div>
            )},
            { key: 'location', label: 'Location', render: (r) => `${r.city || ''}, ${r.state || ''}` },
            { key: 'source', label: 'Source', render: (r) => (
              <span className={`text-xs px-2 py-0.5 rounded-full ${['REFERRAL', 'AASHA'].includes(String(r.registrationSource)) ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-600'}`}>
                {String(r.registrationSource)}
              </span>
            )},
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.accountStatus)} /> },
            { key: 'lastVisit', label: 'Last Visit', render: (r) => r.lastVisit ? formatDate(r.lastVisit as string) : '—' },
            { key: 'orgs', label: 'Providers', render: (r) => String((r._count as { organizations?: number })?.organizations || 0) },
            { key: 'actions', label: 'Actions', render: (r) => (
              <div className="flex flex-wrap gap-1">
                <Link to={`${PM_BASE}/patients/${r.id}`} className="text-xs text-primary-600 font-medium">Manage</Link>
                <ActionBtn onClick={() => handlePatientImpersonate(r.id as string)}>Portal</ActionBtn>
                {r.accountStatus === 'BLOCKED' || r.accountStatus === 'SUSPENDED' ? (
                  <ActionBtn variant="success" onClick={() => api.post(`/admin/patients/${r.id}/activate`, {}).then(() => qc.invalidateQueries({ queryKey: ['pm-patients'] }))}>Activate</ActionBtn>
                ) : (
                  <ActionBtn variant="danger" onClick={() => {
                    const reason = prompt('Block reason:');
                    if (reason) api.post(`/admin/patients/${r.id}/block`, { reason }).then(() => qc.invalidateQueries({ queryKey: ['pm-patients'] }));
                  }}>Block</ActionBtn>
                )}
              </div>
            )},
          ]}
          rows={rows}
          emptyMessage="No patients found"
        />
      )}
    </DashboardLayout>
  );
}

export function PatientDuplicatesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['pm-duplicates'],
    queryFn: () => api.get('/admin/patients/duplicates'),
  });
  const groups = (data?.data as { key: string; patients: Record<string, unknown>[] }[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Duplicate Patient Detection"
        subtitle="Review and merge possible duplicate accounts"
        actions={<Link to={PM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      {isLoading ? <LoadingState /> : groups.length === 0 ? (
        <p className="text-gray-500">No duplicate patients detected.</p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.key} className="card p-6">
              <h3 className="font-semibold mb-4 text-orange-700">Possible duplicate: {g.key}</h3>
              <AdminTable columns={[
                { key: 'id', label: 'PAT-ID', render: (r) => String(r.globalPatientId) },
                { key: 'name', label: 'Name', render: (r) => String(r.fullName) },
                { key: 'email', label: 'Email', render: (r) => String((r.user as { email?: string })?.email) },
                { key: 'phone', label: 'Phone', render: (r) => String((r.user as { phone?: string })?.phone || '—') },
                { key: 'actions', label: 'Actions', render: (r) => (
                  <Link to={`${PM_BASE}/patients/${r.id}`} className="text-xs text-primary-600">View</Link>
                )},
              ]} rows={g.patients} />
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

const TABS = ['Overview', 'Profile', 'Organizations', 'Appointments', 'Payments', 'Audit'] as const;

export function PatientManagementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<typeof TABS[number]>('Overview');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['pm-patient', id],
    queryFn: () => api.get(`/admin/patients/${id}`),
    enabled: Boolean(id),
  });

  const overview = data?.data as {
    patient: Record<string, unknown>;
    stats: Record<string, unknown>;
    compliance: { level: string; message: string }[];
    recentAppointments: Record<string, unknown>[];
    recentBills: Record<string, unknown>[];
  } | undefined;

  const patient = overview?.patient;
  const stats = overview?.stats;
  const user = patient?.user as Record<string, unknown> | undefined;

  const { data: tabData, isLoading: tabLoading } = useQuery({
    queryKey: ['pm-tab', id, tab],
    queryFn: async () => {
      if (tab === 'Appointments') return api.get(`/admin/patients/${id}/appointments`);
      if (tab === 'Organizations') return api.get(`/admin/patients/${id}/organizations`);
      if (tab === 'Audit') return api.get(`/admin/patients/${id}/audit-logs`);
      return null;
    },
    enabled: Boolean(id) && ['Appointments', 'Organizations', 'Audit'].includes(tab),
  });

  if (isLoading) return <DashboardLayout portal="admin"><LoadingState /></DashboardLayout>;
  if (!patient) return <DashboardLayout portal="admin"><p>Patient not found</p></DashboardLayout>;

  const verify = async () => {
    await api.post(`/admin/patients/${id}/verify`, {});
    qc.invalidateQueries({ queryKey: ['pm-patient', id] });
  };

  const block = async () => {
    const reason = prompt('Block reason (required):');
    if (!reason) return;
    await api.post(`/admin/patients/${id}/block`, { reason });
    qc.invalidateQueries({ queryKey: ['pm-patient', id] });
  };

  const activate = async () => {
    await api.post(`/admin/patients/${id}/activate`, {});
    qc.invalidateQueries({ queryKey: ['pm-patient', id] });
  };

  const isVerified = Boolean(user?.emailVerified && user?.phoneVerified);

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={String(patient.fullName)}
        subtitle={String(patient.globalPatientId)}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => navigate(`${PM_BASE}/patients`)}>← Back</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => handlePatientImpersonate(id!)}>Open Portal</button>
            {!isVerified && <button type="button" className="btn-secondary text-sm" onClick={verify}>Verify</button>}
            {patient.accountStatus === 'BLOCKED' || patient.accountStatus === 'SUSPENDED' ? (
              <button type="button" className="btn-primary text-sm" onClick={activate}>Activate</button>
            ) : (
              <button type="button" className="btn text-sm border border-red-200 text-red-600" onClick={block}>Block</button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-4 mb-6">
        {patient.photoUrl ? (
          <img src={String(patient.photoUrl)} alt="" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xl">
            {String(patient.fullName).charAt(0)}
          </div>
        )}
        <div>
          <VerifiedBadge verified={isVerified} label="Verified Patient" size="md" />
          <p className="text-sm text-gray-500 mt-1">{String(patient.city)}, {String(patient.state)}</p>
          <div className="flex gap-2 mt-1">
            <StatusBadge status={String(patient.accountStatus)} />
            <span className="text-xs text-gray-500">Source: {String(patient.registrationSource)}</span>
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
            { label: 'Connected Providers', value: stats.organizations },
            { label: 'Bills', value: stats.bills },
            { label: 'Reviews', value: stats.reviews },
            { label: 'Total Paid', value: formatCurrency(Number(stats.revenue || 0)) },
            { label: 'Profile Complete', value: patient.profileCompleted ? 'Yes' : 'No' },
            { label: 'Blood Group', value: patient.bloodGroup || '—' },
            { label: 'Registered', value: formatDate(patient.createdAt as string) },
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
            ['Email', user?.email], ['Phone', user?.phone],
            ['DOB', patient.dateOfBirth ? formatDate(patient.dateOfBirth as string) : '—'],
            ['Gender', patient.gender], ['Address', patient.address],
            ['PIN', patient.pinCode], ['Emergency Contact', patient.emergencyContact],
            ['Last Login', user?.lastLoginAt ? formatDate(user.lastLoginAt as string) : '—'],
          ].map(([label, val]) => (
            <div key={String(label)}><p className="text-gray-500">{String(label)}</p><p className="font-medium">{String(val ?? '—')}</p></div>
          ))}
        </div>
      )}

      {tab === 'Payments' && overview?.recentBills && (
        <AdminTable columns={[
          { key: 'bill', label: 'Bill #', render: (r) => String(r.billNumber) },
          { key: 'org', label: 'Provider', render: (r) => String((r.organization as { name?: string })?.name) },
          { key: 'total', label: 'Amount', render: (r) => formatCurrency(Number(r.total)) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'date', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
        ]} rows={overview.recentBills} />
      )}

      {['Appointments', 'Organizations', 'Audit'].includes(tab) && (
        tabLoading ? <LoadingState /> : (
          <PatientTabContent tab={tab} data={tabData?.data} />
        )
      )}
    </DashboardLayout>
  );
}

function PatientTabContent({ tab, data }: { tab: string; data: unknown }) {
  const list = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data;
  if (!list || !Array.isArray(list)) return <p className="text-gray-500">No data</p>;

  if (tab === 'Organizations') {
    return <AdminTable columns={[
      { key: 'org', label: 'Provider', render: (r) => {
        const org = r.organization as { name?: string; type?: string; logoUrl?: string };
        return (
          <div className="flex items-center gap-2">
            <HospitalLogo organization={{ name: org?.name, logoUrl: org?.logoUrl }} size="xs" />
            <span>{org?.name} ({org?.type})</span>
          </div>
        );
      }},
      { key: 'source', label: 'Source', render: (r) => String(r.sourceType || 'DIRECT') },
      { key: 'referral', label: 'Referral', render: (r) => String(r.referralName || '—') },
      { key: 'since', label: 'Since', render: (r) => formatDate(r.createdAt as string) },
    ]} rows={list as Record<string, unknown>[]} />;
  }

  if (tab === 'Appointments') {
    return <AdminTable columns={[
      { key: 'date', label: 'Date', render: (r) => formatDate(r.appointmentDate as string) },
      { key: 'doctor', label: 'Doctor', render: (r) => String((r.doctor as { fullName?: string })?.fullName) },
      { key: 'org', label: 'Provider', render: (r) => String((r.organization as { name?: string })?.name) },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
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
