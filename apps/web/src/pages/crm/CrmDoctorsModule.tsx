import { ReactNode, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Users, Stethoscope, UserCheck, UserX, ShieldAlert, CalendarCheck, CalendarClock,
  Calendar, CheckCircle, XCircle, AlertTriangle, Star, Eye, Pencil, Power,
  ArrowLeft, Plus, DollarSign, Building2, Phone, Mail, ClipboardList,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { LoadingState, EditModal, EditField } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { cn, formatCurrency, formatDate, getStatusColor } from '@/lib/utils';

interface Doctor {
  id: string;
  fullName: string;
  specialization?: string | null;
  qualification?: string | null;
  experience?: number | null;
  consultationFee?: number | null;
  registrationNumber?: string | null;
  bio?: string | null;
  isActive: boolean;
  averageRating?: number | null;
  reviewCount?: number | null;
  languages?: string[];
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  _count?: { appointments?: number };
}

interface DoctorStats {
  totalDoctors: number; activeDoctors: number; inactiveDoctors: number;
  pendingVerification: number; onLeave: number; availableToday: number;
  totalAppointments: number; completedAppointments: number; cancelledAppointments: number;
  noShowAppointments: number; averageRating: number; totalPatients: number; todayAppointments: number;
}

function initials(name: string): string {
  const parts = name.replace(/^Dr\.?\s*/i, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name.slice(0, 2).toUpperCase();
}

function StatCard({ label, value, icon, accent }: { label: string; value: ReactNode; icon: ReactNode; accent: string }) {
  return (
    <div className="group card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={cn('grid h-10 w-10 place-items-center rounded-xl', accent)}>{icon}</div>
      <p className="mt-3 text-xl font-bold tracking-tight text-gray-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={cn('badge', active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600')}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function Rating({ value }: { value?: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-gray-700">
      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
      {(value ?? 0).toFixed(1)}
    </span>
  );
}

// ─── Doctors Hub ──────────────────────────────────────────────────────────────

export function CrmDoctorsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Doctor | null>(null);

  const statsQuery = useQuery({ queryKey: ['crm-doctor-stats'], queryFn: () => api.get<DoctorStats>('/doctors/stats') });
  const listQuery = useQuery({ queryKey: ['crm-doctors'], queryFn: () => api.get('/doctors?limit=100') });
  const deptQuery = useQuery({ queryKey: ['crm-departments-opts'], queryFn: () => api.get('/crm/departments') });

  const doctors = (listQuery.data?.data as Doctor[] | undefined) ?? [];
  const departments = (deptQuery.data?.data as { id: string; name: string }[] | undefined) ?? [];
  const s = statsQuery.data?.data;

  const deptOptions = departments.map((d) => ({ value: d.id, label: d.name }));

  const filtered = useMemo(() => doctors.filter((d) => {
    if (search && !d.fullName.toLowerCase().includes(search.toLowerCase())) return false;
    if (specialization && !(d.specialization || '').toLowerCase().includes(specialization.toLowerCase())) return false;
    if (departmentId && d.departmentId !== departmentId) return false;
    if (status === 'active' && !d.isActive) return false;
    if (status === 'inactive' && d.isActive) return false;
    return true;
  }), [doctors, search, specialization, departmentId, status]);

  const toggleActive = async (d: Doctor) => {
    await api.patch(`/doctors/${d.id}`, { isActive: !d.isActive });
    listQuery.refetch();
    statsQuery.refetch();
  };

  const statCards = s ? [
    { label: 'Total Doctors', value: s.totalDoctors, icon: <Stethoscope className="h-5 w-5" />, accent: 'bg-blue-50 text-blue-600' },
    { label: 'Active', value: s.activeDoctors, icon: <UserCheck className="h-5 w-5" />, accent: 'bg-green-50 text-green-600' },
    { label: 'Inactive', value: s.inactiveDoctors, icon: <UserX className="h-5 w-5" />, accent: 'bg-gray-100 text-gray-600' },
    { label: 'Pending Verification', value: s.pendingVerification, icon: <ShieldAlert className="h-5 w-5" />, accent: 'bg-amber-50 text-amber-600' },
    { label: 'Available Today', value: s.availableToday, icon: <CalendarCheck className="h-5 w-5" />, accent: 'bg-emerald-50 text-emerald-600' },
    { label: 'On Leave', value: s.onLeave, icon: <CalendarClock className="h-5 w-5" />, accent: 'bg-orange-50 text-orange-600' },
    { label: "Today's Appointments", value: s.todayAppointments, icon: <Calendar className="h-5 w-5" />, accent: 'bg-indigo-50 text-indigo-600' },
    { label: 'Total Appointments', value: s.totalAppointments, icon: <ClipboardList className="h-5 w-5" />, accent: 'bg-cyan-50 text-cyan-600' },
    { label: 'Completed', value: s.completedAppointments, icon: <CheckCircle className="h-5 w-5" />, accent: 'bg-emerald-50 text-emerald-600' },
    { label: 'Cancelled', value: s.cancelledAppointments, icon: <XCircle className="h-5 w-5" />, accent: 'bg-red-50 text-red-600' },
    { label: 'No-Show', value: s.noShowAppointments, icon: <AlertTriangle className="h-5 w-5" />, accent: 'bg-rose-50 text-rose-600' },
    { label: 'Average Rating', value: `${s.averageRating.toFixed(1)}★`, icon: <Star className="h-5 w-5" />, accent: 'bg-yellow-50 text-yellow-600' },
    { label: 'Total Patients', value: s.totalPatients, icon: <Users className="h-5 w-5" />, accent: 'bg-purple-50 text-purple-600' },
  ] : [];

  const addFields: EditField[] = [
    { name: 'fullName', label: 'Doctor Name', required: true },
    { name: 'email', label: 'Login Email', type: 'email', required: true },
    { name: 'password', label: 'Password', type: 'password', required: true, placeholder: 'Min 8 characters' },
    { name: 'specialization', label: 'Specialization' },
    { name: 'qualification', label: 'Qualification' },
    { name: 'experience', label: 'Experience (years)', type: 'number' },
    { name: 'registrationNumber', label: 'Medical Registration Number' },
    { name: 'departmentId', label: 'Department', type: 'select', options: deptOptions },
    { name: 'consultationFee', label: 'Consultation Fee', type: 'number' },
    { name: 'bio', label: 'About Doctor', type: 'textarea' },
  ];

  const editFields: EditField[] = [
    { name: 'fullName', label: 'Doctor Name', required: true },
    { name: 'specialization', label: 'Specialization' },
    { name: 'qualification', label: 'Qualification' },
    { name: 'experience', label: 'Experience (years)', type: 'number' },
    { name: 'registrationNumber', label: 'Medical Registration Number' },
    { name: 'departmentId', label: 'Department', type: 'select', options: deptOptions },
    { name: 'consultationFee', label: 'Consultation Fee', type: 'number' },
    { name: 'bio', label: 'About Doctor', type: 'textarea' },
  ];

  return (
    <DashboardLayout portal="crm">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctors</h1>
          <p className="mt-1 text-sm text-gray-500">Manage doctors, availability, performance and more</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Add Doctor</button>
      </div>

      {/* Dashboard stats */}
      {statsQuery.isLoading ? <LoadingState /> : (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {statCards.map((c) => <StatCard key={c.label} {...c} />)}
        </div>
      )}

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className="input" placeholder="Search by name..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <input className="input" placeholder="Specialization..." value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
          <select className="input" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {listQuery.isLoading ? <LoadingState /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Doctor</th>
                  <th className="px-4 py-3 font-medium">Specialization</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Experience</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Rating</th>
                  <th className="px-4 py-3 font-medium">Appointments</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500">No doctors found</td></tr>
                ) : filtered.map((d) => (
                  <tr key={d.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-xs font-bold text-white">{initials(d.fullName)}</span>
                        <div>
                          <p className="font-medium text-gray-900">{d.fullName}</p>
                          <p className="text-xs text-gray-500">{d.qualification || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{d.specialization || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{d.department?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{d.experience != null ? `${d.experience} yrs` : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge active={d.isActive} /></td>
                    <td className="px-4 py-3"><Rating value={d.averageRating} /></td>
                    <td className="px-4 py-3 text-gray-700">{d._count?.appointments ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <button className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline" onClick={() => navigate(`/crm/doctors/${d.id}`)}><Eye className="h-3.5 w-3.5" /> View</button>
                        <button className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:underline" onClick={() => setEditing(d)}><Pencil className="h-3.5 w-3.5" /> Edit</button>
                        <button className={cn('inline-flex items-center gap-1 text-xs font-medium hover:underline', d.isActive ? 'text-red-600' : 'text-green-600')} onClick={() => toggleActive(d)}>
                          <Power className="h-3.5 w-3.5" /> {d.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <EditModal
          title="Add Doctor"
          fields={addFields}
          submitLabel="Create Doctor"
          onClose={() => setCreating(false)}
          onSave={async (values) => {
            const payload: Record<string, unknown> = {
              email: values.email, password: values.password, fullName: values.fullName,
              specialization: values.specialization || undefined,
              qualification: values.qualification || undefined,
              registrationNumber: values.registrationNumber || undefined,
              bio: values.bio || undefined,
              experience: values.experience == null ? undefined : Number(values.experience),
              consultationFee: values.consultationFee == null ? 0 : Number(values.consultationFee),
            };
            if (values.departmentId) payload.departmentId = values.departmentId;
            const res = await api.post('/doctors', payload);
            if (!res.success) throw new Error(res.error || 'Create failed');
            setCreating(false);
            listQuery.refetch();
            statsQuery.refetch();
          }}
        />
      )}

      {editing && (
        <EditModal
          title="Edit Doctor"
          fields={editFields}
          initial={editing as unknown as Record<string, unknown>}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            const payload: Record<string, unknown> = {
              fullName: values.fullName,
              specialization: values.specialization || null,
              qualification: values.qualification || null,
              registrationNumber: values.registrationNumber || null,
              bio: values.bio || null,
              experience: values.experience == null || values.experience === '' ? null : Number(values.experience),
              consultationFee: values.consultationFee == null || values.consultationFee === '' ? 0 : Number(values.consultationFee),
              departmentId: values.departmentId || null,
            };
            const res = await api.patch(`/doctors/${editing.id}`, payload);
            if (!res.success) throw new Error(res.error || 'Update failed');
            setEditing(null);
            listQuery.refetch();
          }}
        />
      )}
    </DashboardLayout>
  );
}

// ─── Doctor Profile ─────────────────────────────────────────────────────────

type ProfileTab = 'overview' | 'appointments' | 'patients' | 'reviews';

interface ProfileData {
  doctor: Doctor & {
    organization?: { name: string; city?: string } | null;
    user?: { email: string; phone?: string | null; isActive: boolean } | null;
  };
  stats: {
    totalAppointments: number; completedAppointments: number; cancelledAppointments: number;
    noShowAppointments: number; reviews: number; patients: number; averageRating: number;
  };
  recentAppointments: { id: string; appointmentDate: string; startTime: string; status: string; patient?: { fullName: string } }[];
  reviews: { id: string; rating: number; comment?: string | null; createdAt: string; patient?: { fullName: string } }[];
  patients: { id: string; fullName: string; visits: number; lastVisit: string }[];
}

export function CrmDoctorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<ProfileTab>('overview');
  const { data, isLoading } = useQuery({ queryKey: ['crm-doctor-profile', id], queryFn: () => api.get<ProfileData>(`/doctors/${id}/profile`) });

  const profile = data?.data;
  const d = profile?.doctor;

  const tabs: { key: ProfileTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'appointments', label: 'Appointments' },
    { key: 'patients', label: 'Patients' },
    { key: 'reviews', label: 'Reviews' },
  ];

  return (
    <DashboardLayout portal="crm">
      <Link to="/crm/doctors" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary-600">
        <ArrowLeft className="h-4 w-4" /> Back to Doctors
      </Link>

      {isLoading || !profile || !d ? <LoadingState /> : (
        <>
          {/* Header */}
          <div className="card mb-6 overflow-hidden">
            <div className="h-20 bg-gradient-to-r from-primary-600 to-primary-800" />
            <div className="px-6 pb-6">
              <div className="-mt-8 flex flex-wrap items-end gap-4">
                <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-4 border-white bg-gradient-to-br from-primary-400 to-primary-600 text-2xl font-bold text-white shadow">
                  {initials(d.fullName)}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-xl font-bold text-gray-900">{d.fullName}</h1>
                    <StatusBadge active={d.isActive} />
                  </div>
                  <p className="text-sm text-primary-600">{d.specialization || 'General'}{d.department?.name ? ` · ${d.department.name}` : ''}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1"><Rating value={d.averageRating} /> ({d.reviewCount ?? 0})</span>
                    {d.user?.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {d.user.email}</span>}
                    {d.user?.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {d.user.phone}</span>}
                    {d.organization?.name && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {d.organization.name}</span>}
                    <span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> {formatCurrency(d.consultationFee ?? 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stat row */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Appointments" value={profile.stats.totalAppointments} icon={<ClipboardList className="h-5 w-5" />} accent="bg-cyan-50 text-cyan-600" />
            <StatCard label="Completed" value={profile.stats.completedAppointments} icon={<CheckCircle className="h-5 w-5" />} accent="bg-emerald-50 text-emerald-600" />
            <StatCard label="Cancelled" value={profile.stats.cancelledAppointments} icon={<XCircle className="h-5 w-5" />} accent="bg-red-50 text-red-600" />
            <StatCard label="No-Show" value={profile.stats.noShowAppointments} icon={<AlertTriangle className="h-5 w-5" />} accent="bg-rose-50 text-rose-600" />
            <StatCard label="Patients" value={profile.stats.patients} icon={<Users className="h-5 w-5" />} accent="bg-purple-50 text-purple-600" />
            <StatCard label="Reviews" value={profile.stats.reviews} icon={<Star className="h-5 w-5" />} accent="bg-yellow-50 text-yellow-600" />
          </div>

          {/* Tabs */}
          <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={cn('relative px-4 py-2 text-sm font-medium transition-colors',
                  tab === t.key ? 'text-primary-600' : 'text-gray-500 hover:text-gray-800')}>
                {t.label}
                {tab === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary-600" />}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="card p-6 lg:col-span-2">
                <h2 className="mb-4 font-semibold text-gray-900">Professional Information</h2>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-sm">
                  {[
                    ['Specialization', d.specialization || '—'],
                    ['Qualification', d.qualification || '—'],
                    ['Experience', d.experience != null ? `${d.experience} years` : '—'],
                    ['Registration No.', d.registrationNumber || '—'],
                    ['Department', d.department?.name || '—'],
                    ['Branch', d.branch?.name || '—'],
                    ['Consultation Fee', formatCurrency(d.consultationFee ?? 0)],
                    ['Languages', (d.languages && d.languages.length) ? d.languages.join(', ') : '—'],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <dt className="text-xs uppercase tracking-wide text-gray-400">{k}</dt>
                      <dd className="mt-0.5 font-medium text-gray-800">{v}</dd>
                    </div>
                  ))}
                </dl>
                {d.bio && (
                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-wide text-gray-400">About</p>
                    <p className="mt-1 text-sm text-gray-700">{d.bio}</p>
                  </div>
                )}
              </div>
              <div className="card p-6">
                <h2 className="mb-3 font-semibold text-gray-900">More modules</h2>
                <p className="text-sm text-gray-500">Schedule, Leave, Payments & Settlements, Documents, Performance analytics and Activity logs are planned as follow-up modules for this doctor.</p>
              </div>
            </div>
          )}

          {tab === 'appointments' && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Time</th><th className="px-4 py-3 font-medium">Patient</th><th className="px-4 py-3 font-medium">Status</th></tr>
                </thead>
                <tbody>
                  {profile.recentAppointments.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-500">No appointments yet</td></tr>
                  ) : profile.recentAppointments.map((a) => (
                    <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDate(a.appointmentDate)}</td>
                      <td className="px-4 py-3">{a.startTime}</td>
                      <td className="px-4 py-3">{a.patient?.fullName || '—'}</td>
                      <td className="px-4 py-3"><span className={`badge ${getStatusColor(a.status)}`}>{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'patients' && (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr><th className="px-4 py-3 font-medium">Patient</th><th className="px-4 py-3 font-medium">Visits</th><th className="px-4 py-3 font-medium">Last Visit</th></tr>
                </thead>
                <tbody>
                  {profile.patients.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-500">No connected patients yet</td></tr>
                  ) : profile.patients.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.fullName}</td>
                      <td className="px-4 py-3">{p.visits}</td>
                      <td className="px-4 py-3">{formatDate(p.lastVisit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'reviews' && (
            <div className="space-y-3">
              {profile.reviews.length === 0 ? (
                <div className="card p-10 text-center text-gray-500">No reviews yet</div>
              ) : profile.reviews.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{r.patient?.fullName || 'Anonymous'}</span>
                    <Rating value={r.rating} />
                  </div>
                  {r.comment && <p className="mt-1.5 text-sm text-gray-600">{r.comment}</p>}
                  <p className="mt-1 text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
