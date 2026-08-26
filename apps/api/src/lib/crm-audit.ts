import { prisma } from './prisma';
import { AuthRequest } from '../middleware/auth';

export async function logCrmAudit(
  req: AuthRequest,
  organizationId: string,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>,
) {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
  let staffName: string | undefined;
  if (req.user) {
    const staff = await prisma.staff.findUnique({
      where: { userId: req.user.userId },
      select: { fullName: true },
    });
    staffName = staff?.fullName;
    if (!staffName) {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: req.user.userId },
        select: { fullName: true },
      });
      staffName = doctor?.fullName;
    }
  }

  await prisma.organizationAuditLog.create({
    data: {
      organizationId,
      userId: req.user?.userId,
      staffName,
      action,
      entityType,
      entityId,
      details: details ? (details as object) : undefined,
      ipAddress: ip,
    },
  });
}
