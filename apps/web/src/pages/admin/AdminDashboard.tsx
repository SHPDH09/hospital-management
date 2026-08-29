import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Building2, Users, Stethoscope, Calendar, CreditCard, DollarSign,
  AlertCircle, TrendingUp, UserPlus, Headphones, Sparkles, ShieldCheck, BarChart3,
  ArrowRight, Store, Receipt, Megaphone, Target, Bell, Activity, Zap,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { AdminTable, StatusBadge, LoadingState, ActionBtn, RowActions, ApiErrorState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { adminGet } from '@/lib/admin-api';
import { useAuth } from '@/contexts/AuthContext';
import { cn, formatCurrency } from '@/lib/utils';

interface Stats {
  totalHospitals: number; totalClinics: number; totalDoctors: number;
  totalPatients: number; totalStaff: number; todayAppointments: number;
  monthlyAppointments: number; totalRevenue: number; subscriptionRevenue: number;
  advertisementRevenue: number; pendingPayments: number; activeSubscriptions: number;
  expiredSubscriptions: number; newRegistrations: number; pendingApprovals: number;
  complaints: number;
}

function KpiCard({ label, value, sub, icon, gradient }: {
  label: string; value: string | number; sub?: string;
  icon: ReactNode; gradient: string;
}) {
  return (
    <div className="admin-card-elevated relative overflow-hidden p-5">
      <div className={cn('absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-20 blur-2xl', gradient)} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-lg', gradient)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: ReactNode; icon: ReactNode; accent: string }) {
  return (
    <div className="admin-card-elevated p-4">
      <div className={cn('grid h-10 w-10 place-items-center rounded-xl', accent)}>{icon}</div>
      <p className="mt-3 text-xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminGet<Stats>('/admin/stats'),
  });
  const { data: growth } = useQuery({
    queryKey: ['admin-growth'],
    queryFn: () => adminGet('/admin/analytics/growth'),
  });
  const { data: orgs } = useQuery({
    queryKey: ['admin-orgs-pending'],
    queryFn: () => adminGet('/admin/organizations?status=PENDING&limit=10'),
  });

  const s = data?.data;
  const growthData = (growth?.data || []) as { month: string; organizations: number; patients: number; appointments: number }[];
  const maxGrowth = Math.max(...growthData.flatMap((g) => [g.organizations, g.patients, g.appointments]), 1);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const adminName = user?.email?.split('@')[0]?.replace(/[._]/g, ' ') || 'Admin';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const quickActions = [
    { to: '/admin/hospitals', label: 'Hospitals', icon: Building2, desc: 'Manage providers' },
    { to: '/admin/payments', label: 'Payments', icon: Receipt, desc: 'Payment console' },
    { to: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard, desc: 'Plans & billing' },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, desc: 'Platform reports' },
    { to: '/admin/leads', label: 'Leads', icon: Target, desc: 'Lead pipeline' },
    { to: '/admin/support', label: 'Support', icon: Headphones, desc: 'Complaints & tickets' },
    { to: '/admin/advertisements', label: 'Ads', icon: Megaphone, desc: 'Ad campaigns' },
    { to: '/admin/settings', label: 'Settings', icon: ShieldCheck, desc: 'Global config' },
  ];

  const networkStats = s ? [
    { label: 'Hospitals', value: s.totalHospitals, icon: <Building2 className="h-4 w-4" />, accent: 'bg-indigo-50 text-indigo-600' },
    { label: 'Clinics', value: s.totalClinics, icon: <Store className="h-4 w-4" />, accent: 'bg-violet-50 text-violet-600' },
    { label: 'Doctors', value: s.totalDoctors, icon: <Stethoscope className="h-4 w-4" />, accent: 'bg-purple-50 text-purple-600' },
    { label: 'Patients', value: s.totalPatients, icon: <Users className="h-4 w-4" />, accent: 'bg-blue-50 text-blue-600' },
    { label: 'Staff', value: s.totalStaff, icon: <Users className="h-4 w-4" />, accent: 'bg-sky-50 text-sky-600' },
    { label: 'New Registrations', value: s.newRegistrations, icon: <UserPlus className="h-4 w-4" />, accent: 'bg-emerald-50 text-emerald-600' },
  ] : [];

  const revenueStats = s ? [
    { label: 'Total Revenue', value: formatCurrency(s.totalRevenue), icon: <DollarSign className="h-4 w-4" />, accent: 'bg-emerald-50 text-emerald-600' },
    { label: 'Subscription Revenue', value: formatCurrency(s.subscriptionRevenue), icon: <CreditCard className="h-4 w-4" />, accent: 'bg-teal-50 text-teal-600' },
    { label: 'Ad Revenue', value: formatCurrency(s.advertisementRevenue), icon: <TrendingUp className="h-4 w-4" />, accent: 'bg-pink-50 text-pink-600' },
    { label: 'Pending Payments', value: s.pendingPayments, icon: <AlertCircle className="h-4 w-4" />, accent: 'bg-amber-50 text-amber-600' },
    { label: 'Active Subscriptions', value: s.activeSubscriptions, icon: <CreditCard className="h-4 w-4" />, accent: 'bg-green-50 text-green-600' },
    { label: 'Expired Subscriptions', value: s.expiredSubscriptions, icon: <CreditCard className="h-4 w-4" />, accent: 'bg-red-50 text-red-600' },
  ] : [];

  const opsStats = s ? [
    { label: "Today's Appointments", value: s.todayAppointments, icon: <Calendar className="h-4 w-4" />, accent: 'bg-orange-50 text-orange-600' },
    { label: 'Monthly Appointments', value: s.monthlyAppointments, icon: <Activity className="h-4 w-4" />, accent: 'bg-amber-50 text-amber-600' },
    { label: 'Pending Approvals', value: s.pendingApprovals, icon: <AlertCircle className="h-4 w-4" />, accent: 'bg-orange-50 text-orange-600' },
    { label: 'Open Complaints', value: s.complaints, icon: <Headphones className="h-4 w-4" />, accent: 'bg-rose-50 text-rose-600' },
  ] : [];

  return (
    <DashboardLayout portal="admin">
      {/* Premium branded hero */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-violet-900 p-6 text-white shadow-xl shadow-indigo-900/20 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-60" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-indigo-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" />
              Super Admin · Platform Control Center
            </div>
            <p className="text-sm font-medium text-indigo-200">{greeting},</p>
            <h1 className="mt-1 text-3xl font-bold capitalize tracking-tight sm:text-4xl">{adminName}</h1>
            <p className="mt-2 text-sm leading-relaxed text-indigo-100/90">
              Monitor network growth, revenue, subscriptions and operations across the entire healthcare platform.
            </p>
            {s && s.pendingApprovals > 0 && (
              <Link to="/admin/hospitals" className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400/20 px-3 py-1.5 text-xs font-semibold text-amber-100 ring-1 ring-amber-300/30 transition hover:bg-amber-400/30">
                <Bell className="h-3.5 w-3.5" />
                {s.pendingApprovals} pending approval{s.pendingApprovals !== 1 ? 's' : ''} need attention
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-right backdrop-blur-md">
              <p className="flex items-center justify-end gap-1.5 text-xs font-medium text-indigo-200">
                <Sparkles className="h-3.5 w-3.5" /> {dateStr}
              </p>
              <p className="mt-1 flex items-center justify-end gap-1.5 text-sm font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                Platform Online
              </p>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? <LoadingState /> : isError ? (
        <ApiErrorState message={error instanceof Error ? error.message : 'Failed to load dashboard data'} onRetry={() => refetch()} />
      ) : s && (
        <>
          {/* Top KPI row */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total Revenue" value={formatCurrency(s.totalRevenue)} sub="All-time platform revenue"
              icon={<DollarSign className="h-6 w-6" />} gradient="bg-gradient-to-br from-emerald-500 to-teal-600" />
            <KpiCard label="Network Size" value={s.totalHospitals + s.totalClinics} sub={`${s.totalDoctors} doctors · ${s.totalPatients} patients`}
              icon={<Building2 className="h-6 w-6" />} gradient="bg-gradient-to-br from-indigo-500 to-violet-600" />
            <KpiCard label="Active Subscriptions" value={s.activeSubscriptions} sub={`${s.expiredSubscriptions} expired`}
              icon={<CreditCard className="h-6 w-6" />} gradient="bg-gradient-to-br from-blue-500 to-indigo-600" />
            <KpiCard label="Today's Activity" value={s.todayAppointments} sub={`${s.monthlyAppointments} this month`}
              icon={<Calendar className="h-6 w-6" />} gradient="bg-gradient-to-br from-violet-500 to-purple-600" />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Growth chart */}
            <div className="admin-card p-6 xl:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="flex items-center gap-2.5 font-semibold text-slate-900">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><BarChart3 className="h-4 w-4" /></span>
                  Platform Growth
                  <span className="text-xs font-normal text-slate-400">Last 6 months</span>
                </h2>
                <Link to="/admin/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                  Full analytics <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {growthData.length > 0 ? (
                <div className="space-y-4">
                  {growthData.map((g) => (
                    <div key={g.month}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{g.month}</span>
                        <span className="text-slate-400">{g.organizations} orgs · {g.patients} patients · {g.appointments} appts</span>
                      </div>
                      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="rounded-l-full bg-indigo-500 transition-all" style={{ width: `${(g.organizations / maxGrowth) * 100}%` }} title="Organizations" />
                        <div className="bg-violet-400 transition-all" style={{ width: `${(g.patients / maxGrowth) * 100}%` }} title="Patients" />
                        <div className="rounded-r-full bg-purple-300 transition-all" style={{ width: `${(g.appointments / maxGrowth) * 100}%` }} title="Appointments" />
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-4 pt-2 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" /> Organizations</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-400" /> Patients</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-purple-300" /> Appointments</span>
                  </div>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">No growth data yet</p>
              )}
            </div>

            {/* Quick actions */}
            <div className="admin-card p-6">
              <h2 className="mb-4 flex items-center gap-2.5 font-semibold text-slate-900">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-600"><Zap className="h-4 w-4" /></span>
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {quickActions.map((action) => (
                  <Link key={action.label} to={action.to}
                    className="group flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50/50 hover:shadow-md hover:shadow-indigo-100/50">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100 transition group-hover:text-indigo-700">
                      <action.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{action.label}</p>
                      <p className="text-[10px] text-slate-500">{action.desc}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Stat sections */}
          <div className="mt-8 space-y-6">
            {[
              { title: 'Network', stats: networkStats },
              { title: 'Revenue & Subscriptions', stats: revenueStats },
              { title: 'Operations', stats: opsStats },
            ].map((section) => (
              <div key={section.title}>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">{section.title}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {section.stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
                </div>
              </div>
            ))}
          </div>

          {/* Pending approvals */}
          <div className="admin-card mt-8 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2.5 font-semibold text-slate-900">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600"><AlertCircle className="h-4 w-4" /></span>
                Pending Approvals
                {(orgs?.data as unknown[])?.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                    {(orgs?.data as unknown[]).length}
                  </span>
                )}
              </h2>
              <Link to="/admin/hospitals" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all →</Link>
            </div>
            <AdminTable
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'type', label: 'Type' },
                { key: 'city', label: 'City' },
                { key: 'verificationStatus', label: 'Status', render: (r) => <StatusBadge status={r.verificationStatus as string} /> },
                { key: 'actions', label: 'Actions', nowrap: false, render: (r) => (
                  <RowActions>
                    <ActionBtn variant="success" onClick={() => api.patch(`/admin/organizations/${r.id}/status`, { verificationStatus: 'APPROVED', isPubliclyListed: true }).then(() => window.location.reload())}>Approve</ActionBtn>
                    <ActionBtn variant="danger" onClick={() => api.patch(`/admin/organizations/${r.id}/status`, { verificationStatus: 'REJECTED' }).then(() => window.location.reload())}>Reject</ActionBtn>
                    <ActionBtn onClick={() => handleImpersonate(r.id as string)}>Login as Admin</ActionBtn>
                  </RowActions>
                )},
              ]}
              rows={(orgs?.data as Record<string, unknown>[]) || []}
              emptyMessage="No pending approvals — all caught up!"
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
