export interface SessionInfo {
  accessExpiresAt: string;
  refreshExpiresAt: string;
  accessLifetimeMinutes: number;
  sessionLifetimeDays: number;
  message: string;
  loggedInAt?: string;
}

const SESSION_KEY = 'sessionInfo';

export function saveSessionInfo(session: SessionInfo) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSessionInfo(): SessionInfo | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionInfo;
  } catch {
    return null;
  }
}

export function clearSessionInfo() {
  localStorage.removeItem(SESSION_KEY);
}

export function decodeJwtExpiry(token: string | null): Date | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload?.exp) return null;
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

export function formatRemainingTime(target: Date | string): string {
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatSessionSummary(session: SessionInfo | null): string {
  if (!session) return 'Session active';
  const remaining = formatRemainingTime(session.refreshExpiresAt);
  return `Session expires in ${remaining}`;
}
