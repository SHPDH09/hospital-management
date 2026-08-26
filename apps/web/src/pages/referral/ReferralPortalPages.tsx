import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, AdminTable, StatusBadge, LoadingState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const referralNav = [
  { to: '/referral', label: 'Overview' },
  { to: '/referral/profile', label: 'My Profile' },
  { to: '/referral/hospitals', label: 'My Hospitals' },
  { to: '/referral/patients', label: 'My Patients' },
  { to: '/referral/analytics', label: 'Analytics' },
  { to: '/referral/commissions', label: 'Commission' },
  { to: '/referral/payouts', label: 'Payouts' },
  { to: '/referral/campaigns', label: 'Campaigns & QR' },
];

function ReferralLayout({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <DashboardLayout portal="referral">
      {title && <PageHeader title={title} />}
      <div className="flex flex-wrap gap-2 mb-6">
        {referralNav.map((n) => (
          <Link key={n.to} to={n.to} className="text-sm px-3 py-1.5 rounded-full bg-gray-100 hover:bg-primary-50 hover:text-primary-700">{n.label}</Link>
        ))}
      </div>
      {children}
    </DashboardLayout>
  );
}

export function ReferralDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['referral-dash'], queryFn: () => api.get('/referral-portal/dashboard') });
  const dash = data?.data as {
    displayName?: string;
    type?: string;
    stats?: Record<string, number>;
    wallet?: Record<string, number>;
    hospitals?: unknown[];
  } | undefined;

  return (
    <ReferralLayout>
      {isLoading ? <LoadingState /> : dash && (
        <>
          <h1 className="text-2xl font-bold mb-2">Welcome, {dash.displayName}</h1>
          <p className="text-gray-500 text-sm mb-6">Type: {dash.type}</p>
          <StatGrid stats={[
            { label: 'Total Referrals', value: dash.stats?.totalReferrals || 0 },
            { label: 'Link Clicks', value: dash.stats?.linkClicks || 0 },
            { label: 'Forms Submitted', value: dash.stats?.formsSubmitted || 0 },
            { label: 'Patients Registered', value: dash.stats?.patientsRegistered || 0 },
            { label: 'Appointments', value: dash.stats?.appointments || 0 },
            { label: 'Treatment Completed', value: dash.stats?.treatmentCompleted || 0 },
            { label: 'Commission Earned', value: formatCurrency(dash.wallet?.totalEarned || 0) },
            { label: 'Pending', value: formatCurrency(dash.wallet?.pending || 0) },
            { label: 'Paid', value: formatCurrency(dash.wallet?.paid || 0) },
          ]} />
        </>
      )}
    </ReferralLayout>
  );
}

export function ReferralProfilePage() {
  const { data, isLoading } = useQuery({ queryKey: ['referral-profile'], queryFn: () => api.get('/referral-portal/profile') });
  const profile = data?.data as { type?: string; profile?: Record<string, unknown>; campaigns?: Record<string, unknown>[] } | undefined;
  const p = profile?.profile;

  return (
    <ReferralLayout title="My Profile">
      {isLoading ? <LoadingState /> : p && (
        <div className="card p-6 max-w-lg">
          <p className="text-sm text-gray-500">Type: {profile?.type}</p>
          <h2 className="text-xl font-bold mt-2">{String(p.ashaName || p.referralPartnerName)}</h2>
          <p className="text-sm mt-2">ID: {String(p.ashaId || p.referralId)}</p>
          <p className="text-sm">Mobile: {String(p.mobile || '-')}</p>
          <p className="text-sm">Email: {String(p.email || '-')}</p>
          <StatusBadge status={String(p.status)} />
        </div>
      )}
    </ReferralLayout>
  );
}

export function ReferralHospitalsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['referral-hospitals'], queryFn: () => api.get('/referral-portal/hospitals') });
  const hospitals = (data?.data as Record<string, unknown>[]) || [];

  return (
    <ReferralLayout title="My Hospitals">
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'hospital', label: 'Hospital', render: (r) => String((r.organization as { name?: string })?.name) },
          { key: 'totalPatients', label: 'Patients' },
          { key: 'totalTreatments', label: 'Treatments' },
          { key: 'totalCommission', label: 'Commission', render: (r) => formatCurrency(Number(r.totalCommission)) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
        ]} rows={hospitals} />
      )}
    </ReferralLayout>
  );
}

export function ReferralPatientsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['referral-patients'], queryFn: () => api.get('/referral-portal/patients') });
  const patients = (data?.data as Record<string, unknown>[]) || [];

  return (
    <ReferralLayout title="My Referred Patients">
      <p className="text-xs text-gray-500 mb-4">Limited referral information only — no sensitive medical records.</p>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'patientId', label: 'Patient ID' },
          { key: 'patientName', label: 'Name' },
          { key: 'hospital', label: 'Hospital' },
          { key: 'registrationDate', label: 'Registered', render: (r) => r.registrationDate ? new Date(String(r.registrationDate)).toLocaleDateString() : '-' },
          { key: 'treatmentStatus', label: 'Treatment' },
          { key: 'commissionStatus', label: 'Commission', render: (r) => <StatusBadge status={String(r.commissionStatus)} /> },
          { key: 'commission', label: 'Amount', render: (r) => formatCurrency(Number(r.commission)) },
        ]} rows={patients} />
      )}
    </ReferralLayout>
  );
}

export function ReferralAnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['referral-analytics'], queryFn: () => api.get('/referral-portal/analytics') });
  const a = data?.data as Record<string, unknown> | undefined;

  return (
    <ReferralLayout title="Referral Analytics">
      {isLoading ? <LoadingState /> : a && (
        <StatGrid stats={[
          { label: 'Clicks', value: Number(a.clicks || 0) },
          { label: 'QR Scans', value: Number(a.qrScans || 0) },
          { label: 'Registrations', value: Number(a.registrations || 0) },
          { label: 'Treatment Completed', value: Number(a.treatmentCompleted || 0) },
        ]} />
      )}
    </ReferralLayout>
  );
}

export function ReferralCommissionsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['referral-commissions'], queryFn: () => api.get('/referral-portal/commissions') });
  const d = data?.data as { wallet?: Record<string, number>; commissions?: Record<string, unknown>[] } | undefined;

  return (
    <ReferralLayout title="Commission Wallet">
      {isLoading ? <LoadingState /> : (
        <>
          <StatGrid stats={[
            { label: 'Total Earned', value: formatCurrency(d?.wallet?.totalEarned || 0) },
            { label: 'Pending', value: formatCurrency(d?.wallet?.pending || 0) },
            { label: 'Paid', value: formatCurrency(d?.wallet?.paid || 0) },
            { label: 'On Hold', value: formatCurrency(d?.wallet?.onHold || 0) },
          ]} />
          <AdminTable columns={[
            { key: 'patient', label: 'Patient', render: (r) => String((r.patient as { id?: string })?.id?.slice(0, 8)) },
            { key: 'hospital', label: 'Hospital', render: (r) => String((r.organization as { name?: string })?.name) },
            { key: 'amount', label: 'Commission', render: (r) => formatCurrency(Number(r.commissionAmount)) },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          ]} rows={d?.commissions || []} />
        </>
      )}
    </ReferralLayout>
  );
}

export function ReferralPayoutsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['referral-payouts'], queryFn: () => api.get('/referral-portal/payouts') });
  const wallet = data?.data as { approved?: number; payouts?: Record<string, unknown>[] } | undefined;

  return (
    <ReferralLayout title="Payouts">
      <p className="text-sm text-gray-600 mb-4">Available: {formatCurrency(wallet?.approved || 0)}</p>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'amount', label: 'Amount', render: (r) => formatCurrency(Number(r.amount)) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'requestedAt', label: 'Requested', render: (r) => new Date(String(r.requestedAt)).toLocaleDateString() },
          { key: 'transactionId', label: 'Txn ID' },
        ]} rows={wallet?.payouts || []} />
      )}
    </ReferralLayout>
  );
}

export function ReferralCampaignsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['referral-campaigns'], queryFn: () => api.get('/referral-portal/campaigns') });
  const campaigns = (data?.data as Record<string, unknown>[]) || [];

  const copyLink = (link: string) => navigator.clipboard.writeText(link);

  return (
    <ReferralLayout title="Referral Link & QR Code">
      {isLoading ? <LoadingState /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <div key={String(c.id)} className="card p-6">
              <h3 className="font-semibold">{String(c.name)}</h3>
              <p className="text-xs text-gray-500 mt-1">{String(c.referralCode)}</p>
              <p className="text-sm text-primary-600 break-all mt-2">{String(c.referralLink)}</p>
              <div className="flex gap-2 mt-3">
                <button type="button" className="btn-secondary text-xs" onClick={() => copyLink(String(c.referralLink))}>Copy Link</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(String(c.referralLink))}`} target="_blank" rel="noreferrer" className="btn-secondary text-xs">WhatsApp</a>
              </div>
              {Boolean(c.qrCodeUrl) && (
                <div className="mt-4 text-center">
                  <img src={String(c.qrCodeUrl)} alt="QR Code" className="mx-auto w-40 h-40" />
                  <a href={String(c.qrCodeUrl)} download className="text-xs text-primary-600 mt-2 inline-block">Download QR</a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ReferralLayout>
  );
}
