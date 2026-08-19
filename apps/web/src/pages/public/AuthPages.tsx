import { Navigate } from 'react-router-dom';
import { Stethoscope, Building2, Users, Shield } from 'lucide-react';
import { RoleLoginPage } from '@/components/auth/RoleLoginPage';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiBaseUrl } from '@/lib/api';

const publicLoginLinks = [
  { to: '/login/patient', label: 'Patient' },
  { to: '/login/doctor', label: 'Doctor' },
  { to: '/login/hospital', label: 'Hospital' },
  { to: '/login/staff', label: 'Staff' },
];

export function DoctorLoginPage() {
  return (
    <RoleLoginPage
      config={{
        title: 'Doctor Login',
        subtitle: 'Access your schedule, patients, and prescriptions',
        allowedRoles: ['DOCTOR'],
        portalKey: 'doctor',
        icon: <Stethoscope className="h-10 w-10 text-primary-600" />,
        alternateLinks: publicLoginLinks.filter((l) => l.to !== '/login/doctor'),
      }}
    />
  );
}

export function HospitalLoginPage() {
  return (
    <RoleLoginPage
      config={{
        title: 'Hospital / Clinic Login',
        subtitle: 'Sign in to manage your organization, staff, and operations',
        allowedRoles: ['HOSPITAL_ADMIN', 'BRANCH_ADMIN'],
        portalKey: 'hospital',
        icon: <Building2 className="h-10 w-10 text-primary-600" />,
        registerLink: { to: '/register/hospital', label: 'Register your organization' },
        alternateLinks: publicLoginLinks.filter((l) => l.to !== '/login/hospital'),
      }}
    />
  );
}

export function StaffLoginPage() {
  return (
    <RoleLoginPage
      config={{
        title: 'Staff Login',
        subtitle: 'For receptionists, nurses, accountants, pharmacists, and lab staff',
        allowedRoles: ['RECEPTIONIST', 'NURSE', 'ACCOUNTANT', 'PHARMACIST', 'LAB_STAFF', 'MANAGER'],
        portalKey: 'staff',
        icon: <Users className="h-10 w-10 text-primary-600" />,
        alternateLinks: publicLoginLinks.filter((l) => l.to !== '/login/staff'),
      }}
    />
  );
}

/** Admin login — not linked in public footer; direct URL only */
export function AdminLoginPage() {
  return (
    <RoleLoginPage
      config={{
        title: 'Platform Admin',
        subtitle: 'Authorized platform operators only',
        allowedRoles: ['SUPER_ADMIN', 'PLATFORM_STAFF'],
        portalKey: 'admin',
        icon: <Shield className="h-10 w-10 text-red-600" />,
      }}
    />
  );
}

/** Legacy redirect */
export function LoginPage() {
  return <Navigate to="/login/patient" replace />;
}

export function RegisterPage() {
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', phone: '', dateOfBirth: '', gender: '', city: '', state: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/patient');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <div className="card w-full max-w-lg p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Create Patient Account</h1>
          <p className="text-center text-gray-500 text-sm mb-8">Register to book appointments and manage your health</p>

          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input type="date" className="input" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Select</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login/patient" className="text-primary-600 hover:text-primary-700 font-medium">Patient login</Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}

export function RegisterHospitalPage() {
  const [form, setForm] = useState({
    name: '', type: 'HOSPITAL', email: '', password: '', ownerName: '', phone: '', address: '', city: '', state: '', pinCode: '', description: '',
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/organizations/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!data?.success) throw new Error(data?.error || 'Registration failed');
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="card max-w-md p-8 text-center">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-xl font-bold mb-2">Registration Submitted!</h2>
            <p className="text-gray-500 mb-6">Your organization registration is pending verification. We'll notify you once approved.</p>
            <Link to="/login/hospital" className="btn-primary">Go to Hospital Login</Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-2">Register Your Organization</h1>
          <p className="text-gray-500 text-sm mb-8">Join our healthcare network and start managing your practice</p>

          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Organization Name</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="HOSPITAL">Hospital</option>
                  <option value="CLINIC">Clinic</option>
                  <option value="DIAGNOSTIC_CENTER">Diagnostic Center</option>
                  <option value="PHARMACY">Pharmacy</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Owner Name</label>
                <input className="input" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Address</label>
                <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">City</label>
                <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State</label>
                <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit Registration'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already registered?{' '}
            <Link to="/login/hospital" className="text-primary-600 hover:text-primary-700 font-medium">Hospital login</Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  );
}
