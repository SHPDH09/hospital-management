import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@healthcare/shared';
import { verifyAccessToken } from '../lib/auth';
import { sendError } from '../lib/response';
import { prisma } from '../lib/prisma';
import type { ResolvedAccess } from './permissions';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
    organizationId?: string;
    branchId?: string;
  };
  userAccess?: ResolvedAccess;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return sendError(res, 'Authentication required', 401);
  }

  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    return sendError(res, 'Invalid or expired token', 401);
  }

  prisma.refreshToken.findFirst({
    where: { userId: payload.userId, expiresAt: { gt: new Date() } },
  }).then((session) => {
    if (!session) {
      return sendError(res, 'Session revoked. Please log in again.', 401);
    }
    req.user = payload;
    next();
  }).catch(next);
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const token = header.slice(7);
      req.user = verifyAccessToken(token);
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', 401);
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, 'Insufficient permissions', 403);
    }
    next();
  };
}

export const PLATFORM_ROLES: UserRole[] = ['SUPER_ADMIN', 'PLATFORM_STAFF'];
export const ORG_ADMIN_ROLES: UserRole[] = ['HOSPITAL_ADMIN', 'BRANCH_ADMIN'];
export const CRM_ROLES: UserRole[] = [
  'HOSPITAL_ADMIN',
  'BRANCH_ADMIN',
  'DOCTOR',
  'RECEPTIONIST',
  'NURSE',
  'ACCOUNTANT',
  'PHARMACIST',
  'LAB_STAFF',
  'MANAGER',
];

export async function resolveOrganizationId(req: AuthRequest): Promise<string | null> {
  if (!req.user) return null;

  if (PLATFORM_ROLES.includes(req.user.role)) {
    return (req.query.organizationId as string) || (req.body?.organizationId as string) || null;
  }

  if (req.user.organizationId) return req.user.organizationId;

  if (req.user.role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: req.user.userId },
      select: { organizationId: true },
    });
    return doctor?.organizationId || null;
  }

  if (CRM_ROLES.includes(req.user.role)) {
    const staff = await prisma.staff.findUnique({
      where: { userId: req.user.userId },
      select: { organizationId: true },
    });
    return staff?.organizationId || null;
  }

  return null;
}

export function tenantScope(req: AuthRequest, res: Response, next: NextFunction) {
  resolveOrganizationId(req)
    .then((orgId) => {
      if (orgId) {
        req.user = { ...req.user!, organizationId: orgId };
      }
      next();
    })
    .catch(next);
}
