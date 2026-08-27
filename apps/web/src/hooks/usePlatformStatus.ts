import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface MaintenanceInfo {
  status: 'none' | 'upcoming' | 'active';
  title?: string;
  message?: string;
  maintenanceType?: string;
  startAt?: string;
  endAt?: string;
  hoursUntilStart?: number;
  hoursRemaining?: number;
  scheduledId?: string;
}

export interface PlatformStatus {
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  maintenanceType?: string;
  maintenance?: MaintenanceInfo;
  platformName?: string;
  systemStatus?: string;
  emergencyAnnouncement?: string | null;
  emergencyAnnouncements?: { title: string; message: string; severity: string }[];
}

async function fetchPlatformStatus(): Promise<PlatformStatus> {
  const res = await api.get<PlatformStatus>('/public/platform-status');
  if (!res.success || !res.data) {
    throw new Error(res.error || 'Failed to load platform status');
  }

  // Backward-compatible fallback for deployments missing maintenance on platform-status
  if (!res.data.maintenance || res.data.maintenance.status === 'none') {
    const maintenanceRes = await api.get<MaintenanceInfo>('/public/maintenance-status');
    if (maintenanceRes.success && maintenanceRes.data?.status && maintenanceRes.data.status !== 'none') {
      return { ...res.data, maintenance: maintenanceRes.data };
    }
  }

  return res.data;
}

export function usePlatformStatus() {
  return useQuery({
    queryKey: ['platform-status'],
    queryFn: fetchPlatformStatus,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
