import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, Stethoscope, Calendar, CreditCard, DollarSign,
  AlertCircle, TrendingUp, UserPlus, Headphones,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface Stats {
  totalHospitals: number; totalClinics: number; totalDoctors: number;
  totalPatients: number; totalStaff: number; todayAppointments: number;
  monthlyAppointments: number; totalRevenue: number; subscriptionRevenue: number;
  advertisementRevenue: number; pendingPayments: number; activeSubscriptions: number;
  expiredSubscriptions: number; newRegistrations: number; pendingApprovals: number;
  complaints: number;
}

export function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: () => api.get<Stats>('/admin/stats') });
  const { data: growth } = useQuery({ queryKey: ['admin-growth'], queryFn: () => api.get('/admin/analytics/growth') });
  const { data: orgs } = useQuery({ queryKey: ['admin-orgs-pending'], queryFn: () => api.get('/admin/organizations?status=PENDING&limit=10') });

  const s = data?.data;
  const stats = s ? [
    { label: 'Hospitals', value: s.totalHospitals, icon: <Building2 className="h-5 w-5" />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Clinics', value: s.totalClinics, icon: <Building2 className="h-5 w-5" />, color: 'bg-cyan-50 text-cyan-600' },
    { label: 'Doctors', value: s.totalDoctors, icon: <Stethoscope className="h-5 w-5" />, color: 'bg-purple-50 text-purple-600' },
    { label: 'Patients', value: s.totalPatients, icon: <Users className="h-5 w-5" />, color: 'bg-green-50 text-green-600' },
    { label: 'Staff', value: s.totalStaff, icon: <Users className="h-5 w-5" />, color: 'bg-indigo-50 text-indigo-600' },
    { label: "Today's Appointments", value: s.todayAppointments, icon: <Calendar className="h-5 w-5" />, color: 'bg-orange-50 text-orange-600' },
    { label: 'Monthly Appointments', value: s.monthlyAppointments, icon: <Calendar className="h-5 w-5" />, color: 'bg-amber-50 text-amber-600' },
    { label: 'Total Revenue', value: formatCurrency(s.totalRevenue), icon: <DollarSign className="h-5 w-5" />, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Subscription Revenue', value: formatCurrency(s.subscriptionRevenue), icon: <CreditCard className="h-5 w-5" />, color: 'bg-teal-50 text-teal-600' },
    { label: 'Ad Revenue', value: formatCurrency(s.advertisementRevenue), icon: <TrendingUp className="h-5 w-5" />, color: 'bg-pink-50 text-pink-600' },
    { label: 'Pending Payments', value: s.pendingPayments, icon: <AlertCircle className="h-5 w-5" />, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Active Subscriptions', value: s.activeSubscriptions, icon: <CreditCard className="h-5 w-5" />, color: 'bg-green-50 text-green-600' },
    { label: 'Expired Subscriptions', value: s.expiredSubscriptions, icon: <CreditCard className="h-5 w-5" />, color: 'bg-red-50 text-red-600' },
    { label: 'New Registrations', value: s.newRegistrations, icon: <UserPlus className="h-5 w-5" />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending Approvals', value: s.pendingApprovals, icon: <AlertCircle className="h-5 w-5" />, color: 'bg-orange-50 text-orange-600' },
    { label: 'Open Complaints', value: s.complaints, icon: <Headphones className="h-5 w-5" />, color: 'bg-red-50 text-red-600' },
  ] : [];

  const growthData = (growth?.data || []) as { month: string; organizations: number; patients: number; appointments: number }[];

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Super Admin Dashboard" subtitle="Complete platform overview" />
      {isLoading ? <LoadingState /> : (
        <>
          <StatGrid stats={stats} />

          {growthData.length > 0 && (
            <div className="card p-6 mb-8">
              <h2 className="font-semibold mb-4">Platform Growth (6 months)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b">
                      <th className="pb-2">Month</th>
                      <th className="pb-2">Organizations</th>
                      <th className="pb-2">Patients</th>
                      <th className="pb-2">Appointments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {growthData.map((g) => (
                      <tr key={g.month} className="border-b border-gray-50">
                        <td className="py-2 font-medium">{g.month}</td>
                        <td className="py-2">{g.organizations}</td>
                        <td className="py-2">{g.patients}</td>
                        <td className="py-2">{g.appointments}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card p-6">
            <h2 className="font-semibold mb-4">Pending Approvals</h2>
            <AdminTable
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'Type' },
                { key: 'city', label: 'City' },
                { key: 'verificationStatus', label: 'Status', render: (r) => <StatusBadge status={r.verificationStatus as string} /> },
                { key: 'actions', label: 'Actions', render: (r) => (
                  <div className="flex gap-2">
                    <ActionBtn variant="success" onClick={() => api.patch(`/admin/organizations/${r.id}/status`, { verificationStatus: 'APPROVED', isPubliclyListed: true }).then(() => window.location.reload())}>Approve</ActionBtn>
                    <ActionBtn variant="danger" onClick={() => api.patch(`/admin/organizations/${r.id}/status`, { verificationStatus: 'REJECTED' }).then(() => window.location.reload())}>Reject</ActionBtn>
                    <ActionBtn onClick={() => handleImpersonate(r.id as string)}>Login as Admin</ActionBtn>
                  </div>
                )},
              ]}
              rows={(orgs?.data as Record<string, unknown>[]) || []}
              emptyMessage="No pending approvals"
            />
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

async function handleImpersonate(orgId: string) {
  const res = await api.post<{ accessToken: string; refreshToken: string; redirectTo: string }>(`/admin/organizations/${orgId}/impersonate`);
  if (res.success && res.data) {
    api.setTokens(res.data.accessToken, res.data.refreshToken);
    window.location.href = res.data.redirectTo;
  }
}

export { handleImpersonate };
