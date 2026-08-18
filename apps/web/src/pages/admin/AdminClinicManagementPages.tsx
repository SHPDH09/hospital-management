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

const CM_BASE = '/admin/clinic-management';

export function ClinicManagementDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['cm-dashboard'],
    queryFn: () => api.get('/admin/clinics/dashboard'),
  });
  const stats = data?.data as Record<string, number> | undefined;

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Clinic Management"
        subtitle="Centralized control — registration, verification, CRM lifecycle"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`${CM_BASE}/clinics`} className="btn-primary text-sm">All Clinics</Link>
            <Link to="/admin/verification/applications?type=CLINIC" className="btn-secondary text-sm">Review Applications</Link>
            <a href={`${apiBaseUrl}/admin/clinics/export`} className="btn-secondary text-sm" target="_blank" rel="noreferrer">Export CSV</a>
          </div>
        }
      />
      {isLoading ? <LoadingState /> : stats && (
        <>
          <StatGrid stats={[
            { label: 'Total Clinics', value: stats.totalClinics || 0 },
            { label: 'New Clinics', value: stats.newClinics || 0 },
            { label: 'Pending Verification', value: stats.pendingVerification || 0 },
            { label: 'Under Review', value: stats.underReview || 0 },
            { label: 'Verified Clinics', value: stats.verifiedClinics || 0 },
            { label: 'Active Clinics', value: stats.activeClinics || 0 },
            { label: 'Rejected', value: stats.rejectedClinics || 0 },
            { label: 'Suspended', value: stats.suspendedClinics || 0 },
            { label: 'Re-verification', value: stats.reVerificationRequired || 0 },
            { label: 'Expiring Docs', value: stats.expiringDocuments || 0 },
            { label: 'Active Subscriptions', value: stats.activeSubscriptions || 0 },
            { label: 'Expired Subscriptions', value: stats.expiredSubscriptions || 0 },
            { label: 'Total Doctors', value: stats.totalDoctors || 0 },
            { label: 'Total Staff', value: stats.totalStaff || 0 },
            { label: 'Total Patients', value: stats.totalPatients || 0 },
            { label: 'Appointments', value: stats.totalAppointments || 0 },
            { label: 'Referral Patients', value: stats.referralPatients || 0 },
            { label: 'Active Ads', value: stats.activeAdvertisements || 0 },
            { label: 'Total Revenue', value: formatCurrency(Number(stats.totalRevenue || 0)) },
          ]} />
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/admin/verification?type=CLINIC" className="card p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold">Verification Center</h3>
              <p className="text-sm text-gray-500 mt-1">Review clinic applications, verify documents, approve clinics</p>
            </Link>
            <Link to={`${CM_BASE}/clinics`} className="card p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold">All Clinics</h3>
              <p className="text-sm text-gray-500 mt-1">Search, filter, manage every registered clinic</p>
            </Link>
            <Link to="/admin/verification/applications?type=CLINIC&status=SUBMITTED" className="card p-6 hover:shadow-md transition-shadow">
              <h3 className="font-semibold">Registration Queue</h3>
              <p className="text-sm text-gray-500 mt-1">{stats.pendingVerification} pending applications</p>
            </Link>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

export function ClinicManagementListPage() {
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
    queryKey: ['cm-clinics', params.toString()],
    queryFn: () => api.get(`/admin/clinics?${params.toString()}`),
  });

  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="All Clinics"
        subtitle="Platform-wide clinic registry"
        actions={<Link to={CM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <input className="input text-sm" placeholder="Clinic name, ID, registration..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
            { key: 'name', label: 'Clinic', render: (r) => (
              <div className="flex items-center gap-2">
                <HospitalLogo organization={r as never} size="xs" />
                <div>
                  <p className="font-medium">{String(r.name)}</p>
                  <VerifiedBadge verified={r.verificationStatus === 'APPROVED' && r.accountActivated === true} label="Verified Clinic" />
                </div>
              </div>
            )},
            { key: 'location', label: 'Location', render: (r) => `${r.city || ''}, ${r.state || ''}` },
            { key: 'verification', label: 'Verification', render: (r) => <StatusBadge status={String(r.verificationStatus)} /> },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
            { key: 'subscription', label: 'Plan', render: (r) => {
              const sub = r.subscription as { plan?: { name?: string }; status?: string } | null;
              return sub?.plan?.name || '—';
            }},
            { key: 'doctors', label: 'Doctors', render: (r) => String((r._count as { doctors?: number })?.doctors || 0) },
            { key: 'patients', label: 'Patients', render: (r) => String((r._count as { patientOrgs?: number })?.patientOrgs || 0) },
            { key: 'actions', label: 'Actions', render: (r) => (
              <div className="flex flex-wrap gap-1">
                <Link to={`${CM_BASE}/clinics/${r.id}`} className="text-xs text-primary-600 font-medium">Manage</Link>
                <ActionBtn onClick={() => handleImpersonate(r.id as string)}>CRM</ActionBtn>
                {r.verificationStatus === 'SUSPENDED' ? (
                  <ActionBtn variant="success" onClick={() => api.post(`/admin/clinics/${r.id}/activate`, {}).then(() => qc.invalidateQueries({ queryKey: ['cm-clinics'] }))}>Activate</ActionBtn>
                ) : (
                  <ActionBtn variant="danger" onClick={() => {
                    const reason = prompt('Suspension reason:');
                    if (reason) api.post(`/admin/clinics/${r.id}/suspend`, { reason, fullSuspension: true }).then(() => qc.invalidateQueries({ queryKey: ['cm-clinics'] }));
                  }}>Suspend</ActionBtn>
                )}
              </div>
            )},
          ]}
          rows={rows}
          emptyMessage="No clinics found"
        />
      )}
    </DashboardLayout>
  );
}

const TABS = ['Overview', 'Profile', 'Branding', 'Doctors', 'Staff', 'Patients', 'Appointments', 'Referrals', 'Ads', 'Audit'] as const;

export function ClinicManagementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<typeof TABS[number]>('Overview');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cm-clinic', id],
    queryFn: () => api.get(`/admin/clinics/${id}`),
    enabled: Boolean(id),
  });

  const overview = data?.data as {
    clinic: Record<string, unknown>;
    stats: Record<string, unknown>;
    compliance: { level: string; message: string }[];
    recentAudit: Record<string, unknown>[];
  } | undefined;

  const clinic = overview?.clinic;
  const stats = overview?.stats;

  const { data: tabData, isLoading: tabLoading } = useQuery({
    queryKey: ['cm-tab', id, tab],
    queryFn: async () => {
      if (tab === 'Doctors') return api.get(`/admin/clinics/${id}/doctors`);
      if (tab === 'Staff') return api.get(`/admin/clinics/${id}/staff`);
      if (tab === 'Patients') return api.get(`/admin/clinics/${id}/patients`);
      if (tab === 'Appointments') return api.get(`/admin/clinics/${id}/appointments`);
      if (tab === 'Referrals') return api.get(`/admin/clinics/${id}/referrals`);
      if (tab === 'Ads') return api.get(`/admin/clinics/${id}/advertisements`);
      if (tab === 'Audit') return api.get(`/admin/clinics/${id}/audit-logs`);
      if (tab === 'Branding') return api.get(`/admin/organizations/${id}/branding`);
      return null;
    },
    enabled: Boolean(id) && tab !== 'Overview' && tab !== 'Profile',
  });

  if (isLoading) return <DashboardLayout portal="admin"><LoadingState /></DashboardLayout>;
  if (!clinic) return <DashboardLayout portal="admin"><p>Clinic not found</p></DashboardLayout>;

  const suspend = async () => {
    const reason = prompt('Suspension reason (required):');
    if (!reason) return;
    await api.post(`/admin/clinics/${id}/suspend`, { reason, fullSuspension: true, hideFromSearch: true, suspendCrmAccess: true });
    qc.invalidateQueries({ queryKey: ['cm-clinic', id] });
  };

  const activate = async () => {
    await api.post(`/admin/clinics/${id}/activate`, {});
    qc.invalidateQueries({ queryKey: ['cm-clinic', id] });
  };

  const reVerify = async () => {
    const reason = prompt('Re-verification reason:');
    if (!reason) return;
    await api.post(`/admin/clinics/${id}/re-verify`, { reason });
    qc.invalidateQueries({ queryKey: ['cm-clinic', id] });
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={String(clinic.name)}
        subtitle={`Clinic ID: ${String(clinic.id).slice(0, 8)}...`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => navigate(`${CM_BASE}/clinics`)}>← Back</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => handleImpersonate(id!)}>Open CRM</button>
            {Boolean(clinic.verificationApplication) && (
              <Link to={`/admin/verification/applications/${(clinic.verificationApplication as { id: string }).id}`} className="btn-secondary text-sm">Verification</Link>
            )}
            <button type="button" className="btn-secondary text-sm" onClick={reVerify}>Re-verify</button>
            {clinic.verificationStatus === 'SUSPENDED' ? (
              <button type="button" className="btn-primary text-sm" onClick={activate}>Activate</button>
            ) : (
              <button type="button" className="btn text-sm border border-red-200 text-red-600" onClick={suspend}>Suspend</button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-4 mb-6">
        <HospitalLogo organization={clinic as never} size="lg" showName />
        <div>
          <VerifiedBadge verified={clinic.verificationStatus === 'APPROVED'} label="Verified Clinic" size="md" />
          <p className="text-sm text-gray-500 mt-1">{String(clinic.city)}, {String(clinic.state)}</p>
          <StatusBadge status={String(clinic.verificationStatus)} />
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
            { label: 'Commission', value: formatCurrency(Number(stats.referralCommissionTotal || 0)) },
            { label: 'Reviews', value: stats.reviews },
            { label: 'Advertisements', value: stats.advertisements },
            { label: 'Leads', value: stats.leads },
            { label: 'Services', value: stats.services },
            { label: 'Health Packages', value: stats.healthPackages },
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
            ['Email', clinic.email], ['Phone', clinic.phone], ['Website', clinic.website],
            ['Registration #', clinic.registrationNumber], ['Established', clinic.establishmentYear],
            ['Address', clinic.address], ['About', clinic.aboutHospital || clinic.description],
            ['Account Activated', clinic.accountActivated ? 'Yes' : 'No'],
            ['Public Listing', clinic.isPubliclyListed ? 'Yes' : 'No'],
          ].map(([label, val]) => (
            <div key={String(label)}><p className="text-gray-500">{String(label)}</p><p className="font-medium">{String(val ?? '—')}</p></div>
          ))}
        </div>
      )}

      {tab !== 'Overview' && tab !== 'Profile' && (
        tabLoading ? <LoadingState /> : (
          <ClinicTabContent tab={tab} data={tabData?.data} clinicId={id!} />
        )
      )}
    </DashboardLayout>
  );
}

function ClinicTabContent({ tab, data, clinicId }: { tab: string; data: unknown; clinicId: string }) {
  if (tab === 'Branding' && data) {
    const b = data as { branding?: Record<string, unknown>; history?: Record<string, unknown>[] };
    return (
      <div className="card p-6">
        <HospitalLogo organization={{ branding: b.branding as never }} size="lg" showName className="mb-4" />
        <p className="text-sm text-gray-500">Logo history: {(b.history || []).length} entries</p>
        <Link to={`/admin/organizations/${clinicId}`} className="text-primary-600 text-sm mt-2 inline-block">Full branding controls →</Link>
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
          { key: 'type', label: 'Type', render: (r) => r.ashaProfile ? 'AASHA' : 'Partner' },
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
