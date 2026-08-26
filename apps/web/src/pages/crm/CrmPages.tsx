import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, Calendar, Stethoscope, DollarSign, TrendingUp, Bot, Send, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { api } from '@/lib/api';
import { formatCurrency, getStatusColor } from '@/lib/utils';

export function CrmDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: () => api.get('/dashboard/crm'),
  });

  const dashboard = data?.data as CrmDashboardData | undefined;
  const stats = dashboard?.stats;
  const subscription = dashboard?.subscription;

  const statCards = stats
    ? [
        { label: 'Total Patients', value: stats.totalPatients, icon: Users, color: 'text-blue-600 bg-blue-50' },
        { label: "Today's Appointments", value: stats.todayAppointments, icon: Calendar, color: 'text-green-600 bg-green-50' },
        { label: 'Active Doctors', value: stats.activeDoctors, icon: Stethoscope, color: 'text-purple-600 bg-purple-50' },
        { label: 'Monthly Revenue', value: formatCurrency(stats.monthlyRevenue), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
        { label: 'Upcoming', value: stats.upcomingAppointments, icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
        { label: 'New Patients (Month)', value: stats.newPatientsThisMonth, icon: Users, color: 'text-indigo-600 bg-indigo-50' },
      ]
    : [];

  return (
    <DashboardLayout portal="crm">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Hospital Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your organization's performance</p>
      </div>

      {subscription?.isRestricted && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
          <p className="font-semibold">Subscription {subscription.status}</p>
          <p className="text-sm mt-1">
            {subscription.status === 'SUSPENDED'
              ? `Your subscription has been suspended${subscription.suspendReason ? `: ${subscription.suspendReason}` : ''}. Please contact support.`
              : 'Your subscription is inactive. Please contact support to renew.'}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {statCards.map((card) => (
              <div key={card.label} className="card p-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${card.color}`}>
                    <card.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-6">
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
        </>
      )}
    </DashboardLayout>
  );
}

export function CrmPatientsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['crm-patients'],
    queryFn: () => api.get('/patients'),
  });

  return (
    <DashboardLayout portal="crm">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Patients</h1>
      </div>
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Appointments</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data as Patient[] | undefined)?.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-6 py-4 font-medium">{p.fullName}</td>
                  <td className="px-6 py-4 text-gray-500">{p.user?.email}</td>
                  <td className="px-6 py-4 text-gray-500">{p.user?.phone || '-'}</td>
                  <td className="px-6 py-4">{p._count?.appointments || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

export function CrmDoctorsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['crm-doctors'],
    queryFn: () => api.get('/doctors'),
  });

  return (
    <DashboardLayout portal="crm">
      <h1 className="text-2xl font-bold mb-6">Doctors</h1>
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data?.data as Doctor[] | undefined)?.map((doc) => (
            <div key={doc.id} className="card p-6">
              <h3 className="font-semibold">{doc.fullName}</h3>
              <p className="text-sm text-primary-600">{doc.specialization}</p>
              <p className="text-xs text-gray-500 mt-1">{doc.qualification}</p>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-gray-500">{doc.experience} yrs</span>
                <span className="font-medium">₹{doc.consultationFee}</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">{doc._count?.appointments || 0} appointments</p>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export function CrmAppointmentsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['crm-appointments'],
    queryFn: () => api.get('/appointments'),
  });

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/appointments/${id}/status`, { status });
    refetch();
  };

  return (
    <DashboardLayout portal="crm">
      <h1 className="text-2xl font-bold mb-6">Appointments</h1>
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Patient</th>
                <th className="px-6 py-3 font-medium">Doctor</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data as CrmAppointment[] | undefined)?.map((apt) => (
                <tr key={apt.id} className="border-t border-gray-100">
                  <td className="px-6 py-4">{new Date(apt.appointmentDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4">{apt.startTime}</td>
                  <td className="px-6 py-4">{apt.patient.fullName}</td>
                  <td className="px-6 py-4">{apt.doctor.fullName}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${getStatusColor(apt.status)}`}>{apt.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    {apt.status === 'PENDING' && (
                      <button onClick={() => updateStatus(apt.id, 'CONFIRMED')} className="text-xs text-primary-600 hover:underline mr-2">
                        Confirm
                      </button>
                    )}
                    {apt.status === 'CONFIRMED' && (
                      <button onClick={() => updateStatus(apt.id, 'CHECKED_IN')} className="text-xs text-primary-600 hover:underline mr-2">
                        Check In
                      </button>
                    )}
                    {apt.status === 'CHECKED_IN' && (
                      <button onClick={() => updateStatus(apt.id, 'COMPLETED')} className="text-xs text-green-600 hover:underline">
                        Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

export function CrmBillingPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['crm-bills'],
    queryFn: () => api.get('/bills'),
  });

  return (
    <DashboardLayout portal="crm">
      <h1 className="text-2xl font-bold mb-6">Billing</h1>
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (data?.data as Bill[] | undefined)?.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">No bills yet</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Bill #</th>
                <th className="px-6 py-3 font-medium">Patient</th>
                <th className="px-6 py-3 font-medium">Total</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data as Bill[] | undefined)?.map((bill) => (
                <tr key={bill.id} className="border-t border-gray-100">
                  <td className="px-6 py-4 font-medium">{bill.billNumber}</td>
                  <td className="px-6 py-4">{bill.patient.fullName}</td>
                  <td className="px-6 py-4">{formatCurrency(bill.total)}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${getStatusColor(bill.status)}`}>{bill.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

export function CrmSettingsPage() {
  return (
    <DashboardLayout portal="crm">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="card p-6">
        <p className="text-gray-500">Organization settings, subscription management, and branding options will be available here.</p>
      </div>
    </DashboardLayout>
  );
}

export function CrmCopilotPage() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);

  const ask = useMutation({
    mutationFn: (q: string) => api.post<{ answer: string }>('/ai/copilot/org', { query: q }),
    onSuccess: (res, q) => {
      setMessages((m) => [...m, { role: 'user', text: q }, { role: 'assistant', text: res.data?.answer || 'No response.' }]);
      setQuery('');
    },
  });

  const suggestions = [
    "Show me today's appointments",
    'How many patients do we have?',
    'Show billing summary this week',
    'List active doctors',
    'Show hot leads',
  ];

  return (
    <DashboardLayout portal="crm">
      <h1 className="text-2xl font-bold mb-2 flex items-center gap-2"><Bot className="h-7 w-7" /> Hospital AI Copilot</h1>
      <p className="text-gray-500 mb-6">Ask about your organization's appointments, patients, billing, and leads.</p>

      <div className="card p-4 min-h-[360px] flex flex-col">
        <div className="flex-1 space-y-3 mb-4 overflow-y-auto max-h-96">
          {messages.length === 0 && <p className="text-sm text-gray-500">Try a suggestion below or ask your own question.</p>}
          {messages.map((m, i) => (
            <div key={i} className={`rounded-lg p-3 text-sm max-w-[85%] ${m.role === 'user' ? 'bg-primary-100 ml-auto' : 'bg-gray-100'}`}>{m.text}</div>
          ))}
          {ask.isPending && <div className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Thinking...</div>}
        </div>
        <div className="flex gap-2 flex-wrap mb-3">
          {suggestions.map((s) => (
            <button key={s} type="button" className="text-xs btn-ghost border" onClick={() => ask.mutate(s)}>{s}</button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (query.trim()) ask.mutate(query.trim()); }}>
          <input className="input flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask about your hospital..." />
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={ask.isPending}><Send className="h-4 w-4" /> Ask</button>
        </form>
      </div>
    </DashboardLayout>
  );
}

interface CrmDashboardData {
  stats: {
    totalPatients: number;
    todayAppointments: number;
    upcomingAppointments: number;
    activeDoctors: number;
    monthlyRevenue: number;
    newPatientsThisMonth: number;
  };
  subscription?: {
    status: string;
    planName: string;
    endDate?: string;
    suspendReason?: string;
    isRestricted: boolean;
  };
  recentAppointments: CrmAppointment[];
}

interface Patient {
  id: string;
  fullName: string;
  user?: { email: string; phone: string };
  _count?: { appointments: number };
}

interface Doctor {
  id: string;
  fullName: string;
  specialization: string;
  qualification: string;
  experience: number;
  consultationFee: number;
  _count?: { appointments: number };
}

interface CrmAppointment {
  id: string;
  appointmentDate: string;
  startTime: string;
  status: string;
  patient: { fullName: string };
  doctor: { fullName: string };
}

interface Bill {
  id: string;
  billNumber: string;
  total: number;
  status: string;
  patient: { fullName: string };
}
