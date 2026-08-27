import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, Calendar, Stethoscope, DollarSign, TrendingUp, UserPlus, Clock,
  CheckCircle, XCircle, Building2, Star, Target, AlertCircle, Bell, CreditCard,
  Plus, MessageSquare, ArrowRight, Sparkles, ShieldCheck,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { LoadingState } from '@/components/admin/AdminComponents';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { cn, formatCurrency, getStatusColor } from '@/lib/utils';

interface CrmStats {
  totalPatients: number;
  todayAppointments: number;
  upcomingAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  activeDoctors: number;
  staffCount: number;
  departmentCount: number;
  newPatientsThisMonth: number;
  monthlyRevenue: number;
  todayRevenue: number;
  pendingPayments: number;
  newLeads: number;
  adLeads: number;
  pendingComplaints: number;
  reviewCount: number;
  averageRating: number;
  unreadNotifications: number;
}

function StatCard({ label, value, icon, accent }: { label: string; value: ReactNode; icon: ReactNode; accent: string }) {
  return (
    <div className="group card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn('grid h-11 w-11 place-items-center rounded-xl', accent)}>{icon}</div>
      <p className="mt-4 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

export function CrmDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: () => api.get('/dashboard/crm'),
  });

  const dashboard = data?.data as {
    stats: CrmStats;
    subscription?: {
      status: string; planName: string; isRestricted: boolean; suspendReason?: string;
      daysRemaining?: number | null; isTrial?: boolean; bannerMessage?: string | null;
    };
    recentAppointments: { id: string; startTime: string; status: string; patient: { fullName: string }; doctor: { fullName: string } }[];
  } | undefined;

  const stats = dashboard?.stats;
  const subscription = dashboard?.subscription;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = user?.staff?.fullName || user?.doctor?.fullName || user?.email?.split('@')[0] || 'there';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const quickActions = [
    { to: '/crm/patients?action=add', label: 'Add Patient', icon: UserPlus },
    { to: '/crm/doctors?action=add', label: 'Add Doctor', icon: Stethoscope },
    { to: '/crm/appointments?action=create', label: 'Create Appointment', icon: Calendar },
    { to: '/crm/staff?action=add', label: 'Add Staff', icon: Users },
    { to: '/crm/services?action=add', label: 'Add Service', icon: Plus },
    { to: '/crm/health-packages?action=add', label: 'Create Package', icon: Plus },
    { to: '/crm/leads', label: 'View Leads', icon: Target },
    { to: '/crm/communications', label: 'Send Message', icon: MessageSquare },
  ];

  const statCards = stats ? [
    { label: 'Total Patients', value: stats.totalPatients, icon: <Users className="h-5 w-5" />, accent: 'bg-blue-50 text-blue-600' },
    { label: "Today's Appointments", value: stats.todayAppointments, icon: <Calendar className="h-5 w-5" />, accent: 'bg-green-50 text-green-600' },
    { label: 'Upcoming', value: stats.upcomingAppointments, icon: <Clock className="h-5 w-5" />, accent: 'bg-orange-50 text-orange-600' },
    { label: 'Completed', value: stats.completedAppointments, icon: <CheckCircle className="h-5 w-5" />, accent: 'bg-emerald-50 text-emerald-600' },
    { label: 'Cancelled', value: stats.cancelledAppointments, icon: <XCircle className="h-5 w-5" />, accent: 'bg-red-50 text-red-600' },
    { label: 'Total Doctors', value: stats.activeDoctors, icon: <Stethoscope className="h-5 w-5" />, accent: 'bg-purple-50 text-purple-600' },
    { label: 'Active Staff', value: stats.staffCount, icon: <Users className="h-5 w-5" />, accent: 'bg-indigo-50 text-indigo-600' },
    { label: 'Departments', value: stats.departmentCount, icon: <Building2 className="h-5 w-5" />, accent: 'bg-cyan-50 text-cyan-600' },
    { label: "Today's Revenue", value: formatCurrency(stats.todayRevenue), icon: <DollarSign className="h-5 w-5" />, accent: 'bg-emerald-50 text-emerald-600' },
    { label: 'Monthly Revenue', value: formatCurrency(stats.monthlyRevenue), icon: <TrendingUp className="h-5 w-5" />, accent: 'bg-green-50 text-green-600' },
    { label: 'Pending Payments', value: formatCurrency(stats.pendingPayments), icon: <CreditCard className="h-5 w-5" />, accent: 'bg-amber-50 text-amber-600' },
    { label: 'New Leads', value: stats.newLeads, icon: <Target className="h-5 w-5" />, accent: 'bg-pink-50 text-pink-600' },
    { label: 'Ad Leads', value: stats.adLeads, icon: <Target className="h-5 w-5" />, accent: 'bg-rose-50 text-rose-600' },
    { label: 'Pending Complaints', value: stats.pendingComplaints, icon: <AlertCircle className="h-5 w-5" />, accent: 'bg-red-50 text-red-600' },
    { label: 'Reviews', value: `${stats.reviewCount} (${stats.averageRating.toFixed(1)}★)`, icon: <Star className="h-5 w-5" />, accent: 'bg-yellow-50 text-yellow-600' },
    { label: 'Notifications', value: stats.unreadNotifications, icon: <Bell className="h-5 w-5" />, accent: 'bg-slate-100 text-slate-600' },
  ] : [];

  return (
    <DashboardLayout portal="crm">
      {/* Premium welcome header */}
      <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 via-primary-600 to-primary-800 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/70">{greeting},</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{displayName}</h1>
            <p className="mt-1.5 max-w-md text-sm text-white/80">Here's the latest overview of your organization's activity and performance.</p>
            {subscription && (
              <span className={cn(
                'mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur',
                subscription.isRestricted ? 'bg-red-500/20 text-red-50' : 'bg-white/15 text-white',
              )}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {subscription.planName} · {subscription.status}
              </span>
            )}
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-3 text-right backdrop-blur">
            <p className="flex items-center justify-end gap-1 text-xs text-white/70"><Sparkles className="h-3.5 w-3.5" /> Today</p>
            <p className="mt-0.5 text-lg font-semibold">{dateStr}</p>
          </div>
        </div>
      </div>

      {subscription?.isRestricted && subscription.suspendReason && subscription.status === 'SUSPENDED' && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-semibold">Account Suspended</p>
          <p className="mt-1 text-sm">Reason: {subscription.suspendReason}. Contact support for help.</p>
        </div>
      )}

      {isLoading ? <LoadingState /> : stats && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Overview</h2>
          </div>
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {statCards.map((s) => <StatCard key={s.label} {...s} />)}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-50 text-primary-600"><Calendar className="h-4 w-4" /></span>
                  Today's Appointments
                </h2>
                <Link to="/crm/appointments" className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {dashboard?.recentAppointments?.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
                  No appointments scheduled for today
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="pb-3 font-medium">Time</th>
                        <th className="pb-3 font-medium">Patient</th>
                        <th className="pb-3 font-medium">Doctor</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard?.recentAppointments?.map((apt) => (
                        <tr key={apt.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50">
                          <td className="py-3 font-medium text-gray-900">{apt.startTime}</td>
                          <td className="py-3 text-gray-700">{apt.patient.fullName}</td>
                          <td className="py-3 text-gray-700">{apt.doctor.fullName}</td>
                          <td className="py-3">
                            <span className={`badge ${getStatusColor(apt.status)}`}>{apt.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card p-6">
              <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-50 text-primary-600"><Sparkles className="h-4 w-4" /></span>
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                {quickActions.map((action) => (
                  <Link key={action.label} to={action.to}
                    className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-3 transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:bg-primary-50 hover:shadow-sm">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-white text-primary-600 shadow-sm">
                      <action.icon className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-medium text-gray-700">{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
