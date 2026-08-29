import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, UserPlus } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, LoadingState, EditModal, type EditField, ApiErrorState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency, getStatusColor, cn } from '@/lib/utils';

type PatientSource = 'CRM' | 'PUBLIC';

const PATIENT_CREATE_FIELDS: EditField[] = [
  { name: 'fullName', label: 'Full Name', required: true },
  { name: 'phone', label: 'Phone', placeholder: 'e.g. 9876543210' },
  { name: 'email', label: 'Email (optional)', type: 'email' },
  { name: 'dateOfBirth', label: 'Date of Birth', placeholder: 'YYYY-MM-DD' },
  {
    name: 'gender',
    label: 'Gender',
    type: 'select',
    options: [
      { value: '', label: 'Select gender' },
      { value: 'MALE', label: 'Male' },
      { value: 'FEMALE', label: 'Female' },
      { value: 'OTHER', label: 'Other' },
    ],
  },
  { name: 'city', label: 'City' },
  { name: 'state', label: 'State' },
  { name: 'address', label: 'Address', type: 'textarea' },
  { name: 'emergencyContact', label: 'Emergency Contact' },
  { name: 'bloodGroup', label: 'Blood Group' },
  { name: 'notes', label: 'Internal Notes', type: 'textarea' },
];

function SourceBadge({ source }: { source?: PatientSource }) {
  const isCrm = source === 'CRM';
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
      isCrm ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700',
    )}>
      {isCrm ? 'CRM' : 'Public Source'}
    </span>
  );
}

function getPatientSource(patient: Patient): PatientSource {
  const org = patient.organizations?.[0];
  return org?.source === 'CRM' ? 'CRM' : 'PUBLIC';
}

export function CrmPatientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'ALL' | PatientSource>('ALL');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setCreating(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const queryString = [
    sourceFilter !== 'ALL' ? `source=${sourceFilter}` : '',
    search.trim() ? `query=${encodeURIComponent(search.trim())}` : '',
    'limit=50',
  ].filter(Boolean).join('&');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['crm-patients', sourceFilter, search],
    queryFn: async () => {
      const res = await api.get(`/patients?${queryString}`);
      if (!res.success) throw new Error(res.error || 'Failed to load patients');
      return res;
    },
  });

  const patients = (data?.data as Patient[] | undefined) || [];

  return (
    <DashboardLayout portal="crm">
      <PageHeader
        title="Patients"
        subtitle="Manage patients and see whether each record was added via CRM or from a public source"
        actions={
          <button type="button" className="btn-primary text-sm whitespace-nowrap" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 inline mr-1" />
            Add Patient
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {([
            { key: 'ALL', label: 'All Sources' },
            { key: 'CRM', label: 'CRM' },
            { key: 'PUBLIC', label: 'Public Source' },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSourceFilter(tab.key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                sourceFilter === tab.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          className="input max-w-xs"
          placeholder="Search name, email, or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? <LoadingState /> : isError ? (
        <ApiErrorState message={error instanceof Error ? error.message : 'Failed to load patients'} onRetry={() => refetch()} />
      ) : patients.length === 0 ? (
        <div className="card p-12 text-center">
          <UserPlus className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 font-medium text-gray-900">No patients found</p>
          <p className="mt-1 text-sm text-gray-500">
            Add a patient manually via CRM or patients will appear here when they book from the public website.
          </p>
          <button type="button" className="btn-primary text-sm mt-4" onClick={() => setCreating(true)}>Add Patient</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Source</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Appointments</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-6 py-4 font-medium">{p.fullName}</td>
                  <td className="px-6 py-4"><SourceBadge source={getPatientSource(p)} /></td>
                  <td className="px-6 py-4 text-gray-500">{formatEmail(p.user?.email)}</td>
                  <td className="px-6 py-4 text-gray-500">{p.user?.phone || '-'}</td>
                  <td className="px-6 py-4">{p._count?.appointments || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <EditModal
          title="Add Patient"
          fields={PATIENT_CREATE_FIELDS}
          submitLabel="Add Patient"
          onClose={() => setCreating(false)}
          onSave={async (values) => {
            const payload = {
              ...values,
              gender: values.gender || undefined,
              dateOfBirth: values.dateOfBirth || undefined,
            };
            const res = await api.post('/patients', payload);
            if (!res.success) throw new Error(res.error || 'Failed to add patient');
            setCreating(false);
            qc.invalidateQueries({ queryKey: ['crm-patients'] });
            refetch();
          }}
        />
      )}
    </DashboardLayout>
  );
}

function formatEmail(email?: string): string {
  if (!email) return '-';
  if (email.endsWith('@temp.healthcare.local')) return '-';
  return email;
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
  organizations?: { source?: PatientSource }[];
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
