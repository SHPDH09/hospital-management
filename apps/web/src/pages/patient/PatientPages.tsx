import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, Receipt, Stethoscope, ArrowRight } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { api } from '@/lib/api';
import { formatDate, formatCurrency, getStatusColor } from '@/lib/utils';

export function PatientDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['patient-dashboard'],
    queryFn: () => api.get('/dashboard/patient'),
  });

  const dashboard = data?.data as PatientDashboardData | undefined;

  return (
    <DashboardLayout portal="patient">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Health Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage your appointments and health records</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link to="/find/doctors" className="card p-6 hover:shadow-md transition-shadow">
          <Stethoscope className="h-8 w-8 text-primary-600 mb-3" />
          <h3 className="font-semibold">Find Doctor</h3>
          <p className="text-sm text-gray-500 mt-1">Search and book appointments</p>
        </Link>
        <Link to="/patient/appointments" className="card p-6 hover:shadow-md transition-shadow">
          <Calendar className="h-8 w-8 text-primary-600 mb-3" />
          <h3 className="font-semibold">My Appointments</h3>
          <p className="text-sm text-gray-500 mt-1">View upcoming and past visits</p>
        </Link>
        <Link to="/find/hospitals" className="card p-6 hover:shadow-md transition-shadow">
          <Receipt className="h-8 w-8 text-primary-600 mb-3" />
          <h3 className="font-semibold">Find Hospital</h3>
          <p className="text-sm text-gray-500 mt-1">Discover healthcare providers</p>
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Upcoming Appointments</h2>
              <Link to="/patient/appointments" className="text-sm text-primary-600 flex items-center gap-1">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {dashboard?.upcomingAppointments?.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No upcoming appointments</p>
            ) : (
              <div className="space-y-3">
                {dashboard?.upcomingAppointments?.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{apt.doctor.fullName}</p>
                      <p className="text-xs text-gray-500">{apt.organization.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(apt.appointmentDate)} at {apt.startTime}</p>
                    </div>
                    <span className={`badge ${getStatusColor(apt.status)}`}>{apt.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6">
            <h2 className="font-semibold mb-4">Pending Bills</h2>
            {dashboard?.pendingBills?.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No pending bills</p>
            ) : (
              <div className="space-y-3">
                {dashboard?.pendingBills?.map((bill) => (
                  <div key={bill.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{bill.organization.name}</p>
                      <p className="text-xs text-gray-400">{bill.billNumber}</p>
                    </div>
                    <span className="font-medium">{formatCurrency(bill.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export function PatientAppointmentsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => api.get('/appointments/my'),
  });

  return (
    <DashboardLayout portal="patient">
      <h1 className="text-2xl font-bold mb-6">My Appointments</h1>
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (data?.data as Appointment[] | undefined)?.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No appointments yet</p>
          <Link to="/find/doctors" className="btn-primary">Book an Appointment</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {(data?.data as Appointment[] | undefined)?.map((apt) => (
            <div key={apt.id} className="card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{apt.doctor.fullName}</h3>
                  <p className="text-sm text-primary-600">{apt.doctor.specialization}</p>
                  <p className="text-sm text-gray-500 mt-1">{apt.organization.name}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {formatDate(apt.appointmentDate)} at {apt.startTime}
                  </p>
                </div>
                <span className={`badge ${getStatusColor(apt.status)}`}>{apt.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

interface PatientDashboardData {
  upcomingAppointments: Appointment[];
  pendingBills: { id: string; billNumber: string; total: number; organization: { name: string } }[];
}

interface Appointment {
  id: string;
  appointmentDate: string;
  startTime: string;
  status: string;
  doctor: { fullName: string; specialization: string };
  organization: { name: string };
}
