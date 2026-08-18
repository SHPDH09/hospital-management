import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

function useList(endpoint: string) {
  return useQuery({ queryKey: [endpoint], queryFn: () => api.get(endpoint) });
}

const emptyCoupon = {
  code: '',
  discountType: 'PERCENT' as 'PERCENT' | 'FIXED',
  discountValue: 10,
  minAmount: '',
  maxDiscount: '',
  usageLimit: '',
  expiresAt: '',
  platformWide: true,
  organizationId: '',
};

export function AdminCouponsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useList('/admin/coupons?limit=100');
  const { data: orgs } = useList('/admin/organizations?limit=100');
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(emptyCoupon);
  const refetch = () => qc.invalidateQueries({ queryKey: ['/admin/coupons?limit=100'] });

  const orgList = (orgs?.data as { id: string; name: string; type: string }[]) || [];

  const save = async () => {
    const payload = {
      code: form.code,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minAmount: form.minAmount ? Number(form.minAmount) : undefined,
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
      expiresAt: form.expiresAt || undefined,
      platformWide: form.platformWide,
      organizationId: form.platformWide ? undefined : form.organizationId || undefined,
    };
    if (editing?.id) await api.patch(`/admin/coupons/${editing.id}`, payload);
    else await api.post('/admin/coupons', payload);
    setEditing(null);
    setForm(emptyCoupon);
    refetch();
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setForm({
      code: String(row.code || ''),
      discountType: (row.discountType as 'PERCENT' | 'FIXED') || 'PERCENT',
      discountValue: Number(row.discountValue || 0),
      minAmount: row.minAmount ? String(row.minAmount) : '',
      maxDiscount: row.maxDiscount ? String(row.maxDiscount) : '',
      usageLimit: row.usageLimit ? String(row.usageLimit) : '',
      expiresAt: row.expiresAt ? String(row.expiresAt).slice(0, 10) : '',
      platformWide: Boolean(row.platformWide),
      organizationId: String((row.organization as { id?: string })?.id || row.organizationId || ''),
    });
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Coupon Management"
        subtitle="Create platform-wide or hospital-specific discount coupons"
        actions={<button className="btn-primary text-sm" onClick={() => { setEditing({}); setForm(emptyCoupon); }}>+ Create Coupon</button>}
      />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'code', label: 'Code', render: (r) => <span className="font-mono font-medium">{String(r.code)}</span> },
          { key: 'scope', label: 'Scope', render: (r) => r.platformWide ? 'Platform-wide' : String((r.organization as { name?: string })?.name || 'Hospital') },
          { key: 'discountType', label: 'Type' },
          { key: 'discountValue', label: 'Value', render: (r) => r.discountType === 'PERCENT' ? `${r.discountValue}%` : formatCurrency(r.discountValue as number) },
          { key: 'minAmount', label: 'Min Amount', render: (r) => r.minAmount ? formatCurrency(r.minAmount as number) : '-' },
          { key: 'usedCount', label: 'Used', render: (r) => `${r.usedCount}${r.usageLimit ? ` / ${r.usageLimit}` : ''}` },
          { key: 'expiresAt', label: 'Expires', render: (r) => r.expiresAt ? formatDate(r.expiresAt as string) : 'Never' },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'CANCELLED'} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex flex-wrap gap-2">
              <ActionBtn onClick={() => openEdit(r)}>Edit</ActionBtn>
              {r.isActive
                ? <ActionBtn variant="danger" onClick={() => api.patch(`/admin/coupons/${r.id}/deactivate`).then(refetch)}>Deactivate</ActionBtn>
                : <ActionBtn variant="success" onClick={() => api.patch(`/admin/coupons/${r.id}/activate`).then(refetch)}>Activate</ActionBtn>}
              <ActionBtn variant="danger" onClick={() => { if (confirm('Delete this coupon?')) api.delete(`/admin/coupons/${r.id}`).then(refetch); }}>Delete</ActionBtn>
            </div>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold mb-4">{editing.id ? 'Edit Coupon' : 'Create Coupon'}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Coupon Code</label>
                <input className="input w-full uppercase" placeholder="SAVE20" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Discount Type</label>
                <select className="input w-full" value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as 'PERCENT' | 'FIXED' })}>
                  <option value="PERCENT">Percent (%)</option>
                  <option value="FIXED">Fixed Amount</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Discount Value</label>
                <input type="number" className="input w-full" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Min Order Amount</label>
                <input type="number" className="input w-full" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Max Discount</label>
                <input type="number" className="input w-full" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Usage Limit</label>
                <input type="number" className="input w-full" placeholder="Unlimited" value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Expiry Date</label>
                <input type="date" className="input w-full" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.platformWide} onChange={(e) => setForm({ ...form, platformWide: e.target.checked, organizationId: '' })} />
                  Platform-wide coupon
                </label>
              </div>
              {!form.platformWide && (
                <div className="col-span-2">
                  <label className="text-xs text-gray-500">Hospital / Organization</label>
                  <select className="input w-full" value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}>
                    <option value="">Select organization</option>
                    {orgList.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.type})</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-secondary text-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary text-sm" disabled={!form.code || form.discountValue <= 0 || (!form.platformWide && !form.organizationId)} onClick={save}>
                {editing.id ? 'Update Coupon' : 'Create Coupon'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export function AdminLeadsPage() {
  const { data, isLoading, refetch } = useList('/admin/leads');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Lead Management" subtitle="Track and assign platform leads" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Name' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'source', label: 'Source' },
          { key: 'org', label: 'Hospital', render: (r) => String((r.organization as { name?: string })?.name) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <select className="text-xs border rounded px-1" value={r.status as string} onChange={(e) => api.patch(`/admin/leads/${r.id}`, { status: e.target.value }).then(() => refetch())}>
              {['NEW', 'CONTACTED', 'INTERESTED', 'APPOINTMENT_BOOKED', 'CONVERTED', 'LOST'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminReviewsPage() {
  const { data, isLoading, refetch } = useList('/admin/reviews');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Review Management" subtitle="Moderate hospital and doctor reviews" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'patient', label: 'Patient', render: (r) => String((r.patient as { fullName?: string })?.fullName) },
          { key: 'org', label: 'Hospital', render: (r) => String((r.organization as { name?: string })?.name || '-') },
          { key: 'doctor', label: 'Doctor', render: (r) => String((r.doctor as { fullName?: string })?.fullName || '-') },
          { key: 'rating', label: 'Rating', render: (r) => '⭐'.repeat(r.rating as number) },
          { key: 'comment', label: 'Comment', render: (r) => <span className="max-w-xs truncate block">{String(r.comment || '-')}</span> },
          { key: 'published', label: 'Status', render: (r) => <StatusBadge status={r.isPublished ? 'ACTIVE' : 'SUSPENDED'} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <ActionBtn onClick={() => api.patch(`/admin/reviews/${r.id}`, { isPublished: !r.isPublished }).then(() => refetch())}>
              {r.isPublished ? 'Hide' : 'Publish'}
            </ActionBtn>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminAnalyticsPage() {
  const { data: stats } = useList('/admin/stats');
  const { data: growth } = useList('/admin/analytics/growth');
  const s = stats?.data as Record<string, number> | undefined;
  const growthData = (growth?.data || []) as { month: string; organizations: number; patients: number; appointments: number }[];

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Analytics & Reports" subtitle="Business intelligence and platform metrics" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'MRR', value: formatCurrency(s?.subscriptionRevenue || 0) },
          { label: 'Total Revenue', value: formatCurrency(s?.totalRevenue || 0) },
          { label: 'Active Subscriptions', value: s?.activeSubscriptions || 0 },
          { label: 'Churn (Expired)', value: s?.expiredSubscriptions || 0 },
          { label: 'New Registrations', value: s?.newRegistrations || 0 },
          { label: 'Ad Revenue', value: formatCurrency(s?.advertisementRevenue || 0) },
        ].map((item) => (
          <div key={item.label} className="card p-6 text-center">
            <p className="text-sm text-gray-500">{item.label}</p>
            <p className="text-2xl font-bold mt-1">{item.value}</p>
          </div>
        ))}
      </div>
      <div className="card p-6">
        <h2 className="font-semibold mb-4">Growth Trends</h2>
        <AdminTable columns={[
          { key: 'month', label: 'Month' },
          { key: 'organizations', label: 'Organizations' },
          { key: 'patients', label: 'Patients' },
          { key: 'appointments', label: 'Appointments' },
        ]} rows={growthData as unknown as Record<string, unknown>[]} />
      </div>
    </DashboardLayout>
  );
}
