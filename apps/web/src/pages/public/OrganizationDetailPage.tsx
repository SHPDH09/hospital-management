import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Star, Phone, Clock, Shield, Calendar } from 'lucide-react';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { DoctorCard } from '@/pages/public/HomePage';
import { api } from '@/lib/api';

export function OrganizationDetailPage() {
  const { slug } = useParams();

  const { data, isLoading } = useQuery({
    queryKey: ['organization', slug],
    queryFn: () => api.get(`/organizations/${slug}`),
  });

  const org = data?.data as OrganizationDetail | undefined;

  if (isLoading) return <PublicLayout><div className="text-center py-20">Loading...</div></PublicLayout>;
  if (!org) return <PublicLayout><div className="text-center py-20">Organization not found</div></PublicLayout>;

  return (
    <PublicLayout>
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="h-24 w-24 rounded-xl bg-primary-100 flex items-center justify-center text-primary-700 text-3xl font-bold">
              {org.name.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="badge bg-primary-100 text-primary-700">{org.type}</span>
                {org.verificationStatus === 'APPROVED' && (
                  <span className="badge bg-green-100 text-green-700 flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Verified
                  </span>
                )}
                {org.emergencyAvailable && <span className="badge bg-red-100 text-red-700">24/7 Emergency</span>}
              </div>
              <h1 className="text-3xl font-bold text-gray-900">{org.name}</h1>
              <p className="text-gray-500 flex items-center gap-1 mt-2">
                <MapPin className="h-4 w-4" /> {org.address}, {org.city}, {org.state}
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{org.averageRating.toFixed(1)}</span>
                  <span className="text-gray-400">({org.reviewCount} reviews)</span>
                </div>
                {org.phone && (
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Phone className="h-4 w-4" /> {org.phone}
                  </span>
                )}
              </div>
            </div>
            <div>
              <Link to={`/book/${org.slug}`} className="btn-primary px-8 py-3">
                <Calendar className="h-5 w-5" /> Book Appointment
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {org.description && (
              <section className="card p-6">
                <h2 className="text-lg font-semibold mb-3">About</h2>
                <p className="text-gray-600">{org.description}</p>
              </section>
            )}

            <section className="card p-6">
              <h2 className="text-lg font-semibold mb-4">Our Doctors</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {org.doctors?.map((doc) => (
                  <DoctorCard key={doc.id} doctor={doc as never} />
                ))}
              </div>
            </section>

            {org.departments && org.departments.length > 0 && (
              <section className="card p-6">
                <h2 className="text-lg font-semibold mb-4">Departments</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {org.departments.map((dept) => (
                    <div key={dept.id} className="rounded-lg bg-gray-50 p-3 text-sm font-medium">{dept.name}</div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-6">
            {org.facilities && org.facilities.length > 0 && (
              <div className="card p-6">
                <h3 className="font-semibold mb-3">Facilities</h3>
                <div className="flex flex-wrap gap-2">
                  {org.facilities.map((f) => (
                    <span key={f} className="badge bg-gray-100 text-gray-700">{f}</span>
                  ))}
                </div>
              </div>
            )}

            {org.services && org.services.length > 0 && (
              <div className="card p-6">
                <h3 className="font-semibold mb-3">Services & Pricing</h3>
                <ul className="space-y-2">
                  {org.services.map((s) => (
                    <li key={s.id} className="flex justify-between text-sm">
                      <span>{s.name}</span>
                      <span className="font-medium">₹{s.price}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Opening Hours
              </h3>
              <p className="text-sm text-gray-600">
                {org.emergencyAvailable ? 'Open 24/7' : 'Contact for hours'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

interface OrganizationDetail {
  id: string;
  name: string;
  type: string;
  slug: string;
  description: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  averageRating: number;
  reviewCount: number;
  verificationStatus: string;
  emergencyAvailable: boolean;
  facilities: string[];
  doctors: { id: string; fullName: string }[];
  departments: { id: string; name: string }[];
  services: { id: string; name: string; price: number }[];
}
