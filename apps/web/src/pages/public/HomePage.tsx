import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, MapPin, Star, Building2, Stethoscope, Shield, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { HospitalLogo } from '@/components/HospitalLogo';
import { api } from '@/lib/api';

export function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCity, setSearchCity] = useState('');

  const { data: stats } = useQuery({
    queryKey: ['public-stats'],
    queryFn: () => api.get<{ hospitals: number; clinics: number; doctors: number; patients: number }>('/public/stats'),
  });

  const { data: hospitals } = useQuery({
    queryKey: ['featured-hospitals'],
    queryFn: () => api.get<Organization[]>('/organizations/search?limit=6'),
  });

  const { data: doctors } = useQuery({
    queryKey: ['featured-doctors'],
    queryFn: () => api.get<Doctor[]>('/doctors/search?limit=6'),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('query', searchQuery);
    if (searchCity) params.set('city', searchCity);
    window.location.href = `/find/doctors?${params.toString()}`;
  };

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary-600 via-primary-700 to-healthcare-teal text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Find the Right Healthcare, Near You.
            </h1>
            <p className="mt-6 text-lg text-primary-100">
              Discover trusted hospitals, clinics, doctors and healthcare services in one place.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link to="/find/doctors" className="btn bg-white text-primary-700 hover:bg-primary-50 px-6 py-3">
                <Stethoscope className="h-5 w-5" />
                Find a Doctor
              </Link>
              <Link to="/find/hospitals" className="btn border-2 border-white text-white hover:bg-white/10 px-6 py-3">
                <Building2 className="h-5 w-5" />
                Find a Hospital
              </Link>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mt-12 mx-auto max-w-2xl">
            <div className="flex flex-col sm:flex-row gap-3 bg-white rounded-xl p-2 shadow-xl">
              <div className="flex-1 flex items-center gap-2 px-3">
                <Search className="h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search doctors, hospitals, specialties..."
                  className="flex-1 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 px-3 border-t sm:border-t-0 sm:border-l border-gray-200">
                <MapPin className="h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="City"
                  className="w-32 py-2 text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary px-8 py-3 rounded-lg">
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Stats */}
      {stats?.data && (
        <section className="bg-white border-b border-gray-200">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { label: 'Hospitals', value: stats.data.hospitals },
                { label: 'Clinics', value: stats.data.clinics },
                { label: 'Doctors', value: stats.data.doctors },
                { label: 'Patients', value: stats.data.patients },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-3xl font-bold text-primary-600">{stat.value}+</div>
                  <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Hospitals */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Featured Hospitals</h2>
            <Link to="/find/hospitals" className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hospitals?.data?.map((org) => (
              <OrganizationCard key={org.id} org={org} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Doctors */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Top Doctors</h2>
            <Link to="/find/doctors" className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors?.data?.map((doc) => (
              <DoctorCard key={doc.id} doctor={doc} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <Shield className="h-12 w-12 text-primary-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Are you a Healthcare Provider?</h2>
          <p className="text-gray-600 mb-8 max-w-xl mx-auto">
            Join our network to reach more patients, manage appointments, and grow your practice with our powerful CRM.
          </p>
          <Link to="/register/hospital" className="btn-primary px-8 py-3">
            Register Your Hospital
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  type: string;
  city: string;
  state: string;
  averageRating: number;
  reviewCount: number;
  emergencyAvailable: boolean;
  facilities: string[];
  logoUrl?: string | null;
  branding?: { displayLogoUrl?: string | null; name?: string };
  _count?: { doctors: number };
}

interface Doctor {
  id: string;
  fullName: string;
  specialization: string;
  qualification: string;
  experience: number;
  consultationFee: number;
  averageRating: number;
  reviewCount: number;
  organization?: { name: string; city: string };
}

export function OrganizationCard({ org }: { org: Organization }) {
  return (
    <Link to={`/organizations/${org.slug}`} className="card p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-center mb-4">
        <HospitalLogo organization={org} size="md" />
      </div>
      <div className="flex items-start justify-between">
        <div>
          <span className="badge bg-primary-100 text-primary-700">{org.type}</span>
          {org.emergencyAvailable && (
            <span className="badge bg-red-100 text-red-700 ml-2">24/7 Emergency</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="font-medium">{org.averageRating.toFixed(1)}</span>
          <span className="text-gray-400">({org.reviewCount})</span>
        </div>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-gray-900">{org.name}</h3>
      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
        <MapPin className="h-4 w-4" />
        {org.city}, {org.state}
      </p>
      {org._count && (
        <p className="text-sm text-gray-500 mt-2">{org._count.doctors} doctors</p>
      )}
    </Link>
  );
}

export function DoctorCard({ doctor }: { doctor: Doctor }) {
  return (
    <Link to={`/doctors/${doctor.id}`} className="card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg">
          {doctor.fullName.charAt(3)}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{doctor.fullName}</h3>
          <p className="text-sm text-primary-600">{doctor.specialization}</p>
          <p className="text-xs text-gray-500 mt-1">{doctor.qualification}</p>
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span>{doctor.averageRating.toFixed(1)}</span>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-500">{doctor.experience} yrs exp.</span>
        <span className="font-medium text-gray-900">₹{doctor.consultationFee}</span>
      </div>
      {doctor.organization && (
        <p className="text-xs text-gray-400 mt-2">{doctor.organization.name}, {doctor.organization.city}</p>
      )}
    </Link>
  );
}
