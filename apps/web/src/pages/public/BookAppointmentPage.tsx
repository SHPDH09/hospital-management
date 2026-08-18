import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Star, ArrowLeft } from 'lucide-react';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  doctors: { id: string; fullName: string; specialization: string; consultationFee: number; averageRating: number }[];
}

interface DoctorSlots {
  id: string;
  fullName: string;
  specialization: string;
  consultationFee: number;
  slots: { id: string; date: string; startTime: string; endTime: string }[];
}

export function BookAppointmentPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get('organizationId');
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const { data: orgData, isLoading: orgLoading, error: orgError } = useQuery({
    queryKey: ['book-org', slug, organizationId],
    queryFn: async () => {
      if (slug) return api.get(`/organizations/${slug}`);
      if (organizationId) return api.get(`/organizations/by-id/${organizationId}`);
      return { success: false, error: 'Organization not specified' };
    },
    enabled: !!(slug || organizationId),
  });

  const org = orgData?.data as OrgInfo | undefined;
  const orgId = org?.id;

  const { data: doctorData, isLoading: doctorLoading } = useQuery({
    queryKey: ['book-doctor', selectedDoctorId],
    queryFn: () => api.get(`/doctors/${selectedDoctorId}`),
    enabled: !!selectedDoctorId,
  });

  const doctor = doctorData?.data as DoctorSlots | undefined;

  const slotsByDate = doctor?.slots?.reduce((acc, slot) => {
    const date = slot.date.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, DoctorSlots['slots']>) || {};

  const handleBook = async () => {
    if (!isAuthenticated) {
      navigate(`/login/patient?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    if (!selectedSlot || !doctor || !orgId) return;

    const slot = doctor.slots.find((s) => s.id === selectedSlot);
    if (!slot) return;

    setBooking(true);
    try {
      const res = await api.post('/appointments/book', {
        doctorId: doctor.id,
        organizationId: orgId,
        appointmentDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotId: slot.id,
      });
      if (res.success) {
        navigate('/patient/appointments');
      } else {
        alert(res.error || 'Booking failed');
      }
    } catch {
      alert('Booking failed. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  if (!slug && !organizationId) {
    return (
      <PublicLayout>
        <div className="text-center py-20">
          <p className="text-gray-600 mb-4">No hospital or clinic selected.</p>
          <Link to="/find/hospitals" className="btn-primary">Find Hospitals</Link>
        </div>
      </PublicLayout>
    );
  }

  if (orgLoading) return <PublicLayout><div className="text-center py-20">Loading...</div></PublicLayout>;
  if (orgError || !orgData?.success || !org) {
    return (
      <PublicLayout>
        <div className="text-center py-20">
          <p className="text-gray-600 mb-4">{orgData?.error || 'Organization not found'}</p>
          <Link to="/find/hospitals" className="btn-primary">Find Hospitals</Link>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <Link to={`/organizations/${org.slug}`} className="text-sm text-primary-600 hover:underline flex items-center gap-1 mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to hospital
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Book Appointment</h1>
          <p className="text-gray-600 mt-1">{org.name}</p>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <MapPin className="h-4 w-4" /> {org.address}, {org.city}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
        {/* Step 1: Select Doctor */}
        <section className="card p-6">
          <h2 className="font-semibold mb-4">1. Select Doctor</h2>
          {org.doctors.length === 0 ? (
            <p className="text-sm text-gray-500">No doctors available for booking at this time.</p>
          ) : (
            <div className="space-y-2">
              {org.doctors.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => { setSelectedDoctorId(doc.id); setSelectedSlot(null); }}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedDoctorId === doc.id ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{doc.fullName}</p>
                      <p className="text-sm text-primary-600">{doc.specialization}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">₹{doc.consultationFee}</p>
                      <p className="flex items-center gap-1 text-gray-500 justify-end">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {doc.averageRating?.toFixed(1) || '—'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Step 2: Select Slot */}
        {selectedDoctorId && (
          <section className="card p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" /> 2. Select Date & Time
            </h2>
            {doctorLoading ? (
              <p className="text-sm text-gray-500">Loading available slots...</p>
            ) : Object.keys(slotsByDate).length === 0 ? (
              <p className="text-sm text-gray-500">No available slots for this doctor. Please choose another doctor or check back later.</p>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {Object.entries(slotsByDate).map(([date, slots]) => (
                  <div key={date}>
                    <p className="text-sm font-medium text-gray-700 mb-2">{formatDate(date)}</p>
                    <div className="flex flex-wrap gap-2">
                      {slots?.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setSelectedSlot(slot.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            selectedSlot === slot.id
                              ? 'border-primary-600 bg-primary-50 text-primary-700'
                              : 'border-gray-200 hover:border-primary-300'
                          }`}
                        >
                          {slot.startTime}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Step 3: Confirm */}
        {selectedDoctorId && (
          <div className="card p-6">
            <button
              type="button"
              onClick={handleBook}
              disabled={!selectedSlot || booking}
              className="btn-primary w-full py-3"
            >
              {booking ? 'Booking...' : isAuthenticated ? 'Confirm Booking' : 'Login to Book'}
            </button>
            {!isAuthenticated && (
              <p className="text-xs text-gray-500 text-center mt-2">You need a patient account to complete booking.</p>
            )}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
