import { UserRole } from '@healthcare/shared';
import { api } from '@/lib/api';

const PORTAL_BY_ROLE: Partial<Record<UserRole, string>> = {
  SUPER_ADMIN: '/admin',
  PLATFORM_STAFF: '/admin',
  HOSPITAL_ADMIN: '/crm',
  BRANCH_ADMIN: '/crm',
  DOCTOR: '/crm',
  RECEPTIONIST: '/crm',
  NURSE: '/crm',
  ACCOUNTANT: '/crm',
  PHARMACIST: '/crm',
  LAB_STAFF: '/crm',
  MANAGER: '/crm',
  PATIENT: '/patient',
};

export async function impersonateOrganization(orgId: string) {
  const res = await api.post<{ accessToken: string; refreshToken: string; redirectTo: string }>(
    `/admin/organizations/${orgId}/impersonate`,
  );
  if (!res.success || !res.data) throw new Error(res.error || 'Impersonation failed');
  api.setTokens(res.data.accessToken, res.data.refreshToken);
  window.location.href = res.data.redirectTo;
}

export async function impersonateUser(userId: string) {
  const res = await api.post<{ accessToken: string; refreshToken: string; redirectTo: string; user: { role: UserRole } }>(
    `/admin/users/${userId}/impersonate`,
  );
  if (!res.success || !res.data) throw new Error(res.error || 'Impersonation failed');
  api.setTokens(res.data.accessToken, res.data.refreshToken);
  window.location.href = res.data.redirectTo || PORTAL_BY_ROLE[res.data.user.role] || '/';
}

export function confirmAction(message: string) {
  return window.confirm(message);
}
