import { AuthRequest, resolveOrganizationId } from '../middleware/auth';
import { AppError } from './response';
import { prisma } from './prisma';

export async function requireOrgId(req: AuthRequest): Promise<string> {
  const orgId = await resolveOrganizationId(req);
  if (!orgId) throw new AppError('Organization context required', 403);
  return orgId;
}

/** Apply branch filter for branch-scoped roles. */
export async function getBranchFilter(req: AuthRequest): Promise<{ branchId?: string }> {
  if (!req.user) return {};
  if (req.user.role === 'BRANCH_ADMIN' && req.user.branchId) {
    return { branchId: req.user.branchId };
  }
  if (req.user.role === 'BRANCH_ADMIN' && !req.user.branchId) {
    const staff = await prisma.staff.findUnique({
      where: { userId: req.user.userId },
      select: { branchId: true },
    });
    if (staff?.branchId) return { branchId: staff.branchId };
  }
  return {};
}

export function assertOrgAdmin(req: AuthRequest) {
  if (!req.user || !['HOSPITAL_ADMIN', 'BRANCH_ADMIN'].includes(req.user.role)) {
    throw new AppError('Hospital admin access required', 403);
  }
}
