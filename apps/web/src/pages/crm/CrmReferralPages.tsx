import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, StatGrid } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export function CrmReferralDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['crm-referral-dash'], queryFn: () => api.get('/crm/referrals/dashboard') });
  const stats = data?.data as Record<string, unknown> | undefined;

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="AASHA / Referral Management" subtitle="Manage referral partners and track performance" />
      {isLoading ? <LoadingState /> : (
        <>
          <StatGrid stats={[
            { label: 'Active AASHA', value: Number(stats?.ashaCount || 0) },
            { label: 'Referral Partners', value: Number(stats?.partnerCount || 0) },
            { label: 'Referred Patients', value: Number(stats?.referredPatients || 0) },
            { label: 'Pending Commission', value: formatCurrency(Number(stats?.pendingCommission || 0)) },
            { label: 'Paid Commission', value: formatCurrency(Number(stats?.paidCommission || 0)) },
          ]} />
          <div className="flex flex-wrap gap-2">
            <Link to="/crm/referrals/list" className="btn-primary">View All Referrals</Link>
            <Link to="/crm/referrals/asha/new" className="btn-secondary">Add AASHA</Link>
            <Link to="/crm/referrals/partners/new" className="btn-secondary">Add Referral Partner</Link>
            <Link to="/crm/referrals/leaderboard" className="btn-secondary">Leaderboard</Link>
            <Link to="/crm/referrals/settings" className="btn-secondary">Settings</Link>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

export function CrmReferralListPage() {
  const { data, isLoading } = useQuery({ queryKey: ['crm-referrals'], queryFn: () => api.get('/crm/referrals') });
  const items = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="All Referrals" subtitle="AASHA workers and referral partners"
        actions={<div className="flex gap-2">
          <Link to="/crm/referrals/asha/new" className="btn-primary text-sm">Add AASHA</Link>
          <Link to="/crm/referrals/partners/new" className="btn-secondary text-sm">Add Partner</Link>
        </div>} />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'type', label: 'Type', render: (r) => <StatusBadge status={String(r.type)} /> },
          { key: 'name', label: 'Name', render: (r) => {
            const asha = r.ashaProfile as { ashaName?: string; ashaId?: string } | undefined;
            const partner = r.referralPartner as { referralPartnerName?: string; referralId?: string } | undefined;
            return asha ? `${asha.ashaName} (${asha.ashaId})` : `${partner?.referralPartnerName} (${partner?.referralId})`;
          }},
          { key: 'totalPatients', label: 'Patients' },
          { key: 'totalTreatments', label: 'Treatments' },
          { key: 'totalCommission', label: 'Commission', render: (r) => formatCurrency(Number(r.totalCommission)) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
        ]} rows={items} />
      )}
    </DashboardLayout>
  );
}

function ReferralCreateForm({ type }: { type: 'asha' | 'partners' }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    ashaName: '', referralPartnerName: '', mobile: '', email: '', area: '', district: '', state: '',
    password: 'Password123!', createLogin: true,
  });
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    try {
      const endpoint = type === 'asha' ? '/crm/referrals/asha' : '/crm/referrals/partners';
      const res = await api.post(endpoint, form);
      if (!res.success) throw new Error(res.error);
      setResult(res.data as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: ['crm-referrals'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  if (result) {
    return (
      <DashboardLayout portal="crm">
        <div className="card p-8 max-w-lg mx-auto text-center">
          <h2 className="text-xl font-bold text-green-700 mb-4">Created Successfully</h2>
          <p className="text-sm text-gray-600 mb-2">Referral Code: <strong>{String(result.referralCode)}</strong></p>
          <p className="text-sm text-gray-600 mb-4">Link: <a href={String(result.referralLink)} className="text-primary-600">{String(result.referralLink)}</a></p>
          {Boolean(result.qrCodeUrl) && <img src={String(result.qrCodeUrl)} alt="QR Code" className="mx-auto w-48 h-48" />}
          <Link to="/crm/referrals/list" className="btn-primary mt-4 inline-block">View All Referrals</Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout portal="crm">
      <PageHeader title={type === 'asha' ? 'Add AASHA' : 'Add Referral Partner'} />
      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
      <div className="card p-6 max-w-xl space-y-4">
        {type === 'asha' ? (
          <input className="input" placeholder="AASHA Name *" value={form.ashaName} onChange={(e) => setForm({ ...form, ashaName: e.target.value })} />
        ) : (
          <input className="input" placeholder="Referral Partner Name *" value={form.referralPartnerName} onChange={(e) => setForm({ ...form, referralPartnerName: e.target.value })} />
        )}
        <input className="input" placeholder="Mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
        <input className="input" placeholder="Email (for login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input" placeholder="Area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
        <input className="input" placeholder="District" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
        <input className="input" placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
        <button type="button" className="btn-primary w-full" onClick={submit}>Create & Generate Link</button>
      </div>
    </DashboardLayout>
  );
}

export const CrmAshaCreatePage = () => <ReferralCreateForm type="asha" />;
export const CrmPartnerCreatePage = () => <ReferralCreateForm type="partners" />;

export function CrmReferredPatientsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['crm-referred-patients'], queryFn: () => api.get('/crm/referrals/patients') });
  const patients = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Referred Patients" subtitle="Patients attributed to referrals" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'patient', label: 'Patient', render: (r) => String((r.patient as { fullName?: string })?.fullName) },
          { key: 'sourceType', label: 'Source', render: (r) => <StatusBadge status={String(r.sourceType)} /> },
          { key: 'referral', label: 'Referral', render: (r) => {
            const asha = r.ashaProfile as { ashaName?: string } | undefined;
            const partner = r.referralPartner as { referralPartnerName?: string } | undefined;
            return asha?.ashaName || partner?.referralPartnerName || String(r.referralDisplayName);
          }},
          { key: 'treatmentStatus', label: 'Treatment', render: (r) => String(r.treatmentStatus || '-') },
          { key: 'commissionStatus', label: 'Commission', render: (r) => <StatusBadge status={String(r.commissionStatus)} /> },
        ]} rows={patients} />
      )}
    </DashboardLayout>
  );
}

export function CrmReferralCommissionsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-ref-commissions'], queryFn: () => api.get('/crm/referrals/commissions') });
  const items = (data?.data as Record<string, unknown>[]) || [];

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/crm/referrals/commissions/${id}`, { status });
    qc.invalidateQueries({ queryKey: ['crm-ref-commissions'] });
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Referral Commissions" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'patient', label: 'Patient', render: (r) => String((r.patient as { fullName?: string })?.fullName) },
          { key: 'amount', label: 'Commission', render: (r) => formatCurrency(Number(r.commissionAmount)) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'fraud', label: 'Fraud', render: (r) => r.fraudFlag ? '⚠ Yes' : '-' },
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex gap-2">
              {r.status === 'PENDING' && <button type="button" className="text-xs text-green-600" onClick={() => updateStatus(String(r.id), 'APPROVED')}>Approve</button>}
              {r.status === 'APPROVED' && <button type="button" className="text-xs text-primary-600" onClick={() => updateStatus(String(r.id), 'PAID')}>Mark Paid</button>}
            </div>
          )},
        ]} rows={items} />
      )}
    </DashboardLayout>
  );
}

export function CrmReferralLeaderboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['crm-ref-leaderboard'], queryFn: () => api.get('/crm/referrals/leaderboard') });
  const items = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Referral Leaderboard" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Name', render: (r) => {
            const asha = r.ashaProfile as { ashaName?: string } | undefined;
            const partner = r.referralPartner as { referralPartnerName?: string } | undefined;
            return asha?.ashaName || partner?.referralPartnerName || '-';
          }},
          { key: 'totalPatients', label: 'Patients' },
          { key: 'totalTreatments', label: 'Treatments' },
          { key: 'totalCommission', label: 'Commission', render: (r) => formatCurrency(Number(r.totalCommission)) },
        ]} rows={items} />
      )}
    </DashboardLayout>
  );
}

export function CrmReferralAnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['crm-ref-analytics'], queryFn: () => api.get('/crm/referrals/analytics') });
  const analytics = data?.data as Record<string, Record<string, number>> | undefined;

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Referral Analytics" />
      {isLoading ? <LoadingState /> : analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries({ ...analytics.traffic, ...analytics.registration, ...analytics.patients }).map(([k, v]) => (
            <div key={k} className="card p-4"><p className="text-xs text-gray-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</p><p className="text-2xl font-bold">{v}</p></div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export function CrmReferralSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-ref-settings'], queryFn: () => api.get('/crm/referrals/settings') });
  const settings = data?.data as Record<string, unknown> | undefined;

  const toggle = async (key: string, value: boolean) => {
    await api.patch('/crm/referrals/settings', { [key]: value });
    qc.invalidateQueries({ queryKey: ['crm-ref-settings'] });
  };

  if (isLoading) return <DashboardLayout portal="crm"><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Referral Settings" subtitle="Hospital-level referral configuration" />
      <div className="card p-6 max-w-lg space-y-4">
        {[
          { key: 'referralEnabled', label: 'Referral System ON' },
          { key: 'acceptAsha', label: 'Accept AASHA' },
          { key: 'acceptReferralPartners', label: 'Accept Referral Partners' },
          { key: 'requireApproval', label: 'Require Referral Approval' },
        ].map((s) => (
          <label key={s.key} className="flex justify-between items-center text-sm">
            <span>{s.label}</span>
            <input type="checkbox" defaultChecked={Boolean(settings?.[s.key])} onChange={(e) => toggle(s.key, e.target.checked)} />
          </label>
        ))}
        <p className="text-xs text-gray-500">Platform-wide commission policy can be overridden by Super Admin.</p>
      </div>
    </DashboardLayout>
  );
}

export function CrmReferralCampaignsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['crm-ref-campaigns'], queryFn: () => api.get('/crm/referrals/campaigns') });
  const campaigns = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Referral Campaigns & QR Codes" />
      {isLoading ? <LoadingState /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <div key={String(c.id)} className="card p-4">
              <h3 className="font-semibold">{String(c.name)}</h3>
              <p className="text-xs text-gray-500 mt-1">Code: {String(c.referralCode)}</p>
              <p className="text-xs text-primary-600 truncate">{String(c.referralLink)}</p>
              <div className="flex gap-4 mt-3 text-sm">
                <span>Clicks: {String(c.clicks)}</span>
                <span>QR: {String(c.qrScans)}</span>
                <span>Patients: {String(c.registrations)}</span>
              </div>
              {Boolean(c.qrCodeUrl) && <img src={String(c.qrCodeUrl)} alt="QR" className="w-24 h-24 mt-2" />}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
