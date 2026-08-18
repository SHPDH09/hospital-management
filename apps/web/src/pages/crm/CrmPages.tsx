import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, LoadingState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency, getStatusColor } from '@/lib/utils';

export function CrmPatientsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['crm-patients'],
    queryFn: () => api.get('/patients'),
  });

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Patients" subtitle="Manage patients in your organization" />
      {isLoading ? <LoadingState /> : (
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
      <PageHeader title="Doctors" subtitle="Manage doctors in your hospital" />
      {isLoading ? <LoadingState /> : (
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
      <PageHeader title="Appointments" subtitle="Manage appointment lifecycle" />
      {isLoading ? <LoadingState /> : (
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
      <PageHeader title="Billing & Payments" subtitle="Patient bills and payment records" />
      {isLoading ? <LoadingState /> : (data?.data as Bill[] | undefined)?.length === 0 ? (
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
