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

export function usePlatformStatus() {
  return useQuery({
    queryKey: ['platform-status'],
    queryFn: () => api.get<PlatformStatus>('/public/platform-status'),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
