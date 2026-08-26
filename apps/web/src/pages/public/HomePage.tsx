import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  MapPin,
  Star,
  Building2,
  Stethoscope,
  Shield,
  ArrowRight,
  Calendar,
  HeartPulse,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { AnimateIn } from '@/components/ui/AnimateIn';
import { useCountUp } from '@/hooks/useCountUp';
import { useInView } from '@/hooks/useInView';
import { api } from '@/lib/api';

const QUICK_LINKS = [
  {
    to: '/find/doctors',
    icon: Stethoscope,
    title: 'Find a Doctor',
    desc: 'Browse specialists by city & rating',
    color: 'from-blue-500 to-primary-600',
  },
  {
    to: '/find/hospitals',
    icon: Building2,
    title: 'Find a Hospital',
    desc: 'Trusted hospitals near you',
    color: 'from-teal-500 to-emerald-600',
  },
  {
    to: '/login/patient',
    icon: Calendar,
    title: 'Book Appointment',
    desc: 'Schedule visits in minutes',
    color: 'from-violet-500 to-purple-600',
  },
  {
    to: '/register',
    icon: HeartPulse,
    title: 'Patient Sign Up',
    desc: 'Create your health profile',
    color: 'from-rose-500 to-pink-600',
  },
] as const;

function StatItem({ label, value }: { label: string; value: number }) {
  const { ref, inView } = useInView(0.3);
  const count = useCountUp(value, inView);

  return (
    <div ref={ref} className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-50 to-white p-6 border border-primary-100 transition-transform duration-300 hover:scale-105 motion-reduce:transform-none">
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-primary-100/60 transition-transform duration-500 group-hover:scale-125" />
      <div className="relative text-3xl font-bold text-primary-600 tabular-nums">
        {count}+
      </div>
      <div className="relative text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

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
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-healthcare-teal text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

        {/* Floating blobs */}
        <div className="hero-blob -left-20 top-10 h-72 w-72 bg-white animate-float-slow motion-reduce:animate-none" />
        <div className="hero-blob right-0 top-1/3 h-56 w-56 bg-teal-300 animate-float motion-reduce:animate-none" style={{ animationDelay: '1s' }} />
        <div className="hero-blob bottom-0 left-1/3 h-48 w-48 bg-blue-300 animate-pulse-ring motion-reduce:animate-none" />

        {/* Floating icons */}
        <Stethoscope className="absolute left-[8%] top-[22%] h-8 w-8 text-white/20 animate-float motion-reduce:animate-none hidden lg:block" />
        <HeartPulse className="absolute right-[12%] top-[18%] h-10 w-10 text-white/15 animate-float-slow motion-reduce:animate-none hidden lg:block" />
        <Shield className="absolute right-[20%] bottom-[28%] h-7 w-7 text-white/20 animate-float motion-reduce:animate-none hidden lg:block" style={{ animationDelay: '2s' }} />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm backdrop-blur-sm border border-white/20 mb-6 opacity-0 animate-fade-in-up motion-reduce:opacity-100 motion-reduce:animate-none">
              <Sparkles className="h-4 w-4 text-yellow-300" />
              Trusted healthcare network across India
            </div>

            <h1
              className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl opacity-0 animate-fade-in-up motion-reduce:opacity-100 motion-reduce:animate-none"
              style={{ animationDelay: '0.15s' }}
            >
              Find the Right Healthcare,{' '}
              <span className="bg-gradient-to-r from-white via-primary-100 to-teal-200 bg-clip-text text-transparent">
                Near You.
              </span>
            </h1>

            <p
              className="mt-6 text-lg text-primary-100 opacity-0 animate-fade-in-up motion-reduce:opacity-100 motion-reduce:animate-none"
              style={{ animationDelay: '0.3s' }}
            >
              Discover trusted hospitals, clinics, doctors and healthcare services in one place.
            </p>

            <div
              className="mt-8 flex flex-wrap justify-center gap-4 opacity-0 animate-fade-in-up motion-reduce:opacity-100 motion-reduce:animate-none"
              style={{ animationDelay: '0.45s' }}
            >
              <Link to="/find/doctors" className="btn bg-white text-primary-700 hover:bg-primary-50 px-6 py-3 hero-btn">
                <Stethoscope className="h-5 w-5" />
                Find a Doctor
              </Link>
              <Link to="/find/hospitals" className="btn border-2 border-white text-white hover:bg-white/10 px-6 py-3 hero-btn">
                <Building2 className="h-5 w-5" />
                Find a Hospital
              </Link>
            </div>
          </div>

          {/* Search */}
          <form
            onSubmit={handleSearch}
            className="mt-12 mx-auto max-w-2xl opacity-0 animate-scale-in motion-reduce:opacity-100 motion-reduce:animate-none"
            style={{ animationDelay: '0.6s' }}
          >
            <div className="flex flex-col sm:flex-row gap-3 bg-white rounded-xl p-2 shadow-2xl ring-1 ring-white/50 transition-shadow duration-300 focus-within:shadow-primary-500/20 focus-within:ring-primary-300">
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
              <button type="submit" className="btn-primary px-8 py-3 rounded-lg hero-btn">
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Quick links */}
      <section className="relative -mt-8 z-10 pb-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {QUICK_LINKS.map((item, i) => (
              <AnimateIn key={item.to} delay={i * 100}>
                <Link
                  to={item.to}
                  className="group flex items-start gap-4 rounded-2xl bg-white p-5 shadow-lg border border-gray-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl motion-reduce:transform-none"
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 motion-reduce:transform-none`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">{item.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 ml-auto mt-1 transition-all duration-300 group-hover:text-primary-500 group-hover:translate-x-1" />
                </Link>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      {stats?.data && (
        <section className="bg-white border-b border-gray-200 py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <AnimateIn className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900">Our Growing Network</h2>
              <p className="text-gray-500 mt-2">Real-time stats from verified healthcare providers</p>
            </AnimateIn>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <StatItem label="Hospitals" value={stats.data.hospitals} />
              <StatItem label="Clinics" value={stats.data.clinics} />
              <StatItem label="Doctors" value={stats.data.doctors} />
              <StatItem label="Patients" value={stats.data.patients} />
            </div>
          </div>
        </section>
      )}

      {/* Featured Hospitals */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Featured Hospitals</h2>
              <p className="text-gray-500 text-sm mt-1">Top-rated facilities in your area</p>
            </div>
            <Link to="/find/hospitals" className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1 group">
              View all
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hospitals?.data?.map((org, i) => (
              <AnimateIn key={org.id} delay={i * 80}>
                <OrganizationCard org={org} />
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Doctors */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Top Doctors</h2>
              <p className="text-gray-500 text-sm mt-1">Experienced specialists ready to help</p>
            </div>
            <Link to="/find/doctors" className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1 group">
              View all
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors?.data?.map((doc, i) => (
              <AnimateIn key={doc.id} delay={i * 80}>
                <DoctorCard doctor={doc} />
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900">How It Works</h2>
            <p className="text-gray-500 mt-2">Get care in three simple steps</p>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Search', desc: 'Find doctors or hospitals by specialty, city, or rating.', icon: Search },
              { step: '02', title: 'Compare', desc: 'Review profiles, fees, experience, and patient ratings.', icon: Star },
              { step: '03', title: 'Book', desc: 'Schedule appointments online and manage your health.', icon: Clock },
            ].map((item, i) => (
              <AnimateIn key={item.step} delay={i * 120}>
                <div className="relative text-center group">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 transition-all duration-300 group-hover:bg-primary-600 group-hover:text-white group-hover:scale-110 motion-reduce:transform-none">
                    <item.icon className="h-7 w-7" />
                  </div>
                  <span className="text-xs font-bold text-primary-400 tracking-widest">{item.step}</span>
                  <h3 className="text-lg font-semibold text-gray-900 mt-1">{item.title}</h3>
                  <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">{item.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-600 to-healthcare-teal" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_50%,white,transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-white">
          <AnimateIn>
            <Shield className="h-14 w-14 mx-auto mb-5 animate-float motion-reduce:animate-none" />
            <h2 className="text-3xl font-bold mb-4">Are you a Healthcare Provider?</h2>
            <p className="text-primary-100 mb-8 max-w-xl mx-auto text-lg">
              Join our network to reach more patients, manage appointments, and grow your practice with our powerful CRM.
            </p>
            <Link
              to="/register/hospital"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 font-semibold text-primary-700 shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl active:scale-95 motion-reduce:transform-none"
            >
              Register Your Hospital
              <ArrowRight className="h-5 w-5" />
            </Link>
          </AnimateIn>
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
    <Link to={`/organizations/${org.slug}`} className="interactive-card group p-6 block h-full">
      <div className="flex items-start justify-between">
        <div>
          <span className="badge bg-primary-100 text-primary-700 transition-colors group-hover:bg-primary-600 group-hover:text-white">{org.type}</span>
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
      <h3 className="mt-3 text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">{org.name}</h3>
      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
        <MapPin className="h-4 w-4" />
        {org.city}, {org.state}
      </p>
      {org._count && (
        <p className="text-sm text-gray-500 mt-2">{org._count.doctors} doctors</p>
      )}
      <span className="inline-flex items-center gap-1 text-sm text-primary-600 font-medium mt-4 opacity-0 translate-y-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
        View details <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

export function DoctorCard({ doctor }: { doctor: Doctor }) {
  const initials = doctor.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Link to={`/doctors/${doctor.id}`} className="interactive-card group p-6 block h-full">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-lg transition-transform duration-300 group-hover:scale-110 motion-reduce:transform-none">
          {initials}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">{doctor.fullName}</h3>
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
