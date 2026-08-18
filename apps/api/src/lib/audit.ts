import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { prisma } from './prisma';

export async function logAudit(
  req: AuthRequest,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Prisma.InputJsonValue
) {
  await prisma.auditLog.create({
    data: {
      userId: req.user?.userId,
      action,
      entityType,
      entityId,
      details: details ?? undefined,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
    },
  });
}

export async function logLogin(
  email: string,
  success: boolean,
  userId?: string,
  failureReason?: string,
  req?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
) {
  await prisma.loginHistory.create({
    data: {
      userId,
      email,
      success,
      failureReason,
      ipAddress: (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0] || req?.ip,
      userAgent: req?.headers?.['user-agent'] as string,
    },
  });
}
