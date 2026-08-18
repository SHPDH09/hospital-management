import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

function useList(endpoint: string) {
  return useQuery({ queryKey: [endpoint], queryFn: () => api.get(endpoint) });
}

export function AdminAdvertisementsPage() {
  const { data, isLoading, refetch } = useList('/admin/advertisements');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Advertisement Management" subtitle="Approve, manage, and track ad campaigns" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'title', label: 'Title' },
          { key: 'type', label: 'Type' },
          { key: 'org', label: 'Organization', render: (r) => String((r.organization as { name?: string })?.name || 'Platform') },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'impressions', label: 'Impressions' },
          { key: 'clicks', label: 'Clicks' },
          { key: 'budget', label: 'Budget', render: (r) => r.budget ? formatCurrency(r.budget as number) : '-' },
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex gap-2">
              {r.status === 'PENDING' && <ActionBtn variant="success" onClick={() => api.patch(`/admin/advertisements/${r.id}/status`, { status: 'APPROVED' }).then(() => refetch())}>Approve</ActionBtn>}
              {r.status === 'PENDING' && <ActionBtn variant="danger" onClick={() => api.patch(`/admin/advertisements/${r.id}/status`, { status: 'REJECTED' }).then(() => refetch())}>Reject</ActionBtn>}
              {r.status === 'APPROVED' && <ActionBtn onClick={() => api.patch(`/admin/advertisements/${r.id}/status`, { status: 'ACTIVE' }).then(() => refetch())}>Activate</ActionBtn>}
            </div>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminCouponsPage() {
  const { data, isLoading } = useList('/admin/coupons');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Coupon Management" subtitle="Platform-wide and hospital-specific coupons" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'code', label: 'Code' },
          { key: 'discountType', label: 'Type' },
          { key: 'discountValue', label: 'Value', render: (r) => r.discountType === 'PERCENT' ? `${r.discountValue}%` : formatCurrency(r.discountValue as number) },
          { key: 'usedCount', label: 'Used' },
          { key: 'usageLimit', label: 'Limit', render: (r) => String(r.usageLimit || '∞') },
          { key: 'expiresAt', label: 'Expires', render: (r) => r.expiresAt ? formatDate(r.expiresAt as string) : 'Never' },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'CANCELLED'} /> },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
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
