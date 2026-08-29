import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn, ApiErrorState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { adminGet } from '@/lib/admin-api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const subNav = [
  { to: '/admin/advertisements', label: 'Dashboard', end: true },
  { to: '/admin/advertisements/all', label: 'All Ads' },
  { to: '/admin/advertisements/pending', label: 'Pending Approval' },
  { to: '/admin/advertisements/active', label: 'Active' },
  { to: '/admin/advertisements/scheduled', label: 'Scheduled' },
  { to: '/admin/advertisements/expired', label: 'Expired' },
  { to: '/admin/advertisements/create', label: 'Create Ad' },
  { to: '/admin/advertisements/plans', label: 'Ad Plans & Pricing' },
  { to: '/admin/advertisements/advertisers', label: 'Advertisers' },
  { to: '/admin/advertisements/leads', label: 'Leads & Conversions' },
  { to: '/admin/advertisements/revenue', label: 'Revenue Analytics' },
  { to: '/admin/advertisements/emergency', label: 'Emergency Controls' },
];

const AD_TYPES = [
  'HOMEPAGE_BANNER', 'FEATURED_HOSPITAL', 'FEATURED_CLINIC', 'FEATURED_DOCTOR',
  'FEATURED_SERVICE', 'HEALTH_PACKAGE', 'SEARCH_AD', 'PROMOTIONAL_CARD', 'SEARCH_PROMOTION',
];

const emptyAd = {
  organizationId: '', campaignName: '', title: '', description: '', category: '', type: 'HOMEPAGE_BANNER',
  imageUrl: '', mobileImageUrl: '', ctaText: 'Learn More', targetUrl: '', landingType: 'hospital_profile',
  targetCities: '', targetStates: '', budget: '', dailyBudget: '', startDate: '', endDate: '',
  platforms: ['website'] as string[], healthcareCategories: '', priority: '1', placement: 'homepage',
  paymentStatus: 'UNPAID', paidAmount: '',
};

function AdLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Advertisement Management" subtitle="Campaigns, approval, analytics, billing, and revenue" />
      <nav className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 pb-2">
        {subNav.map((item) => {
          const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <Link key={item.to} to={item.to}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50')}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </DashboardLayout>
  );
}

function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ads-dashboard'],
    queryFn: () => adminGet('/admin/advertisements/dashboard'),
  });
  const d = data?.data as Record<string, unknown> | undefined;
  if (isLoading) return <AdLayout><LoadingState /></AdLayout>;
  if (isError) {
    return (
      <AdLayout>
        <ApiErrorState message={error instanceof Error ? error.message : 'Failed to load advertisement dashboard'} onRetry={() => refetch()} />
      </AdLayout>
    );
  }

  return (
    <AdLayout>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Advertisements', value: d?.totalAdvertisements },
          { label: 'Active Campaigns', value: d?.activeCampaigns },
          { label: 'Pending Approval', value: d?.pendingApproval },
          { label: 'Rejected Ads', value: d?.rejectedAds },
          { label: 'Scheduled Ads', value: d?.scheduledAds },
          { label: 'Expired Ads', value: d?.expiredAds },
          { label: "Today's Impressions", value: d?.todayImpressions },
          { label: "Today's Clicks", value: d?.todayClicks },
          { label: 'Total Impressions', value: d?.totalImpressions },
          { label: 'Total Clicks', value: d?.totalClicks },
          { label: 'Total Leads', value: d?.totalLeads },
          { label: 'Total Bookings', value: d?.totalBookings },
          { label: 'Ad Revenue', value: formatCurrency(Number(d?.totalAdRevenue || 0)) },
          { label: 'Conversion Rate', value: d?.conversionRate },
          { label: 'CTR', value: d?.ctr },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-xl font-bold text-primary-600 mt-1">{String(s.value ?? 0)}</p>
          </div>
        ))}
      </div>
    </AdLayout>
  );
}

function AdListPage({ status, title }: { status?: string; title: string }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ type: '', orgType: '', paymentStatus: '', city: '' });
  const qs = new URLSearchParams({ limit: '100', ...(status && { status }), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
  const { data, isLoading } = useQuery({
    queryKey: ['ads-list', status, filters],
    queryFn: () => api.get(`/admin/advertisements?${qs}`),
  });
  const [rejecting, setRejecting] = useState<Record<string, unknown> | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);

  const rows = (data?.data as Record<string, unknown>[]) || [];
  const refetch = () => qc.invalidateQueries({ queryKey: ['ads-list'] });

  const action = async (id: string, ep: string, body?: object) => {
    await api.post(`/admin/advertisements/${id}/${ep}`, body || {});
    refetch();
    qc.invalidateQueries({ queryKey: ['ads-dashboard'] });
  };

  return (
    <AdLayout>
      <div className="flex flex-wrap gap-2 mb-4">
        <select className="input text-sm" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">All Types</option>
          {AD_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input text-sm" value={filters.orgType} onChange={(e) => setFilters((f) => ({ ...f, orgType: e.target.value }))}>
          <option value="">All Advertisers</option>
          <option value="HOSPITAL">Hospital</option>
          <option value="CLINIC">Clinic</option>
          <option value="DIAGNOSTIC_CENTER">Diagnostic</option>
          <option value="PHARMACY">Pharmacy</option>
        </select>
        <select className="input text-sm" value={filters.paymentStatus} onChange={(e) => setFilters((f) => ({ ...f, paymentStatus: e.target.value }))}>
          <option value="">Payment Status</option>
          {['UNPAID', 'PAID', 'PARTIALLY_PAID', 'REFUNDED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="input text-sm" placeholder="City" value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} />
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'advertiser', label: 'Advertiser', render: (r) => String((r.organization as { name?: string })?.name || 'Platform') },
          { key: 'campaignName', label: 'Campaign', render: (r) => String(r.campaignName || r.title) },
          { key: 'type', label: 'Type', render: (r) => String(r.type).replace(/_/g, ' ') },
          { key: 'startDate', label: 'Start', render: (r) => r.startDate ? formatDate(String(r.startDate)) : '-' },
          { key: 'endDate', label: 'End', render: (r) => r.endDate ? formatDate(String(r.endDate)) : '-' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'paymentStatus', label: 'Payment', render: (r) => <StatusBadge status={r.paymentStatus as string} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex flex-wrap gap-1">
              <ActionBtn onClick={() => setPreview(r)}>Preview</ActionBtn>
              {r.status === 'PENDING' && <>
                <ActionBtn variant="success" onClick={() => action(String(r.id), 'approve')}>Approve</ActionBtn>
                <ActionBtn variant="danger" onClick={() => { setRejecting(r); setRejectReason(''); }}>Reject</ActionBtn>
                <ActionBtn onClick={() => action(String(r.id), 'request-changes', { reason: 'Please update creative and resubmit.' })}>Request Changes</ActionBtn>
              </>}
              {r.status === 'ACTIVE' && <ActionBtn onClick={() => action(String(r.id), 'pause')}>Pause</ActionBtn>}
              {r.status === 'PAUSED' && <ActionBtn onClick={() => action(String(r.id), 'resume')}>Resume</ActionBtn>}
              <ActionBtn onClick={() => action(String(r.id), 'duplicate')}>Duplicate</ActionBtn>
            </div>
          )},
        ]} rows={rows} emptyMessage={`No ${title.toLowerCase()} found`} />
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold mb-2">{String(preview.title)}</h3>
            {preview.imageUrl ? <img src={String(preview.imageUrl)} alt="" className="w-full rounded-lg mb-3" /> : null}
            <p className="text-sm text-gray-600 mb-2">{String(preview.description || '')}</p>
            <p className="text-xs text-gray-500">CTR: {preview.impressions ? ((Number(preview.clicks) / Number(preview.impressions)) * 100).toFixed(2) : 0}% · Impressions: {String(preview.impressions)} · Clicks: {String(preview.clicks)}</p>
            <button className="btn-secondary text-sm mt-4" onClick={() => setPreview(null)}>Close</button>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="font-semibold mb-3">Reject Advertisement</h3>
            <select className="input w-full mb-2" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
              <option value="">Select reason...</option>
              <option value="Advertisement content does not meet platform advertising requirements.">Content does not meet requirements</option>
              <option value="Misleading or false medical claim detected.">Misleading medical claim</option>
              <option value="Unverified provider — organization must be verified before publishing.">Unverified provider</option>
              <option value="Inappropriate content or imagery.">Inappropriate content</option>
              <option value="Invalid pricing or expired offer.">Invalid pricing</option>
              <option value="Policy violation.">Policy violation</option>
            </select>
            <textarea className="input w-full" rows={3} placeholder="Custom reason (min 10 chars)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-secondary text-sm" onClick={() => setRejecting(null)}>Cancel</button>
              <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm" disabled={rejectReason.length < 10}
                onClick={async () => { await action(String(rejecting.id), 'reject', { reason: rejectReason }); setRejecting(null); }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </AdLayout>
  );
}

function CreateAdPage() {
  const qc = useQueryClient();
  const { data: orgs } = useQuery({ queryKey: ['orgs-ad'], queryFn: () => api.get('/admin/organizations?limit=100') });
  const { data: plans } = useQuery({ queryKey: ['ad-plans'], queryFn: () => api.get('/admin/advertisements/plans') });
  const [form, setForm] = useState(emptyAd);
  const [saving, setSaving] = useState(false);

  const orgList = (orgs?.data as { id: string; name: string; type: string }[]) || [];
  const planList = (plans?.data as { id: string; name: string; price: number; durationDays: number; adType: string }[]) || [];

  const save = async (autoApprove = false) => {
    setSaving(true);
    await api.post('/admin/advertisements', {
      organizationId: form.organizationId || undefined,
      campaignName: form.campaignName,
      title: form.title,
      description: form.description,
      category: form.category,
      type: form.type,
      imageUrl: form.imageUrl,
      mobileImageUrl: form.mobileImageUrl,
      ctaText: form.ctaText,
      targetUrl: form.targetUrl,
      landingType: form.landingType,
      targetCities: form.targetCities ? form.targetCities.split(',').map((s) => s.trim()) : [],
      targetStates: form.targetStates ? form.targetStates.split(',').map((s) => s.trim()) : [],
      healthcareCategories: form.healthcareCategories ? form.healthcareCategories.split(',').map((s) => s.trim()) : [],
      platforms: form.platforms,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      budget: form.budget ? Number(form.budget) : undefined,
      dailyBudget: form.dailyBudget ? Number(form.dailyBudget) : undefined,
      priority: Number(form.priority),
      placement: form.placement,
      paymentStatus: form.paymentStatus,
      paidAmount: form.paidAmount ? Number(form.paidAmount) : undefined,
      autoApprove,
    });
    setSaving(false);
    setForm(emptyAd);
    qc.invalidateQueries({ queryKey: ['ads'] });
  };

  return (
    <AdLayout>
      <div className="card p-6 max-w-3xl">
        <h2 className="font-semibold mb-4">Create Advertisement</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="col-span-2">
            <label className="text-xs text-gray-500">Advertiser (Organization)</label>
            <select className="input w-full" value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}>
              <option value="">Platform Direct</option>
              {orgList.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.type})</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Campaign Name</label><input className="input w-full" value={form.campaignName} onChange={(e) => setForm({ ...form, campaignName: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500">Ad Title *</label><input className="input w-full" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Description</label><textarea className="input w-full" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <label className="text-xs text-gray-500">Ad Type</label>
            <select className="input w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {AD_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500">Ad Plan</label>
            <select className="input w-full" onChange={(e) => {
              const plan = planList.find((p) => p.id === e.target.value);
              if (plan) setForm({ ...form, type: plan.adType, budget: String(plan.price) });
            }}>
              <option value="">Custom pricing</option>
              {planList.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)} / {p.durationDays}d</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Banner Image URL</label><input className="input w-full" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="1200x400 recommended" /></div>
          <div><label className="text-xs text-gray-500">Mobile Image URL</label><input className="input w-full" value={form.mobileImageUrl} onChange={(e) => setForm({ ...form, mobileImageUrl: e.target.value })} placeholder="750x300 recommended" /></div>
          <div><label className="text-xs text-gray-500">CTA Text</label><input className="input w-full" value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500">CTA / Landing URL</label><input className="input w-full" value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500">Target Cities (comma-separated)</label><input className="input w-full" value={form.targetCities} onChange={(e) => setForm({ ...form, targetCities: e.target.value })} placeholder="Mumbai, Pune" /></div>
          <div><label className="text-xs text-gray-500">Healthcare Categories</label><input className="input w-full" value={form.healthcareCategories} onChange={(e) => setForm({ ...form, healthcareCategories: e.target.value })} placeholder="Cardiology, Dental" /></div>
          <div><label className="text-xs text-gray-500">Start Date</label><input type="datetime-local" className="input w-full" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500">End Date</label><input type="datetime-local" className="input w-full" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500">Budget (₹)</label><input type="number" className="input w-full" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500">Daily Budget (₹)</label><input type="number" className="input w-full" value={form.dailyBudget} onChange={(e) => setForm({ ...form, dailyBudget: e.target.value })} /></div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 mb-1 block">Platforms</label>
            <div className="flex gap-4">
              {['website', 'android', 'ios'].map((p) => (
                <label key={p} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={form.platforms.includes(p)}
                    onChange={(e) => setForm({ ...form, platforms: e.target.checked ? [...form.platforms, p] : form.platforms.filter((x) => x !== p) })} />
                  {p}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button className="btn-primary text-sm" disabled={!form.title || saving} onClick={() => save(false)}>Submit for Approval</button>
          <button className="btn-secondary text-sm" disabled={!form.title || saving} onClick={() => save(true)}>Create & Auto-Approve</button>
        </div>
      </div>
    </AdLayout>
  );
}

function PlansPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['ad-plans'], queryFn: () => api.get('/admin/advertisements/plans') });
  const [form, setForm] = useState({ name: '', adType: 'HOMEPAGE_BANNER', price: '', durationDays: '7', description: '', placement: '' });
  const [showForm, setShowForm] = useState(false);

  const plans = (data?.data as Record<string, unknown>[]) || [];

  const save = async () => {
    await api.post('/admin/advertisements/plans', {
      name: form.name, adType: form.adType, price: Number(form.price), durationDays: Number(form.durationDays),
      description: form.description, placement: form.placement,
    });
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ['ad-plans'] });
  };

  return (
    <AdLayout>
      <div className="flex justify-between mb-4">
        <p className="text-sm text-gray-600">Fixed-price ad plans. MVP uses fixed pricing; CPC/CPM can be added later.</p>
        <button className="btn-primary text-sm" onClick={() => setShowForm(true)}>+ Create Plan</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Plan' },
          { key: 'adType', label: 'Type', render: (r) => String(r.adType).replace(/_/g, ' ') },
          { key: 'price', label: 'Price', render: (r) => formatCurrency(r.price as number) },
          { key: 'durationDays', label: 'Duration', render: (r) => `${r.durationDays} days` },
          { key: 'placement', label: 'Placement' },
          { key: 'isActive', label: 'Active', render: (r) => r.isActive ? 'Yes' : 'No' },
        ]} rows={plans} />
      )}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">Create Ad Plan</h3>
            <div className="space-y-3">
              <input className="input w-full" placeholder="Plan name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select className="input w-full" value={form.adType} onChange={(e) => setForm({ ...form, adType: e.target.value })}>
                {AD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="number" className="input w-full" placeholder="Price (₹)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <input type="number" className="input w-full" placeholder="Duration (days)" value={form.durationDays} onChange={(e) => setForm({ ...form, durationDays: e.target.value })} />
              <input className="input w-full" placeholder="Placement" value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })} />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-secondary text-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary text-sm" onClick={save}>Create</button>
            </div>
          </div>
        </div>
      )}
    </AdLayout>
  );
}

function AdvertisersPage() {
  const { data, isLoading } = useQuery({ queryKey: ['ad-advertisers'], queryFn: () => api.get('/admin/advertisements/advertisers') });
  const rows = (data?.data as Record<string, unknown>[]) || [];
  return (
    <AdLayout>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Advertiser' },
          { key: 'type', label: 'Type' },
          { key: 'city', label: 'City' },
          { key: 'verificationStatus', label: 'Verified', render: (r) => <StatusBadge status={r.verificationStatus as string} /> },
          { key: 'ads', label: 'Campaigns', render: (r) => String((r._count as { advertisements?: number })?.advertisements || 0) },
        ]} rows={rows} />
      )}
    </AdLayout>
  );
}

function LeadsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['ad-leads'], queryFn: () => api.get('/admin/advertisements/leads') });
  const rows = (data?.data as Record<string, unknown>[]) || [];
  return (
    <AdLayout>
      <p className="text-sm text-gray-500 mb-4">Leads generated from advertisements (source = Advertisement).</p>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Lead' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'campaign', label: 'Campaign', render: (r) => String((r.advertisement as { campaignName?: string; title?: string })?.campaignName || (r.advertisement as { title?: string })?.title || '-') },
          { key: 'org', label: 'Hospital', render: (r) => String((r.organization as { name?: string })?.name) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'createdAt', label: 'Date', render: (r) => formatDate(String(r.createdAt)) },
        ]} rows={rows} />
      )}
    </AdLayout>
  );
}

function RevenuePage() {
  const { data, isLoading } = useQuery({ queryKey: ['ad-revenue'], queryFn: () => api.get('/admin/advertisements/revenue-analytics') });
  const d = data?.data as { total?: number; byType?: Record<string, number>; byCity?: Record<string, number>; byAdvertiser?: Record<string, number> } | undefined;
  if (isLoading) return <AdLayout><LoadingState /></AdLayout>;

  const table = (obj?: Record<string, number>, label = 'Item') => (
    <AdminTable columns={[
      { key: 'name', label },
      { key: 'revenue', label: 'Revenue', render: (r) => formatCurrency(r.revenue as number) },
    ]} rows={Object.entries(obj || {}).map(([name, revenue]) => ({ name, revenue }))} />
  );

  return (
    <AdLayout>
      <div className="card p-6 mb-6 text-center">
        <p className="text-sm text-gray-500">Total Ad Revenue</p>
        <p className="text-3xl font-bold text-primary-600">{formatCurrency(d?.total || 0)}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div><h3 className="font-semibold mb-2">By Ad Type</h3>{table(d?.byType, 'Type')}</div>
        <div><h3 className="font-semibold mb-2">By City</h3>{table(d?.byCity, 'City')}</div>
        <div><h3 className="font-semibold mb-2">By Advertiser</h3>{table(d?.byAdvertiser, 'Advertiser')}</div>
      </div>
    </AdLayout>
  );
}

function EmergencyAdsPage() {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const pauseAll = async () => {
    await api.post('/admin/advertisements/emergency/pause-all', { reason });
    qc.invalidateQueries({ queryKey: ['ads'] });
  };
  const resumeAll = async () => {
    await api.post('/admin/advertisements/emergency/resume-all', { reason });
    qc.invalidateQueries({ queryKey: ['ads'] });
  };
  return (
    <AdLayout>
      <div className="card p-6 space-y-4 max-w-lg">
        <p className="text-sm text-gray-600">Emergency advertisement controls — pause all ads without affecting other platform modules.</p>
        <textarea className="input w-full" rows={2} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex gap-2">
          <button className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm" disabled={reason.length < 3} onClick={pauseAll}>Pause All Ads</button>
          <button className="btn-primary text-sm" disabled={reason.length < 3} onClick={resumeAll}>Resume All Ads</button>
        </div>
      </div>
    </AdLayout>
  );
}

export function AdminAdvertisementsPage() {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="all" element={<AdListPage title="All Advertisements" />} />
      <Route path="pending" element={<AdListPage status="PENDING" title="Pending Approval" />} />
      <Route path="active" element={<AdListPage status="ACTIVE" title="Active Campaigns" />} />
      <Route path="scheduled" element={<AdListPage status="SCHEDULED" title="Scheduled Campaigns" />} />
      <Route path="expired" element={<AdListPage status="EXPIRED" title="Expired Campaigns" />} />
      <Route path="create" element={<CreateAdPage />} />
      <Route path="plans" element={<PlansPage />} />
      <Route path="advertisers" element={<AdvertisersPage />} />
      <Route path="leads" element={<LeadsPage />} />
      <Route path="revenue" element={<RevenuePage />} />
      <Route path="emergency" element={<EmergencyAdsPage />} />
      <Route path="*" element={<Navigate to="/admin/advertisements" replace />} />
    </Routes>
  );
}
