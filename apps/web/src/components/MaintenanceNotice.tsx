import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, X, Clock, Calendar, AlertTriangle, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MaintenanceInfo } from '@/hooks/usePlatformStatus';

function formatWindow(start?: string, end?: string) {
  if (!start || !end) return '';
  const opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
  const s = new Date(start).toLocaleString('en-IN', opts);
  const e = new Date(end).toLocaleString('en-IN', opts);
  return `${s} → ${e}`;
}

function countdownLabel(info: MaintenanceInfo) {
  if (info.status === 'active' && info.hoursRemaining != null) {
    if (info.hoursRemaining <= 1) return 'Ending within 1 hour';
    return `~${info.hoursRemaining} hours remaining`;
  }
  if (info.status === 'upcoming' && info.hoursUntilStart != null) {
    if (info.hoursUntilStart <= 1) return 'Starting within 1 hour';
    if (info.hoursUntilStart < 24) return `Starts in ~${info.hoursUntilStart} hours`;
    const days = Math.ceil(info.hoursUntilStart / 24);
    return `Starts in ~${days} day${days > 1 ? 's' : ''}`;
  }
  return null;
}

/** Sticky banner for Admin / CRM / Patient dashboards */
export function MaintenanceDashboardBanner({ maintenance, className }: { maintenance?: MaintenanceInfo; className?: string }) {
  if (!maintenance || maintenance.status === 'none') return null;

  const isActive = maintenance.status === 'active';
  const countdown = countdownLabel(maintenance);

  return (
    <div className={cn(
      'mb-6 overflow-hidden rounded-2xl border shadow-sm',
      isActive ? 'border-slate-300 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 text-white' : 'border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 text-amber-950',
      className,
    )}>
      <div className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
        <div className={cn(
          'grid h-12 w-12 shrink-0 place-items-center rounded-xl',
          isActive ? 'bg-white/10' : 'bg-amber-100',
        )}>
          {isActive ? <Wrench className="h-6 w-6 text-amber-300" /> : <Calendar className="h-6 w-6 text-amber-700" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold uppercase tracking-wide">
              {isActive ? 'Maintenance In Progress' : 'Scheduled Maintenance'}
            </p>
            {countdown && (
              <span className={cn(
                'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                isActive ? 'bg-white/15 text-amber-200' : 'bg-amber-200/80 text-amber-900',
              )}>
                {countdown}
              </span>
            )}
          </div>
          <p className="mt-1 text-base font-semibold">{maintenance.title}</p>
          <p className={cn('mt-1 text-sm', isActive ? 'text-slate-200' : 'text-amber-900/80')}>
            {maintenance.message}
          </p>
          <p className={cn('mt-2 flex items-center gap-1.5 text-xs', isActive ? 'text-slate-300' : 'text-amber-800')}>
            <Clock className="h-3.5 w-3.5" />
            {formatWindow(maintenance.startAt, maintenance.endAt)}
            {maintenance.maintenanceType === 'full' && ' · Full platform'}
            {maintenance.maintenanceType === 'partial' && ' · Partial modules'}
          </p>
        </div>
        {!isActive && (
          <Link to="/" className={cn('shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold', 'bg-amber-600 text-white hover:bg-amber-700')}>
            View Details
          </Link>
        )}
      </div>
    </div>
  );
}

/** Professional modal popup on the public homepage */
export function MaintenanceHomeModal({ maintenance }: { maintenance?: MaintenanceInfo }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!maintenance || maintenance.status === 'none') return;
    const key = `maintenance_popup_${maintenance.scheduledId || maintenance.status}`;
    if (sessionStorage.getItem(key)) return;
    setOpen(true);
  }, [maintenance]);

  if (!open || !maintenance || maintenance.status === 'none') return null;

  const isActive = maintenance.status === 'active';
  const countdown = countdownLabel(maintenance);

  const dismiss = () => {
    const key = `maintenance_popup_${maintenance.scheduledId || maintenance.status}`;
    sessionStorage.setItem(key, '1');
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className={cn(
          'relative px-6 py-8 text-white',
          isActive
            ? 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900'
            : 'bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700',
        )}>
          <button type="button" onClick={dismiss} className="absolute right-4 top-4 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur">
              {isActive ? <Wrench className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                {isActive ? 'Service Notice' : 'Advance Notice'}
              </p>
              <h2 className="mt-1 text-2xl font-bold">
                {isActive ? 'Platform Maintenance' : 'Maintenance Scheduled'}
              </h2>
              {countdown && <p className="mt-2 text-sm text-white/80">{countdown}</p>}
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{maintenance.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{maintenance.message}</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="h-4 w-4 text-primary-600 shrink-0" />
              <span>{formatWindow(maintenance.startAt, maintenance.endAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Shield className="h-4 w-4 text-primary-600 shrink-0" />
              <span>
                {maintenance.maintenanceType === 'partial'
                  ? 'Some modules may be temporarily unavailable'
                  : 'The platform may be temporarily unavailable during this window'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button type="button" className="btn-primary flex-1 min-w-[120px]" onClick={dismiss}>
              {isActive ? 'I Understand' : 'Got It'}
            </button>
            {!isActive && (
              <Link to="/contact" className="btn-secondary flex-1 min-w-[120px] text-center" onClick={dismiss}>
                Contact Support
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
