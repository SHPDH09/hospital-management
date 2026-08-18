import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Stethoscope, Calendar, Shield, CreditCard } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { api } from '@/lib/api';
import { getStatusColor } from '@/lib/utils';

export function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/dashboard/admin'),
  });

  const dashboard = data?.data as AdminDashboardData | undefined;
  const stats = dashboard?.stats;

  const statCards = stats
    ? [
        { label: 'Organizations', value: stats.totalOrganizations, icon: Building2 },
        { label: 'Hospitals', value: stats.totalHospitals, icon: Building2 },
        { label: 'Clinics', value: stats.totalClinics, icon: Building2 },
        { label: 'Doctors', value: stats.totalDoctors, icon: Stethoscope },
        { label: 'Patients', value: stats.totalPatients, icon: Users },
        { label: 'Appointments', value: stats.totalAppointments, icon: Calendar },
        { label: 'Pending Verification', value: stats.pendingVerification, icon: Shield },
        { label: 'Active Subscriptions', value: stats.activeSubscriptions, icon: CreditCard },
      ]
    : [];

  return (
    <DashboardLayout portal="admin">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of the healthcare network</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((card) => (
              <div key={card.label} className="card p-6">
                <div className="flex items-center gap-3">
                  <card.icon className="h-8 w-8 text-primary-600" />
                  <div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-6">
            <h2 className="font-semibold mb-4">Recent Registrations</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Registered</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dashboard?.recentRegistrations?.map((org) => (
                  <tr key={org.id} className="border-b border-gray-100">
                    <td className="py-3 font-medium">{org.name}</td>
                    <td className="py-3">{org.type}</td>
                    <td className="py-3">
                      <span className={`badge ${getStatusColor(org.verificationStatus)}`}>
                        {org.verificationStatus}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      {org.verificationStatus === 'PENDING' && (
                        <VerifyButtons orgId={org.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

function VerifyButtons({ orgId }: { orgId: string }) {
  const handleVerify = async (status: string) => {
    await api.patch(`/organizations/${orgId}/verification`, { status, isPubliclyListed: true });
    window.location.reload();
  };

  return (
    <div className="flex gap-2">
      <button onClick={() => handleVerify('APPROVED')} className="text-xs text-green-600 hover:underline">
        Approve
      </button>
      <button onClick={() => handleVerify('REJECTED')} className="text-xs text-red-600 hover:underline">
        Reject
      </button>
    </div>
  );
}

export function AdminOrganizationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-organizations'],
    queryFn: () => api.get('/organizations'),
  });

  return (
    <DashboardLayout portal="admin">
      <h1 className="text-2xl font-bold mb-6">Organizations</h1>
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">City</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Doctors</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data as Org[] | undefined)?.map((org) => (
                <tr key={org.id} className="border-t border-gray-100">
                  <td className="px-6 py-4 font-medium">{org.name}</td>
                  <td className="px-6 py-4">{org.type}</td>
                  <td className="px-6 py-4">{org.city}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${getStatusColor(org.verificationStatus)}`}>{org.verificationStatus}</span>
                  </td>
                  <td className="px-6 py-4">{org._count?.doctors || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

export function AdminSubscriptionsPage() {
  const { data: plans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => api.get('/admin/subscriptions/plans'),
  });

  const { data: subs, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.get('/admin/subscriptions'),
  });

  return (
    <DashboardLayout portal="admin">
      <h1 className="text-2xl font-bold mb-6">Subscriptions</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {(plans?.data as Plan[] | undefined)?.map((plan) => (
          <div key={plan.id} className="card p-6">
            <h3 className="font-semibold text-lg">{plan.name}</h3>
            <p className="text-2xl font-bold text-primary-600 mt-2">
              {plan.price ? `₹${plan.price}/mo` : 'Custom'}
            </p>
            <ul className="mt-4 space-y-1">
              {plan.features.map((f: string) => (
                <li key={f} className="text-sm text-gray-500">✓ {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Organization</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">End Date</th>
              </tr>
            </thead>
            <tbody>
              {(subs?.data as Subscription[] | undefined)?.map((sub) => (
                <tr key={sub.id} className="border-t border-gray-100">
                  <td className="px-6 py-4">{sub.organization.name}</td>
                  <td className="px-6 py-4">{sub.plan.name}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${getStatusColor(sub.status)}`}>{sub.status}</span>
                  </td>
                  <td className="px-6 py-4">{sub.endDate ? new Date(sub.endDate).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

export function AdminAdvertisementsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-ads'],
    queryFn: () => api.get('/admin/advertisements'),
  });

  return (
    <DashboardLayout portal="admin">
      <h1 className="text-2xl font-bold mb-6">Advertisements</h1>
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : (data?.data as Ad[] | undefined)?.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">No advertisements</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Title</th>
                <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Organization</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Impressions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data as Ad[] | undefined)?.map((ad) => (
                <tr key={ad.id} className="border-t border-gray-100">
                  <td className="px-6 py-4 font-medium">{ad.title}</td>
                  <td className="px-6 py-4">{ad.type}</td>
                  <td className="px-6 py-4">{ad.organization?.name || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`badge ${getStatusColor(ad.status)}`}>{ad.status}</span>
                  </td>
                  <td className="px-6 py-4">{ad.impressions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}

interface AdminDashboardData {
  stats: {
    totalOrganizations: number;
    totalHospitals: number;
    totalClinics: number;
    totalDoctors: number;
    totalPatients: number;
    totalAppointments: number;
    pendingVerification: number;
    activeSubscriptions: number;
  };
  recentRegistrations: { id: string; name: string; type: string; verificationStatus: string; createdAt: string }[];
}

interface Org {
  id: string;
  name: string;
  type: string;
  city: string;
  verificationStatus: string;
  _count?: { doctors: number };
}

interface Plan {
  id: string;
  name: string;
  price: number | null;
  features: string[];
}

interface Subscription {
  id: string;
  status: string;
  endDate: string;
  organization: { name: string };
  plan: { name: string };
}

interface Ad {
  id: string;
  title: string;
  type: string;
  status: string;
  impressions: number;
  organization?: { name: string };
}
