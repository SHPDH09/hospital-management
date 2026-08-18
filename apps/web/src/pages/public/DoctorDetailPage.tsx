import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, Calendar, MapPin } from 'lucide-react';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

export function DoctorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['doctor', id],
    queryFn: () => api.get(`/doctors/${id}`),
  });

  const doctor = data?.data as DoctorDetail | undefined;

  const handleBook = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!selectedSlot || !doctor) return;

    const slot = doctor.slots?.find((s) => s.id === selectedSlot);
    if (!slot) return;

    setBooking(true);
    try {
      const res = await api.post('/appointments/book', {
        doctorId: doctor.id,
        organizationId: doctor.organization.id,
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
      alert('Booking failed');
    } finally {
      setBooking(false);
    }
  };

  if (isLoading) return <PublicLayout><div className="text-center py-20">Loading...</div></PublicLayout>;
  if (!doctor) return <PublicLayout><div className="text-center py-20">Doctor not found</div></PublicLayout>;

  const slotsByDate = doctor.slots?.reduce((acc, slot) => {
    const date = slot.date.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, typeof doctor.slots>) || {};

  return (
    <PublicLayout>
      <div className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="h-28 w-28 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-4xl font-bold">
              {doctor.fullName.charAt(3)}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{doctor.fullName}</h1>
              <p className="text-lg text-primary-600 mt-1">{doctor.specialization}</p>
              <p className="text-gray-500 mt-1">{doctor.qualification}</p>
              <div className="flex items-center gap-4 mt-3 text-sm">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {doctor.averageRating.toFixed(1)} ({doctor.reviewCount} reviews)
                </span>
                <span>{doctor.experience} years experience</span>
                <span className="font-medium text-gray-900">₹{doctor.consultationFee} consultation</span>
              </div>
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-2">
                <MapPin className="h-4 w-4" />
                {doctor.organization.name}, {doctor.organization.city}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {doctor.bio && (
              <section className="card p-6 mb-6">
                <h2 className="text-lg font-semibold mb-3">About</h2>
                <p className="text-gray-600">{doctor.bio}</p>
              </section>
            )}
          </div>

          <div>
            <div className="card p-6 sticky top-24">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5" /> Book Appointment
              </h3>

              {Object.keys(slotsByDate).length === 0 ? (
                <p className="text-sm text-gray-500">No available slots. Please check back later.</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {Object.entries(slotsByDate).map(([date, slots]) => (
                    <div key={date}>
                      <p className="text-sm font-medium text-gray-700 mb-2">{formatDate(date)}</p>
                      <div className="flex flex-wrap gap-2">
                        {slots?.map((slot) => (
                          <button
                            key={slot.id}
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

              <button
                onClick={handleBook}
                disabled={!selectedSlot || booking}
                className="btn-primary w-full mt-6 py-3"
              >
                {booking ? 'Booking...' : isAuthenticated ? 'Confirm Booking' : 'Login to Book'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

interface DoctorDetail {
  id: string;
  fullName: string;
  specialization: string;
  qualification: string;
  experience: number;
  consultationFee: number;
  averageRating: number;
  reviewCount: number;
  bio: string;
  organization: { id: string; name: string; city: string };
  slots: { id: string; date: string; startTime: string; endTime: string }[];
}
