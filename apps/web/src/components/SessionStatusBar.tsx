import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { api } from '@/lib/api';
import {
  decodeJwtExpiry,
  formatRemainingTime,
  formatSessionSummary,
  getSessionInfo,
  saveSessionInfo,
  type SessionInfo,
} from '@/lib/session';
import { cn } from '@/lib/utils';

export function SessionStatusBar({ portal }: { portal: 'admin' | 'crm' | 'patient' }) {
  const [session, setSession] = useState<SessionInfo | null>(() => getSessionInfo());
  const [accessRemaining, setAccessRemaining] = useState('');

  const { data } = useQuery({
    queryKey: ['auth-session'],
    queryFn: () => api.get<SessionInfo>('/auth/session'),
    refetchInterval: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (data?.success && data.data) {
      saveSessionInfo(data.data);
      setSession(data.data);
    }
  }, [data]);

  useEffect(() => {
    const tick = () => {
      const current = getSessionInfo();
      setSession(current);
      const token = localStorage.getItem('accessToken');
      const accessDate = current?.accessExpiresAt
        ? new Date(current.accessExpiresAt)
        : decodeJwtExpiry(token);
      setAccessRemaining(accessDate ? formatRemainingTime(accessDate) : '');
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!session) return null;

  const accent = portal === 'admin'
    ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
    : portal === 'crm'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-blue-200 bg-blue-50 text-blue-900';

  return (
    <div className={cn('mb-6 flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between', accent)}>
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">{formatSessionSummary(session)}</p>
          <p className="mt-0.5 text-xs opacity-80">
            Login stays active for {session.sessionLifetimeDays} day{session.sessionLifetimeDays === 1 ? '' : 's'}.
            Access auto-refreshes every {session.accessLifetimeMinutes} minute{session.accessLifetimeMinutes === 1 ? '' : 's'} while you are active.
          </p>
        </div>
      </div>
      {accessRemaining && (
        <p className="text-xs font-medium opacity-80 sm:text-right">
          Next access refresh in {accessRemaining}
        </p>
      )}
    </div>
  );
}
