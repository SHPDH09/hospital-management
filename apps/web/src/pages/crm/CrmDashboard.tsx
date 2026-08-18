import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, Calendar, Stethoscope, DollarSign, TrendingUp, UserPlus, Clock,
  CheckCircle, XCircle, Building2, Star, Target, AlertCircle, Bell, CreditCard,
  Plus, MessageSquare,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, LoadingState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency, getStatusColor } from '@/lib/utils';

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

export function CrmDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: () => api.get('/dashboard/crm'),
  });

  const dashboard = data?.data as {
    stats: CrmStats;
    subscription?: { status: string; planName: string; isRestricted: boolean; suspendReason?: string };
    recentAppointments: { id: string; startTime: string; status: string; patient: { fullName: string }; doctor: { fullName: string } }[];
  } | undefined;

  const stats = dashboard?.stats;
  const subscription = dashboard?.subscription;

  const quickActions = [
    { to: '/crm/patients?action=add', label: 'Add Patient', icon: UserPlus },
    { to: '/crm/doctors?action=add', label: 'Add Doctor', icon: Stethoscope },
    { to: '/crm/appointments?action=create', label: 'Create Appointment', icon: Calendar },
    { to: '/crm/staff?action=add', label: 'Add Staff', icon: Users },
    { to: '/crm/services?action=add', label: 'Add Service', icon: Plus },
    { to: '/crm/health-packages?action=add', label: 'Create Package', icon: Plus },
    { to: '/crm/leads', label: 'View Leads', icon: Target },
    { to: '/crm/communications', label: 'Send Communication', icon: MessageSquare },
  ];

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Hospital CRM Dashboard" subtitle="Organization-level overview and quick actions" />

      {subscription?.isRestricted && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
          <p className="font-semibold">Subscription {subscription.status} — {subscription.planName}</p>
          <p className="text-sm mt-1">
            {subscription.status === 'SUSPENDED'
              ? `Suspended${subscription.suspendReason ? `: ${subscription.suspendReason}` : ''}. Contact support.`
              : 'Subscription inactive. Please renew to continue.'}
          </p>
        </div>
      )}

      {subscription && !subscription.isRestricted && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-green-800">Subscription: {subscription.planName}</p>
            <p className="text-sm text-green-700">Status: {subscription.status}</p>
          </div>
          <Link to="/crm/subscription" className="text-sm text-green-700 hover:underline">View Details →</Link>
        </div>
      )}

      {isLoading ? <LoadingState /> : stats && (
        <>
          <StatGrid stats={[
            { label: 'Total Patients', value: stats.totalPatients, icon: <Users className="h-5 w-5" />, color: 'bg-blue-50 text-blue-600' },
            { label: "Today's Appointments", value: stats.todayAppointments, icon: <Calendar className="h-5 w-5" />, color: 'bg-green-50 text-green-600' },
            { label: 'Upcoming', value: stats.upcomingAppointments, icon: <Clock className="h-5 w-5" />, color: 'bg-orange-50 text-orange-600' },
            { label: 'Completed', value: stats.completedAppointments, icon: <CheckCircle className="h-5 w-5" />, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Cancelled', value: stats.cancelledAppointments, icon: <XCircle className="h-5 w-5" />, color: 'bg-red-50 text-red-600' },
            { label: 'Total Doctors', value: stats.activeDoctors, icon: <Stethoscope className="h-5 w-5" />, color: 'bg-purple-50 text-purple-600' },
            { label: 'Active Staff', value: stats.staffCount, icon: <Users className="h-5 w-5" />, color: 'bg-indigo-50 text-indigo-600' },
            { label: 'Departments', value: stats.departmentCount, icon: <Building2 className="h-5 w-5" />, color: 'bg-cyan-50 text-cyan-600' },
            { label: "Today's Revenue", value: formatCurrency(stats.todayRevenue), icon: <DollarSign className="h-5 w-5" />, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Monthly Revenue', value: formatCurrency(stats.monthlyRevenue), icon: <TrendingUp className="h-5 w-5" />, color: 'bg-green-50 text-green-600' },
            { label: 'Pending Payments', value: formatCurrency(stats.pendingPayments), icon: <CreditCard className="h-5 w-5" />, color: 'bg-amber-50 text-amber-600' },
            { label: 'New Leads', value: stats.newLeads, icon: <Target className="h-5 w-5" />, color: 'bg-pink-50 text-pink-600' },
            { label: 'Ad Leads', value: stats.adLeads, icon: <Target className="h-5 w-5" />, color: 'bg-rose-50 text-rose-600' },
            { label: 'Pending Complaints', value: stats.pendingComplaints, icon: <AlertCircle className="h-5 w-5" />, color: 'bg-red-50 text-red-600' },
            { label: 'Reviews', value: `${stats.reviewCount} (${stats.averageRating.toFixed(1)}★)`, icon: <Star className="h-5 w-5" />, color: 'bg-yellow-50 text-yellow-600' },
            { label: 'Notifications', value: stats.unreadNotifications, icon: <Bell className="h-5 w-5" />, color: 'bg-gray-50 text-gray-600' },
          ]} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2 card p-6">
              <h2 className="font-semibold mb-4">Today's Appointments</h2>
              {dashboard?.recentAppointments?.length === 0 ? (
                <p className="text-sm text-gray-500">No appointments scheduled for today</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="pb-3 font-medium">Time</th>
                        <th className="pb-3 font-medium">Patient</th>
                        <th className="pb-3 font-medium">Doctor</th>
                        <th className="pb-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard?.recentAppointments?.map((apt) => (
                        <tr key={apt.id} className="border-b border-gray-100">
                          <td className="py-3">{apt.startTime}</td>
                          <td className="py-3">{apt.patient.fullName}</td>
                          <td className="py-3">{apt.doctor.fullName}</td>
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
              <h2 className="font-semibold mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {quickActions.map((action) => (
                  <Link key={action.label} to={action.to}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
                    <action.icon className="h-4 w-4 text-primary-600" />
                    {action.label}
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
