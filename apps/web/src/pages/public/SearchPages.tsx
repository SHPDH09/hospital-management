import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search, MapPin } from 'lucide-react';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { OrganizationCard, DoctorCard } from '@/pages/public/HomePage';
import { api } from '@/lib/api';

interface Organization { id: string }
interface Doctor { id: string }

export function FindHospitalsPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('query') || '');
  const [city, setCity] = useState(params.get('city') || '');

  const { data, isLoading } = useQuery({
    queryKey: ['hospitals', params.toString()],
    queryFn: () => api.get(`/organizations/search?type=HOSPITAL&${params.toString()}`),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (query) p.set('query', query);
    if (city) p.set('city', city);
    setParams(p);
  };

  return (
    <PublicLayout>
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Find Hospitals</h1>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 input">
              <Search className="h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Search hospitals..." className="flex-1 focus:outline-none" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 input sm:w-48">
              <MapPin className="h-5 w-5 text-gray-400" />
              <input type="text" placeholder="City" className="flex-1 focus:outline-none" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary">Search</button>
          </form>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (data?.data as Organization[] | undefined)?.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No hospitals found. Try adjusting your search.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(data?.data as Organization[] | undefined)?.map((org) => <OrganizationCard key={org.id} org={org as never} />)}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export function FindClinicsPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('query') || '');
  const [city, setCity] = useState(params.get('city') || '');

  const { data, isLoading } = useQuery({
    queryKey: ['clinics', params.toString()],
    queryFn: () => api.get(`/organizations/search?type=CLINIC&${params.toString()}`),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (query) p.set('query', query);
    if (city) p.set('city', city);
    setParams(p);
  };

  return (
    <PublicLayout>
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Find Clinics</h1>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 input">
              <Search className="h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Search clinics..." className="flex-1 focus:outline-none" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 input sm:w-48">
              <MapPin className="h-5 w-5 text-gray-400" />
              <input type="text" placeholder="City" className="flex-1 focus:outline-none" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary">Search</button>
          </form>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(data?.data as Organization[] | undefined)?.map((org) => <OrganizationCard key={org.id} org={org as never} />)}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

export function FindDoctorsPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('query') || '');
  const [city, setCity] = useState(params.get('city') || '');

  const { data, isLoading } = useQuery({
    queryKey: ['doctors', params.toString()],
    queryFn: () => api.get(`/doctors/search?${params.toString()}`),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (query) p.set('query', query);
    if (city) p.set('city', city);
    setParams(p);
  };

  return (
    <PublicLayout>
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Find Doctors</h1>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 input">
              <Search className="h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Search by name or specialty..." className="flex-1 focus:outline-none" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 input sm:w-48">
              <MapPin className="h-5 w-5 text-gray-400" />
              <input type="text" placeholder="City" className="flex-1 focus:outline-none" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary">Search</button>
          </form>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(data?.data as Doctor[] | undefined)?.map((doc) => <DoctorCard key={doc.id} doctor={doc as never} />)}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
