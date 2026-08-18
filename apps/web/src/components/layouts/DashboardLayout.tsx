import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Calendar, Stethoscope, Receipt, Settings, LogOut, Heart, Menu,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { adminNavGroups } from '@/config/adminNav';

const crmNav = [
  { to: '/crm', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/crm/patients', icon: Users, label: 'Patients' },
  { to: '/crm/doctors', icon: Stethoscope, label: 'Doctors' },
  { to: '/crm/appointments', icon: Calendar, label: 'Appointments' },
  { to: '/crm/billing', icon: Receipt, label: 'Billing' },
  { to: '/crm/settings', icon: Settings, label: 'Settings' },
];

const patientNav = [
  { to: '/patient', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/patient/appointments', icon: Calendar, label: 'Appointments' },
  { to: '/find/doctors', icon: Stethoscope, label: 'Find Doctor' },
  { to: '/find/hospitals', icon: Heart, label: 'Find Hospital' },
];

interface DashboardLayoutProps {
  children: React.ReactNode;
  portal: 'crm' | 'admin' | 'patient';
}

export function DashboardLayout({ children, portal }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const title = portal === 'crm' ? 'Hospital CRM' : portal === 'admin' ? 'Super Admin' : 'Patient Portal';

  const isActive = (path: string) =>
    path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform lg:translate-x-0 flex flex-col',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6 shrink-0">
          <Heart className="h-6 w-6 fill-primary-600 text-primary-600" />
          <span className="font-bold text-primary-700">{title}</span>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {portal === 'admin' ? (
            adminNavGroups.map((group) => (
              <div key={group.title}>
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{group.title}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
                      className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive(item.to) ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          ) : (
            (portal === 'crm' ? crmNav : patientNav).map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}
                className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  location.pathname === item.to ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))
          )}
        </nav>

        <div className="border-t border-gray-200 p-4 shrink-0">
          <div className="text-sm text-gray-500 mb-2 truncate">{user?.email}</div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-4 lg:px-8">
          <button className="lg:hidden p-2" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <Link to="/" className="text-sm text-gray-500 hover:text-primary-600 ml-auto">Back to Website</Link>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
