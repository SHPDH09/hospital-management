import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const REF_BASE = '/admin/referrals';

function ReferralNav() {
  const tabs = [
    { to: REF_BASE, label: 'Overview', end: true },
    { to: `${REF_BASE}/asha`, label: 'AASHA Workers' },
    { to: `${REF_BASE}/partners`, label: 'Referral Partners' },
    { to: `${REF_BASE}/commissions`, label: 'Commissions' },
    { to: `${REF_BASE}/attributions`, label: 'Patient Attribution' },
  ];
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `text-sm px-3 py-1.5 rounded-lg ${isActive ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 hover:bg-primary-50 hover:text-primary-700'}`}>{t.label}</NavLink>
      ))}
    </div>
  );
}

export function AdminReferralDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['ref-dashboard'], queryFn: () => api.get('/admin/referrals/dashboard') });
  const d = data?.data as Record<string, unknown> | undefined;
  const analytics = d?.analytics as Record<string, unknown> | undefined;

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Referral / AASHA Management" subtitle="Track referral partners, AASHA workers, attribution and commissions" />
      <ReferralNav />
      {isLoading ? <LoadingState /> : (
        <>
          <StatGrid stats={[
            { label: 'AASHA Profiles', value: Number(d?.ashaCount || 0) },
            { label: 'Referral Partners', value: Number(d?.partnerCount || 0) },
            { label: 'Active Campaigns', value: Number(d?.activeCampaigns || 0) },
            { label: 'Referral Leads (30d)', value: Number((analytics?.totals as { month?: number })?.month || 0) },
          ]} />
          <div className="card p-6 mt-6">
            <h3 className="font-semibold mb-2">AI Insight</h3>
            <p className="text-sm text-gray-600">{String(analytics?.insight || 'Referral analytics will populate as campaigns generate leads and conversions.')}</p>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

export function AdminAshaListPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['ref-asha'], queryFn: () => api.get('/admin/referrals/asha?limit=100') });
  const refetch = () => qc.invalidateQueries({ queryKey: ['ref-asha'] });

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="AASHA Workers" subtitle="Community health workers linked to hospitals" />
      <ReferralNav />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'ashaId', label: 'AASHA ID' },
          { key: 'ashaName', label: 'Name' },
          { key: 'mobile', label: 'Mobile' },
          { key: 'district', label: 'District' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'connections', label: 'Hospitals', render: (r) => String((r._count as { connections?: number })?.connections || 0) },
          { key: 'actions', label: 'Actions', render: (r) => (
            r.status !== 'ACTIVE'
              ? <ActionBtn variant="success" onClick={() => api.patch(`/admin/referrals/asha/${r.id}/status`, { status: 'ACTIVE' }).then(refetch)}>Activate</ActionBtn>
              : <ActionBtn variant="danger" onClick={() => api.patch(`/admin/referrals/asha/${r.id}/status`, { status: 'SUSPENDED' }).then(refetch)}>Suspend</ActionBtn>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminReferralPartnersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['ref-partners'], queryFn: () => api.get('/admin/referrals/partners?limit=100') });
  const refetch = () => qc.invalidateQueries({ queryKey: ['ref-partners'] });

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Referral Partners" subtitle="Partner profiles, links and hospital connections" />
      <ReferralNav />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'referralId', label: 'Partner ID' },
          { key: 'referralPartnerName', label: 'Name' },
          { key: 'referralCode', label: 'Code' },
          { key: 'mobile', label: 'Mobile' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            r.status !== 'ACTIVE'
              ? <ActionBtn variant="success" onClick={() => api.patch(`/admin/referrals/partners/${r.id}/status`, { status: 'ACTIVE' }).then(refetch)}>Activate</ActionBtn>
              : <ActionBtn variant="danger" onClick={() => api.patch(`/admin/referrals/partners/${r.id}/status`, { status: 'SUSPENDED' }).then(refetch)}>Suspend</ActionBtn>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminReferralCommissionsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['ref-commissions'], queryFn: () => api.get('/admin/referrals/commissions?limit=100') });
  const refetch = () => qc.invalidateQueries({ queryKey: ['ref-commissions'] });

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Referral Commissions" subtitle="Generated → approved → payable → paid lifecycle" />
      <ReferralNav />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'patient', label: 'Patient', render: (r) => String((r.patient as { fullName?: string })?.fullName || '-') },
          { key: 'org', label: 'Hospital', render: (r) => String((r.organization as { name?: string })?.name || '-') },
          { key: 'referral', label: 'Referral Name', render: (r) => String((r.ashaProfile as { ashaName?: string })?.ashaName || (r.referralPartner as { referralPartnerName?: string })?.referralPartnerName || '-') },
          { key: 'amount', label: 'Commission', render: (r) => formatCurrency(r.commissionAmount as number) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'createdAt', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
          { key: 'actions', label: 'Actions', render: (r) => r.status === 'PENDING' ? (
            <ActionBtn onClick={() => api.patch(`/admin/referrals/commissions/${r.id}/status`, { status: 'APPROVED' }).then(refetch)}>Approve</ActionBtn>
          ) : null },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminReferralAttributionsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['ref-attributions'], queryFn: () => api.get('/admin/referrals/attributions?limit=100') });

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Patient Referral Attribution" subtitle="Patients acquired via referral/AASHA links with referral name tags" />
      <ReferralNav />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'patient', label: 'Patient', render: (r) => String((r.patient as { fullName?: string })?.fullName || '-') },
          { key: 'org', label: 'Hospital', render: (r) => String((r.organization as { name?: string })?.name || '-') },
          { key: 'sourceType', label: 'Source' },
          { key: 'referralDisplayName', label: 'Referral / AASHA Name' },
          { key: 'referralDisplayId', label: 'Referral ID' },
          { key: 'commissionStatus', label: 'Commission', render: (r) => <StatusBadge status={r.commissionStatus as string} /> },
          { key: 'createdAt', label: 'Attributed', render: (r) => formatDate(r.createdAt as string) },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminReferralsPage() {
  return (
    <Routes>
      <Route index element={<AdminReferralDashboardPage />} />
      <Route path="asha" element={<AdminAshaListPage />} />
      <Route path="partners" element={<AdminReferralPartnersPage />} />
      <Route path="commissions" element={<AdminReferralCommissionsPage />} />
      <Route path="attributions" element={<AdminReferralAttributionsPage />} />
      <Route path="*" element={<Navigate to={REF_BASE} replace />} />
    </Routes>
  );
}
