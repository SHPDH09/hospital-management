import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { HospitalLogo } from '@/components/HospitalLogo';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { api, apiBaseUrl } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { handleImpersonate } from './AdminDashboard';

const HM_BASE = '/admin/hospital-management';

export function HospitalManagementDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['hm-dashboard'],
    queryFn: () => api.get('/admin/hospitals/dashboard'),
  });
  const stats = data?.data as Record<string, number> | undefined;

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Hospital Management"
        subtitle="Complete lifecycle control — registration to suspension"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`${HM_BASE}/hospitals`} className="btn-primary text-sm">All Hospitals</Link>
            <Link to="/admin/verification/applications" className="btn-secondary text-sm">Review Applications</Link>
            <a href={`${apiBaseUrl}/admin/hospitals/export`} className="btn-secondary text-sm" target="_blank" rel="noreferrer">Export CSV</a>
          </div>
        }
      />
      {isLoading ? <LoadingState /> : stats && (
        <>
          <StatGrid stats={[
            { label: 'Total Hospitals', value: stats.totalHospitals || 0 },
            { label: 'Pending Verification', value: stats.pendingVerification || 0 },
            { label: 'Under Review', value: stats.underReview || 0 },
            { label: 'Verified', value: stats.verifiedHospitals || 0 },
            { label: 'Rejected', value: stats.rejectedHospitals || 0 },
            { label: 'Suspended', value: stats.suspendedHospitals || 0 },
            { label: 'Inactive', value: stats.inactiveHospitals || 0 },
            { label: 'Re-verification', value: stats.reVerificationRequired || 0 },
            { label: 'Expiring Docs', value: stats.expiringDocuments || 0 },
            { label: 'New This Month', value: stats.newThisMonth || 0 },
            { label: 'Active Subscriptions', value: stats.activeSubscriptions || 0 },
            { label: 'Expired Subscriptions', value: stats.expiredSubscriptions || 0 },
            { label: 'Total Branches', value: stats.totalBranches || 0 },
            { label: 'Total Doctors', value: stats.totalDoctors || 0 },
            { label: 'Hospital Staff', value: stats.totalStaff || 0 },
            { label: 'Total Patients', value: stats.totalPatients || 0 },
            { label: 'Appointments', value: stats.totalAppointments || 0 },
            { label: 'Referral Patients', value: stats.referralPatients || 0 },
            { label: 'Ad Campaigns', value: stats.adCampaigns || 0 },
          ]} />
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/admin/verification" className="card p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold">Verification Center</h3>
              <p className="text-sm text-gray-500 mt-1">Review applications, verify documents, approve hospitals</p>
            </Link>
            <Link to={`${HM_BASE}/hospitals`} className="card p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold">All Hospitals</h3>
              <p className="text-sm text-gray-500 mt-1">Search, filter, manage every registered hospital</p>
            </Link>
            <Link to="/admin/verification/applications?status=SUBMITTED" className="card p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold">Registration Queue</h3>
              <p className="text-sm text-gray-500 mt-1">{stats.pendingVerification} pending applications</p>
            </Link>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

export function HospitalManagementListPage() {
  const [search, setSearch] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const qc = useQueryClient();

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (verificationStatus) params.set('verificationStatus', verificationStatus);
  if (city) params.set('city', city);
  if (state) params.set('state', state);
  params.set('limit', '50');

  const { data, isLoading } = useQuery({
    queryKey: ['hm-hospitals', params.toString()],
    queryFn: () => api.get(`/admin/hospitals?${params.toString()}`),
  });

  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="All Hospitals"
        subtitle="Platform-wide hospital registry"
        actions={<Link to={HM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <input className="input text-sm" placeholder="Hospital name, ID, registration..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <input className="input text-sm w-32" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
        <input className="input text-sm w-32" placeholder="State" value={state} onChange={(e) => setState(e.target.value)} />
        <select className="input text-sm w-auto" value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)}>
          <option value="">All Verification</option>
          {['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'CORRECTION_REQUESTED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable
          columns={[
            { key: 'name', label: 'Hospital', render: (r) => (
              <div className="flex items-center gap-2">
                <HospitalLogo organization={r as never} size="xs" />
                <div>
                  <p className="font-medium">{String(r.name)}</p>
                  <VerifiedBadge verified={r.verificationStatus === 'APPROVED' && r.accountActivated === true} />
                </div>
              </div>
            )},
            { key: 'location', label: 'Location', render: (r) => `${r.city || ''}, ${r.state || ''}` },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
            { key: 'verification', label: 'Verification', render: (r) => <StatusBadge status={String(r.verificationStatus)} /> },
            { key: 'subscription', label: 'Plan', render: (r) => {
              const sub = r.subscription as { plan?: { name?: string }; status?: string } | null;
              return sub?.plan?.name || '—';
            }},
            { key: 'doctors', label: 'Doctors', render: (r) => String((r._count as { doctors?: number })?.doctors || 0) },
            { key: 'patients', label: 'Patients', render: (r) => String((r._count as { patientOrgs?: number })?.patientOrgs || 0) },
            { key: 'actions', label: 'Actions', render: (r) => (
              <div className="flex flex-wrap gap-1">
                <Link to={`${HM_BASE}/hospitals/${r.id}`} className="text-xs text-primary-600 font-medium">Manage</Link>
                <ActionBtn onClick={() => handleImpersonate(r.id as string)}>CRM</ActionBtn>
                {r.verificationStatus === 'SUSPENDED' ? (
                  <ActionBtn variant="success" onClick={() => api.post(`/admin/hospitals/${r.id}/activate`, {}).then(() => qc.invalidateQueries({ queryKey: ['hm-hospitals'] }))}>Activate</ActionBtn>
                ) : (
                  <ActionBtn variant="danger" onClick={() => {
                    const reason = prompt('Suspension reason:');
                    if (reason) api.post(`/admin/hospitals/${r.id}/suspend`, { reason, fullSuspension: true }).then(() => qc.invalidateQueries({ queryKey: ['hm-hospitals'] }));
                  }}>Suspend</ActionBtn>
                )}
              </div>
            )},
          ]}
          rows={rows}
          emptyMessage="No hospitals found"
        />
      )}
    </DashboardLayout>
  );
}

const TABS = ['Overview', 'Profile', 'Branding', 'Doctors', 'Staff', 'Patients', 'Appointments', 'Referrals', 'Ads', 'Audit'] as const;

export function HospitalManagementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<typeof TABS[number]>('Overview');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['hm-hospital', id],
    queryFn: () => api.get(`/admin/hospitals/${id}`),
    enabled: Boolean(id),
  });

  const overview = data?.data as {
    hospital: Record<string, unknown>;
    stats: Record<string, unknown>;
    compliance: { level: string; message: string }[];
    recentAudit: Record<string, unknown>[];
  } | undefined;

  const hospital = overview?.hospital;
  const stats = overview?.stats;

  const { data: tabData, isLoading: tabLoading } = useQuery({
    queryKey: ['hm-tab', id, tab],
    queryFn: async () => {
      if (tab === 'Doctors') return api.get(`/admin/hospitals/${id}/doctors`);
      if (tab === 'Staff') return api.get(`/admin/hospitals/${id}/staff`);
      if (tab === 'Patients') return api.get(`/admin/hospitals/${id}/patients`);
      if (tab === 'Appointments') return api.get(`/admin/hospitals/${id}/appointments`);
      if (tab === 'Referrals') return api.get(`/admin/hospitals/${id}/referrals`);
      if (tab === 'Ads') return api.get(`/admin/hospitals/${id}/advertisements`);
      if (tab === 'Audit') return api.get(`/admin/hospitals/${id}/audit-logs`);
      if (tab === 'Branding') return api.get(`/admin/organizations/${id}/branding`);
      return null;
    },
    enabled: Boolean(id) && tab !== 'Overview' && tab !== 'Profile',
  });

  if (isLoading) return <DashboardLayout portal="admin"><LoadingState /></DashboardLayout>;
  if (!hospital) return <DashboardLayout portal="admin"><p>Hospital not found</p></DashboardLayout>;

  const suspend = async () => {
    const reason = prompt('Suspension reason (required):');
    if (!reason) return;
    await api.post(`/admin/hospitals/${id}/suspend`, { reason, fullSuspension: true, hideFromSearch: true, suspendCrmAccess: true });
    qc.invalidateQueries({ queryKey: ['hm-hospital', id] });
  };

  const activate = async () => {
    await api.post(`/admin/hospitals/${id}/activate`, {});
    qc.invalidateQueries({ queryKey: ['hm-hospital', id] });
  };

  const reVerify = async () => {
    const reason = prompt('Re-verification reason:');
    if (!reason) return;
    await api.post(`/admin/hospitals/${id}/re-verify`, { reason });
    qc.invalidateQueries({ queryKey: ['hm-hospital', id] });
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={String(hospital.name)}
        subtitle={`Hospital ID: ${String(hospital.id).slice(0, 8)}...`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => navigate(`${HM_BASE}/hospitals`)}>← Back</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => handleImpersonate(id!)}>Open CRM</button>
            {Boolean(hospital.verificationApplication) && (
              <Link to={`/admin/verification/applications/${(hospital.verificationApplication as { id: string }).id}`} className="btn-secondary text-sm">Verification</Link>
            )}
            <button type="button" className="btn-secondary text-sm" onClick={reVerify}>Re-verify</button>
            {hospital.verificationStatus === 'SUSPENDED' ? (
              <button type="button" className="btn-primary text-sm" onClick={activate}>Activate</button>
            ) : (
              <button type="button" className="btn text-sm border border-red-200 text-red-600" onClick={suspend}>Suspend</button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-4 mb-6">
        <HospitalLogo organization={hospital as never} size="lg" showName />
        <div>
          <VerifiedBadge verified={hospital.verificationStatus === 'APPROVED'} label="Verified Hospital" size="md" />
          <p className="text-sm text-gray-500 mt-1">{String(hospital.city)}, {String(hospital.state)}</p>
          <StatusBadge status={String(hospital.verificationStatus)} />
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
            { label: 'Doctors', value: stats.doctors },
            { label: 'Staff', value: stats.staff },
            { label: 'Branches', value: stats.branches },
            { label: 'Patients', value: stats.patientOrgs },
            { label: 'Appointments', value: stats.appointments },
            { label: 'Revenue', value: formatCurrency(Number(stats.revenue || 0)) },
            { label: 'AASHA Connections', value: (stats.referralConnections as { asha?: number })?.asha },
            { label: 'Referral Partners', value: (stats.referralConnections as { partners?: number })?.partners },
            { label: 'Commission Paid', value: formatCurrency(Number(stats.referralCommissionPaid || 0)) },
            { label: 'Reviews', value: stats.reviews },
            { label: 'Advertisements', value: stats.advertisements },
            { label: 'Leads', value: stats.leads },
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
            ['Email', hospital.email], ['Phone', hospital.phone], ['Website', hospital.website],
            ['Registration #', hospital.registrationNumber], ['Established', hospital.establishmentYear],
            ['Address', hospital.address], ['About', hospital.aboutHospital || hospital.description],
            ['Account Activated', hospital.accountActivated ? 'Yes' : 'No'],
            ['Public Listing', hospital.isPubliclyListed ? 'Yes' : 'No'],
          ].map(([label, val]) => (
            <div key={String(label)}><p className="text-gray-500">{String(label)}</p><p className="font-medium">{String(val ?? '—')}</p></div>
          ))}
        </div>
      )}

      {tab !== 'Overview' && tab !== 'Profile' && (
        tabLoading ? <LoadingState /> : (
          <TabContent tab={tab} data={tabData?.data} hospitalId={id!} />
        )
      )}
    </DashboardLayout>
  );
}

function TabContent({ tab, data, hospitalId }: { tab: string; data: unknown; hospitalId: string }) {
  if (tab === 'Branding' && data) {
    const b = data as { branding?: Record<string, unknown>; history?: Record<string, unknown>[] };
    return (
      <div className="card p-6">
        <HospitalLogo organization={{ branding: b.branding as never }} size="lg" showName className="mb-4" />
        <p className="text-sm text-gray-500">Logo history: {(b.history || []).length} entries</p>
        <Link to={`/admin/organizations/${hospitalId}`} className="text-primary-600 text-sm mt-2 inline-block">Full branding controls →</Link>
      </div>
    );
  }

  if (tab === 'Referrals' && data) {
    const d = data as { connections: Record<string, unknown>[]; attributions: number; commissions: { _sum: { commissionAmount: number } } };
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-4"><p className="text-xs text-gray-500">Connections</p><p className="text-2xl font-bold">{d.connections?.length || 0}</p></div>
          <div className="card p-4"><p className="text-xs text-gray-500">Referred Patients</p><p className="text-2xl font-bold">{d.attributions || 0}</p></div>
          <div className="card p-4"><p className="text-xs text-gray-500">Commission</p><p className="text-2xl font-bold">{formatCurrency(d.commissions?._sum?.commissionAmount || 0)}</p></div>
        </div>
        <AdminTable columns={[
          { key: 'type', label: 'Type', render: (r) => r.ashaProfile ? 'ASHA' : 'Partner' },
          { key: 'name', label: 'Name', render: (r) => String((r.ashaProfile as { ashaName?: string })?.ashaName || (r.referralPartner as { referralPartnerName?: string })?.referralPartnerName) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
        ]} rows={d.connections || []} />
      </div>
    );
  }

  if (tab === 'Audit' && data) {
    return (
      <AdminTable columns={[
        { key: 'action', label: 'Action' },
        { key: 'user', label: 'By', render: (r) => String((r.user as { email?: string })?.email || r.staffName || 'System') },
        { key: 'date', label: 'When', render: (r) => formatDate(r.createdAt as string) },
      ]} rows={data as Record<string, unknown>[]} />
    );
  }

  const list = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data;
  if (!list || !Array.isArray(list)) return <p className="text-gray-500">No data</p>;

  if (tab === 'Doctors') {
    return <AdminTable columns={[
      { key: 'fullName', label: 'Name' },
      { key: 'specialization', label: 'Specialization' },
      { key: 'department', label: 'Dept', render: (r) => String((r.department as { name?: string })?.name || '—') },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
    ]} rows={list as Record<string, unknown>[]} />;
  }

  if (tab === 'Staff') {
    return <AdminTable columns={[
      { key: 'fullName', label: 'Name' },
      { key: 'role', label: 'Role' },
      { key: 'email', label: 'Email', render: (r) => String((r.user as { email?: string })?.email) },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
    ]} rows={list as Record<string, unknown>[]} />;
  }

  if (tab === 'Patients') {
    return <AdminTable columns={[
      { key: 'name', label: 'Patient', render: (r) => String((r.patient as { fullName?: string })?.fullName) },
      { key: 'email', label: 'Email', render: (r) => String((r.patient as { user?: { email?: string } })?.user?.email) },
      { key: 'source', label: 'Source', render: (r) => String(r.sourceType || 'DIRECT') },
    ]} rows={list as Record<string, unknown>[]} />;
  }

  if (tab === 'Appointments') {
    return <AdminTable columns={[
      { key: 'date', label: 'Date', render: (r) => formatDate(r.appointmentDate as string) },
      { key: 'patient', label: 'Patient', render: (r) => String((r.patient as { fullName?: string })?.fullName) },
      { key: 'doctor', label: 'Doctor', render: (r) => String((r.doctor as { fullName?: string })?.fullName) },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
    ]} rows={list as Record<string, unknown>[]} />;
  }

  if (tab === 'Ads') {
    return <AdminTable columns={[
      { key: 'title', label: 'Campaign' },
      { key: 'type', label: 'Type' },
      { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
      { key: 'budget', label: 'Budget', render: (r) => formatCurrency(Number(r.budget)) },
    ]} rows={list as Record<string, unknown>[]} />;
  }

  return null;
}
