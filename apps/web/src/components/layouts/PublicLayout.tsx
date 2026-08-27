import { Link, useLocation } from 'react-router-dom';
import { Heart, Menu, X, Wrench, Clock } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getPortalPath } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { usePlatformStatus } from '@/hooks/usePlatformStatus';
import { MaintenanceHomeModal } from '@/components/MaintenanceNotice';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  const { data: status } = usePlatformStatus();
  const platformName = status?.platformName || 'HealthCare';
  const maintenance = status?.maintenance;

  const navLinks = [
    { to: '/find/hospitals', label: 'Hospitals' },
    { to: '/find/clinics', label: 'Clinics' },
    { to: '/find/doctors', label: 'Doctors' },
    { to: '/register/hospital', label: 'For Providers' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <MaintenanceHomeModal maintenance={maintenance} />

      {maintenance?.status === 'upcoming' && !status?.maintenanceMode && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm text-center py-2.5 px-4">
          <span className="font-semibold">Scheduled Maintenance:</span>{' '}
          {maintenance.title} — {maintenance.hoursUntilStart != null && maintenance.hoursUntilStart < 24
            ? `starts in ~${maintenance.hoursUntilStart} hours`
            : `from ${new Date(maintenance.startAt!).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`}
        </div>
      )}

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
          <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 py-24">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(251,191,36,0.15),transparent_50%)]" />
            <div className="relative max-w-lg text-center text-white">
              <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-2xl bg-white/10 backdrop-blur">
                <Wrench className="h-10 w-10 text-amber-300" />
              </div>
              <h1 className="text-3xl font-bold">We&apos;ll Be Back Shortly</h1>
              <p className="mt-4 text-slate-300 leading-relaxed">
                {status.maintenanceMessage || 'We are currently performing scheduled maintenance to improve your experience.'}
              </p>
              {maintenance?.endAt && (
                <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-amber-200">
                  <Clock className="h-4 w-4" />
                  Expected back by {new Date(maintenance.endAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
            </div>
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
              <h4 className="font-semibold text-sm mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/terms" className="hover:text-primary-600">Terms & Conditions</Link></li>
                <li><Link to="/privacy" className="hover:text-primary-600">Privacy Policy</Link></li>
                <li><Link to="/refund" className="hover:text-primary-600">Refunds & Cancellations</Link></li>
                <li><Link to="/contact" className="hover:text-primary-600">Contact Us</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-3">Support</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link to="/contact" className="hover:text-primary-600">Help & Support</Link></li>
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
