import { Link, useLocation } from 'react-router-dom';
import { Heart, Menu, X, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getPortalPath } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type PlatformStatus = {
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  emergencyAnnouncement?: string | null;
  emergencyAnnouncements?: { title: string; message: string; severity: string }[];
  platformName?: string;
  systemStatus?: string;
};

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  const { data: statusRes } = useQuery({
    queryKey: ['platform-status'],
    queryFn: () => api.get<PlatformStatus>('/public/platform-status'),
    staleTime: 60000,
  });
  const status = statusRes?.data;
  const platformName = status?.platformName || 'HealthCare';

  const navLinks = [
    { to: '/find/hospitals', label: 'Hospitals' },
    { to: '/find/clinics', label: 'Clinics' },
    { to: '/find/doctors', label: 'Doctors' },
    { to: '/register/hospital', label: 'For Providers' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {(status?.emergencyAnnouncements?.length ? status.emergencyAnnouncements : status?.emergencyAnnouncement ? [{ title: 'Notice', message: status.emergencyAnnouncement, severity: 'WARNING' }] : []).map((a, i) => (
        <div key={i} className={cn('text-white text-sm text-center py-2 px-4',
          a.severity === 'CRITICAL' ? 'bg-red-600' : a.severity === 'INFO' ? 'bg-blue-600' : 'bg-amber-500')}>
          {a.title ? <strong>{a.title}: </strong> : '⚠️ '}{a.message}
        </div>
      ))}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2 text-primary-700">
            <Heart className="h-7 w-7 fill-primary-600 text-primary-600" />
            <span className="text-lg font-bold">{platformName}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-sm font-medium transition-colors hover:text-primary-600 ${
                  location.pathname.startsWith(link.to) ? 'text-primary-600' : 'text-gray-600'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link to={getPortalPath(user!.role)} className="btn-ghost text-sm">
                  Dashboard
                </Link>
                <button onClick={logout} className="btn-secondary text-sm">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login/patient" className="btn-ghost text-sm">
                  Patient Login
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  Register
                </Link>
              </>
            )}
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="block text-sm font-medium text-gray-600" onClick={() => setMobileOpen(false)}>
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-gray-100 flex gap-3">
              {isAuthenticated ? (
                <>
                  <Link to={getPortalPath(user!.role)} className="btn-primary flex-1 text-sm">Dashboard</Link>
                  <button onClick={logout} className="btn-secondary flex-1 text-sm">Logout</button>
                </>
              ) : (
                <>
                  <Link to="/login/patient" className="btn-secondary flex-1 text-sm">Patient Login</Link>
                  <Link to="/register" className="btn-primary flex-1 text-sm">Register</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {status?.maintenanceMode ? (
          <div className="mx-auto max-w-lg px-4 py-24 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Scheduled Maintenance</h1>
            <p className="text-gray-600">
              {status.maintenanceMessage || 'We are currently performing scheduled maintenance.'}
            </p>
          </div>
        ) : (
          children
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 text-primary-700 mb-4">
                <Heart className="h-6 w-6 fill-primary-600 text-primary-600" />
                <span className="font-bold">HealthCare</span>
              </div>
              <p className="text-sm text-gray-500">
                Connecting patients with trusted healthcare providers across India.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Find Care</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/find/hospitals" className="hover:text-primary-600">Hospitals</Link></li>
                <li><Link to="/find/clinics" className="hover:text-primary-600">Clinics</Link></li>
                <li><Link to="/find/doctors" className="hover:text-primary-600">Doctors</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">For Providers</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/register/hospital" className="hover:text-primary-600">Register Hospital</Link></li>
                <li><Link to="/login/hospital" className="hover:text-primary-600">Hospital Login</Link></li>
                <li><Link to="/login/doctor" className="hover:text-primary-600">Doctor Login</Link></li>
                <li><Link to="/login/staff" className="hover:text-primary-600">Staff Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">For Patients</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/login/patient" className="hover:text-primary-600">Patient Login</Link></li>
                <li><Link to="/register" className="hover:text-primary-600">Create Account</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-primary-600">Help Center</a></li>
                <li><a href="#" className="hover:text-primary-600">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-100 pt-8 text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} HealthCare Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
