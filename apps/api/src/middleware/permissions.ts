import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { sendError } from '../lib/response';
import { AuthRequest } from './auth';
import {
  mergePermissions,
  hasPermission,
  StaffPermissions,
  PermissionAction,
  OrganizationScopeType,
  fullPermissions,
} from '../lib/permissions';

export type ResolvedAccess = {
  isSuperAdmin: boolean;
  staffProfileId?: string;
  permissions: StaffPermissions;
  organizationScope: OrganizationScopeType;
  assignedOrgIds: string[];
  assignedLocations: string[];
  fieldPermissions?: Record<string, Record<string, string>>;
};

const accessCache = new Map<string, { access: ResolvedAccess; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function resolveUserAccess(userId: string, userRole: string): Promise<ResolvedAccess> {
  const cacheKey = `${userId}:${userRole}`;
  const cached = accessCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.access;

  if (userRole === 'SUPER_ADMIN') {
    const access: ResolvedAccess = {
      isSuperAdmin: true,
      permissions: fullPermissions(),
      organizationScope: 'ALL_ORGANIZATIONS',
      assignedOrgIds: [],
      assignedLocations: [],
    };
    accessCache.set(cacheKey, { access, expiresAt: Date.now() + CACHE_TTL_MS });
    return access;
  }

  const profile = await prisma.platformStaffProfile.findUnique({
    where: { userId },
    include: {
      platformRole: true,
      assignments: { select: { organizationId: true, locationName: true, stateName: true } },
      tempPermissions: { where: { isActive: true, expiresAt: { gt: new Date() } } },
    },
  });

  if (!profile) {
    const access: ResolvedAccess = {
      isSuperAdmin: false,
      permissions: mergePermissions(),
      organizationScope: 'OWN_RECORDS',
      assignedOrgIds: [],
      assignedLocations: [],
    };
    accessCache.set(cacheKey, { access, expiresAt: Date.now() + CACHE_TTL_MS });
    return access;
  }

  const rolePerms = profile.platformRole?.permissions as StaffPermissions | undefined;
  const customPerms = profile.customPermissions as StaffPermissions | undefined;
  const denials = profile.permissionDenials as StaffPermissions | undefined;

  const tempGrants: StaffPermissions = {};
  for (const tp of profile.tempPermissions) {
    if (!tempGrants[tp.module]) tempGrants[tp.module] = {};
    (tempGrants[tp.module] as Record<string, boolean>)[tp.action] = true;
  }

  const permissions = mergePermissions(rolePerms, customPerms, denials, tempGrants);
  const organizationScope = (profile.organizationScope
    || profile.platformRole?.organizationScope
    || 'ASSIGNED_ORGANIZATIONS') as OrganizationScopeType;

  const access: ResolvedAccess = {
    isSuperAdmin: false,
    staffProfileId: profile.id,
    permissions,
    organizationScope,
    assignedOrgIds: profile.assignments.map((a) => a.organizationId).filter(Boolean) as string[],
    assignedLocations: [
      ...profile.assignedLocations,
      ...profile.assignments.map((a) => a.locationName).filter(Boolean) as string[],
      ...profile.assignments.map((a) => a.stateName).filter(Boolean) as string[],
    ],
    fieldPermissions: (profile.fieldPermissions || profile.platformRole?.fieldPermissions) as ResolvedAccess['fieldPermissions'],
  };

  accessCache.set(cacheKey, { access, expiresAt: Date.now() + CACHE_TTL_MS });
  return access;
}

export function clearAccessCache(userId?: string) {
  if (!userId) { accessCache.clear(); return; }
  for (const key of accessCache.keys()) {
    if (key.startsWith(`${userId}:`)) accessCache.delete(key);
  }
}

export function requirePermission(module: string, action: PermissionAction) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return sendError(res, 'Authentication required', 401);

    try {
      const access = await resolveUserAccess(req.user.userId, req.user.role);
      req.userAccess = access;

      if (!hasPermission(access.permissions, module, action, req.user.role)) {
        return sendError(res, `Permission denied: ${module}.${action}`, 403);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function checkOrgScope(access: ResolvedAccess, organizationId?: string | null): boolean {
  if (access.isSuperAdmin || access.organizationScope === 'ALL_ORGANIZATIONS') return true;
  if (!organizationId) return access.organizationScope !== 'ASSIGNED_ORGANIZATIONS';
  if (access.organizationScope === 'ASSIGNED_ORGANIZATIONS') {
    return access.assignedOrgIds.includes(organizationId);
  }
  return true;
}
