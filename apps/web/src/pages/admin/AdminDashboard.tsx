import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, Stethoscope, Calendar, CreditCard, DollarSign,
  AlertCircle, TrendingUp, UserPlus, Headphones, Sparkles, ShieldCheck, BarChart3,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { StatGrid, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
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
  const { user } = useAuth();
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const adminName = user?.email?.split('@')[0] || 'Admin';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <DashboardLayout portal="admin">
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-28 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-white/60"><ShieldCheck className="h-4 w-4" /> {greeting},</p>
            <h1 className="mt-1 text-2xl font-bold capitalize tracking-tight sm:text-3xl">{adminName}</h1>
            <p className="mt-1.5 max-w-md text-sm text-white/70">Complete platform overview — organizations, revenue, subscriptions and operations at a glance.</p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="flex items-center justify-end gap-1 text-xs text-white/60"><Sparkles className="h-3.5 w-3.5" /> Today</p>
            <p className="mt-0.5 text-lg font-semibold">{dateStr}</p>
          </div>
        </div>
      </div>
      {isLoading ? <LoadingState /> : (
        <>
          <StatGrid stats={stats} />

          {growthData.length > 0 && (
            <div className="card p-6 mb-8">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-50 text-primary-600"><BarChart3 className="h-4 w-4" /></span>
                Platform Growth (6 months)
              </h2>
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
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-50 text-amber-600"><AlertCircle className="h-4 w-4" /></span>
              Pending Approvals
            </h2>
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
