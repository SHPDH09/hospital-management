import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Stethoscope, LogOut, Heart, Menu, X, ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { adminNavGroups } from '@/config/adminNav';
import { crmNavGroups } from '@/config/crmNav';

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

function initials(value: string): string {
  const base = value.split('@')[0];
  const parts = base.split(/[.\s_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || base.slice(0, 2).toUpperCase();
}

function prettyRole(role?: string): string {
  if (!role) return '';
  return role.toLowerCase().split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function DashboardLayout({ children, portal }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const title = portal === 'crm' ? 'Hospital CRM' : portal === 'admin' ? 'Super Admin' : 'Patient Portal';
  const groups = portal === 'admin' ? adminNavGroups : portal === 'crm' ? crmNavGroups : null;
  const displayName =
    user?.staff?.fullName || user?.doctor?.fullName || user?.patient?.fullName || user?.email?.split('@')[0] || 'User';

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    if (path === '/crm') return location.pathname === '/crm';
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const navLinkClass = (active: boolean) =>
    cn(
      'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
      active
        ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md shadow-primary-900/30'
        : 'text-slate-300 hover:bg-white/5 hover:text-white',
    );

  const renderIcon = (Icon: typeof LayoutDashboard, active: boolean) => (
    <Icon className={cn('h-[18px] w-[18px] shrink-0 transition-colors', active ? 'text-white' : 'text-slate-400 group-hover:text-white')} />
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-900 text-slate-300 shadow-xl transition-transform duration-200 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        {/* Brand */}
        <div className="flex h-16 items-center justify-between gap-3 border-b border-white/10 px-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg shadow-primary-900/40">
              <Heart className="h-5 w-5 fill-white text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="text-[11px] text-slate-400">Healthcare Platform</p>
            </div>
          </div>
          <button className="p-1 text-slate-400 hover:text-white lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups ? (
            groups.map((group) => (
              <div key={group.title}>
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{group.title}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.to);
                    return (
                      <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)} className={navLinkClass(active)}>
                        {renderIcon(item.icon, active)}
                        <span className="truncate">{item.label}</span>
                        {active && <ChevronRight className="ml-auto h-4 w-4 text-white/80" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-0.5">
              {patientNav.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <Link key={item.to} to={item.to} onClick={() => setSidebarOpen(false)} className={navLinkClass(active)}>
                    {renderIcon(item.icon, active)}
                    <span className="truncate">{item.label}</span>
                    {active && <ChevronRight className="ml-auto h-4 w-4 text-white/80" />}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        {/* User card */}
        <div className="border-t border-white/10 p-3 shrink-0">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-xs font-bold text-white">
              {initials(displayName)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              <p className="truncate text-[11px] text-slate-400">{prettyRole(user?.role) || user?.email}</p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white/80 px-4 backdrop-blur-md lg:px-8">
          <button className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-primary-200 hover:text-primary-600"
          >
            Back to Website
          </Link>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
