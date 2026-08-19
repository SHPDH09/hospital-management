import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import { clearAccessCache, resolveUserAccess } from '../../middleware/permissions';
import {
  PLATFORM_MODULES,
  PERMISSION_ACTIONS,
  RESTRICTED_MODULES,
  ROLE_HIERARCHY,
  ORG_ROLES,
  DEFAULT_ROLE_TEMPLATES,
  DEFAULT_FIELD_PERMISSIONS,
  mergePermissions,
  buildPermissionMatrix,
  StaffPermissions,
} from '../../lib/permissions';

const router = Router();

async function logPermissionChange(
  staffProfileId: string,
  module: string,
  action: string,
  previousValue: string | null,
  newValue: string,
  changedByEmail?: string,
  reason?: string,
) {
  await prisma.platformPermissionHistory.create({
    data: { staffProfileId, module, action, previousValue, newValue, changedByEmail, reason },
  });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [totalRoles, activeRoles, systemRoles, customRoles, pendingRequests, activeTemp, staffCount] = await Promise.all([
      prisma.platformStaffRole.count(),
      prisma.platformStaffRole.count({ where: { isActive: true } }),
      prisma.platformStaffRole.count({ where: { isSystem: true } }),
      prisma.platformStaffRole.count({ where: { isSystem: false } }),
      prisma.platformPermissionRequest.count({ where: { status: 'PENDING' } }),
      prisma.platformTemporaryPermission.count({ where: { isActive: true, expiresAt: { gt: new Date() } } }),
      prisma.platformStaffProfile.count({ where: { status: 'ACTIVE' } }),
    ]);
    sendSuccess(res, { totalRoles, activeRoles, systemRoles, customRoles, pendingRequests, activeTempPermissions: activeTemp, staffWithRoles: staffCount });
  } catch (err) { next(err); }
});

// ─── Hierarchy & Org Roles ───────────────────────────────────────────────────

router.get('/hierarchy', async (_req, res, next) => {
  try {
    const roles = await prisma.platformStaffRole.findMany({
      orderBy: { level: 'asc' },
      include: { _count: { select: { staff: true } }, department: { select: { name: true } } },
    });
    sendSuccess(res, { hierarchy: ROLE_HIERARCHY, roles, orgRoles: ORG_ROLES });
  } catch (err) { next(err); }
});

// ─── Modules & Actions ───────────────────────────────────────────────────────

router.get('/modules', async (_req, res, next) => {
  try {
    sendSuccess(res, {
      modules: PLATFORM_MODULES,
      actions: PERMISSION_ACTIONS,
      restricted: RESTRICTED_MODULES,
      fieldDefaults: DEFAULT_FIELD_PERMISSIONS,
    });
  } catch (err) { next(err); }
});

// ─── Roles CRUD ──────────────────────────────────────────────────────────────

router.get('/roles', async (req, res, next) => {
  try {
    const roleType = req.query.roleType as string | undefined;
    const roles = await prisma.platformStaffRole.findMany({
      where: { ...(roleType && { roleType: roleType as never }) },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { staff: true } },
        department: { select: { id: true, name: true } },
        parentRole: { select: { id: true, name: true } },
      },
    });
    sendSuccess(res, roles);
  } catch (err) { next(err); }
});

router.get('/roles/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const role = await prisma.platformStaffRole.findUnique({
      where: { id },
      include: { department: true, parentRole: true, _count: { select: { staff: true } } },
    });
    if (!role) throw new AppError('Role not found', 404);
    sendSuccess(res, role);
  } catch (err) { next(err); }
});

router.post('/roles', validateBody(z.object({
  name: z.string().min(1),
  code: z.string().optional(),
  description: z.string().optional(),
  roleType: z.enum(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'DEPARTMENT_MANAGER', 'PLATFORM_STAFF']).optional(),
  level: z.number().optional(),
  departmentId: z.string().optional(),
  parentRoleId: z.string().optional(),
  organizationScope: z.enum(['ALL_ORGANIZATIONS', 'ASSIGNED_ORGANIZATIONS', 'OWN_DEPARTMENT', 'OWN_RECORDS']).optional(),
  locationScope: z.object({ states: z.array(z.string()).optional(), cities: z.array(z.string()).optional() }).optional(),
  permissions: z.record(z.unknown()),
  deniedPermissions: z.record(z.unknown()).optional(),
  fieldPermissions: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const body = req.body;
    const role = await prisma.platformStaffRole.create({
      data: {
        name: body.name,
        code: body.code,
        description: body.description,
        roleType: body.roleType || 'PLATFORM_STAFF',
        level: body.level ?? 3,
        departmentId: body.departmentId,
        parentRoleId: body.parentRoleId,
        organizationScope: body.organizationScope || 'ASSIGNED_ORGANIZATIONS',
        locationScope: body.locationScope as Prisma.InputJsonValue,
        permissions: body.permissions as Prisma.InputJsonValue,
        deniedPermissions: body.deniedPermissions as Prisma.InputJsonValue,
        fieldPermissions: body.fieldPermissions as Prisma.InputJsonValue,
        isActive: body.isActive ?? true,
      },
    });
    await logAudit(req, 'CREATE', 'PlatformStaffRole', role.id, { name: role.name });
    sendSuccess(res, role, 'Role created', 201);
  } catch (err) { next(err); }
});

router.patch('/roles/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const existing = await prisma.platformStaffRole.findUnique({ where: { id } });
    if (!existing) throw new AppError('Role not found', 404);
    if (existing.isSystem && req.body.permissions) {
      throw new AppError('System role permissions require Super Admin override', 403);
    }

    const data: Prisma.PlatformStaffRoleUpdateInput = {};
    const fields = ['name', 'code', 'description', 'roleType', 'level', 'departmentId', 'parentRoleId',
      'organizationScope', 'isActive'] as const;
    for (const f of fields) {
      if (req.body[f] !== undefined) (data as Record<string, unknown>)[f] = req.body[f];
    }
    if (req.body.permissions) data.permissions = req.body.permissions as Prisma.InputJsonValue;
    if (req.body.deniedPermissions) data.deniedPermissions = req.body.deniedPermissions as Prisma.InputJsonValue;
    if (req.body.fieldPermissions) data.fieldPermissions = req.body.fieldPermissions as Prisma.InputJsonValue;
    if (req.body.locationScope) data.locationScope = req.body.locationScope as Prisma.InputJsonValue;

    const role = await prisma.platformStaffRole.update({ where: { id }, data });
    clearAccessCache();
    await logAudit(req, 'UPDATE', 'PlatformStaffRole', id, req.body);
    sendSuccess(res, role);
  } catch (err) { next(err); }
});

router.post('/roles/:id/duplicate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const source = await prisma.platformStaffRole.findUnique({ where: { id } });
    if (!source) throw new AppError('Role not found', 404);

    const role = await prisma.platformStaffRole.create({
      data: {
        name: `${source.name} (Copy)`,
        code: source.code ? `${source.code}_COPY_${Date.now()}` : undefined,
        description: source.description,
        roleType: source.roleType,
        level: source.level,
        permissions: source.permissions as Prisma.InputJsonValue,
        deniedPermissions: source.deniedPermissions as Prisma.InputJsonValue,
        fieldPermissions: source.fieldPermissions as Prisma.InputJsonValue,
        organizationScope: source.organizationScope,
        locationScope: source.locationScope as Prisma.InputJsonValue,
        departmentId: source.departmentId,
        isSystem: false,
      },
    });
    sendSuccess(res, role, 'Role duplicated', 201);
  } catch (err) { next(err); }
});

router.delete('/roles/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const role = await prisma.platformStaffRole.findUnique({ where: { id }, include: { _count: { select: { staff: true } } } });
    if (!role) throw new AppError('Role not found', 404);
    if (role.isSystem) throw new AppError('Cannot delete system role', 403);
    if (role._count.staff > 0) throw new AppError('Role has assigned staff — reassign first', 409);
    await prisma.platformStaffRole.delete({ where: { id } });
    await logAudit(req, 'DELETE', 'PlatformStaffRole', id);
    sendSuccess(res, null, 'Role deleted');
  } catch (err) { next(err); }
});

// ─── Templates ───────────────────────────────────────────────────────────────

router.get('/templates', async (_req, res, next) => {
  try {
    sendSuccess(res, DEFAULT_ROLE_TEMPLATES);
  } catch (err) { next(err); }
});

router.post('/templates/:code/apply', async (req: AuthRequest, res, next) => {
  try {
    const code = req.params.code;
    const tpl = DEFAULT_ROLE_TEMPLATES.find((t) => t.code === code);
    if (!tpl) throw new AppError('Template not found', 404);

    const role = await prisma.platformStaffRole.upsert({
      where: { name: tpl.name },
      update: {
        permissions: tpl.permissions as Prisma.InputJsonValue,
        roleType: tpl.roleType,
        level: tpl.level,
        organizationScope: tpl.organizationScope,
        description: tpl.description,
      },
      create: {
        name: tpl.name,
        code: tpl.code,
        description: tpl.description,
        roleType: tpl.roleType,
        level: tpl.level,
        permissions: tpl.permissions as Prisma.InputJsonValue,
        organizationScope: tpl.organizationScope,
        isSystem: true,
      },
    });
    sendSuccess(res, role, 'Template applied');
  } catch (err) { next(err); }
});

// ─── Permission Matrix ───────────────────────────────────────────────────────

router.get('/matrix', async (_req, res, next) => {
  try {
    const roles = await prisma.platformStaffRole.findMany({
      where: { isActive: true },
      orderBy: { level: 'asc' },
      select: { name: true, permissions: true, roleType: true },
    });
    const matrix = buildPermissionMatrix(
      roles.map((r) => ({ name: r.name, permissions: r.permissions as StaffPermissions })),
    );
    sendSuccess(res, { matrix, roles: roles.map((r) => ({ name: r.name, roleType: r.roleType })) });
  } catch (err) { next(err); }
});

// ─── Staff Permission Assignment ─────────────────────────────────────────────

router.get('/staff/:staffId/effective', async (req, res, next) => {
  try {
    const staffId = paramId(req.params.staffId);
    const profile = await prisma.platformStaffProfile.findUnique({
      where: { id: staffId },
      include: { platformRole: true, user: { select: { email: true, role: true } }, assignments: true },
    });
    if (!profile) throw new AppError('Staff not found', 404);

    const effective = mergePermissions(
      profile.platformRole?.permissions as StaffPermissions,
      profile.customPermissions as StaffPermissions,
      profile.permissionDenials as StaffPermissions,
    );

    sendSuccess(res, {
      profile: { id: profile.id, fullName: profile.fullName, email: profile.user.email },
      role: profile.platformRole,
      organizationScope: profile.organizationScope || profile.platformRole?.organizationScope,
      assignedLocations: profile.assignedLocations,
      effectivePermissions: effective,
    });
  } catch (err) { next(err); }
});

router.patch('/staff/:staffId/permissions', async (req: AuthRequest, res, next) => {
  try {
    const staffId = paramId(req.params.staffId);
    const body = z.object({
      customPermissions: z.record(z.unknown()).optional(),
      permissionDenials: z.record(z.unknown()).optional(),
      fieldPermissions: z.record(z.unknown()).optional(),
      organizationScope: z.enum(['ALL_ORGANIZATIONS', 'ASSIGNED_ORGANIZATIONS', 'OWN_DEPARTMENT', 'OWN_RECORDS']).optional(),
      platformRoleId: z.string().optional(),
      reason: z.string().optional(),
    }).parse(req.body);

    const existing = await prisma.platformStaffProfile.findUnique({ where: { id: staffId } });
    if (!existing) throw new AppError('Staff not found', 404);

    const profile = await prisma.platformStaffProfile.update({
      where: { id: staffId },
      data: {
        ...(body.customPermissions && { customPermissions: body.customPermissions as Prisma.InputJsonValue }),
        ...(body.permissionDenials && { permissionDenials: body.permissionDenials as Prisma.InputJsonValue }),
        ...(body.fieldPermissions && { fieldPermissions: body.fieldPermissions as Prisma.InputJsonValue }),
        ...(body.organizationScope && { organizationScope: body.organizationScope }),
        ...(body.platformRoleId && { platformRoleId: body.platformRoleId }),
      },
    });

    if (body.platformRoleId && body.platformRoleId !== existing.platformRoleId) {
      await logPermissionChange(staffId, 'role', 'assignment', existing.platformRoleId, body.platformRoleId, req.user?.email, body.reason);
    }

    clearAccessCache(existing.userId);
    sendSuccess(res, profile, 'Permissions updated');
  } catch (err) { next(err); }
});

// ─── Temporary Permissions ───────────────────────────────────────────────────

router.get('/temporary', async (req, res, next) => {
  try {
    const staffProfileId = req.query.staffProfileId as string | undefined;
    const perms = await prisma.platformTemporaryPermission.findMany({
      where: {
        ...(staffProfileId && { staffProfileId }),
        isActive: true,
      },
      orderBy: { expiresAt: 'asc' },
      include: { staffProfile: { select: { fullName: true, employeeId: true } } },
    });
    sendSuccess(res, perms);
  } catch (err) { next(err); }
});

router.post('/temporary', validateBody(z.object({
  staffProfileId: z.string(),
  module: z.string(),
  action: z.string(),
  reason: z.string().optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string(),
})), async (req: AuthRequest, res, next) => {
  try {
    const body = req.body;
    const perm = await prisma.platformTemporaryPermission.create({
      data: {
        staffProfileId: body.staffProfileId,
        module: body.module,
        action: body.action,
        reason: body.reason,
        startsAt: body.startsAt ? new Date(body.startsAt) : new Date(),
        expiresAt: new Date(body.expiresAt),
        grantedByEmail: req.user?.email,
      },
    });
    const profile = await prisma.platformStaffProfile.findUnique({ where: { id: body.staffProfileId } });
    if (profile) clearAccessCache(profile.userId);
    await logPermissionChange(body.staffProfileId, body.module, body.action, 'denied', 'temporary_grant', req.user?.email, body.reason);
    sendSuccess(res, perm, 'Temporary permission granted', 201);
  } catch (err) { next(err); }
});

router.delete('/temporary/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const perm = await prisma.platformTemporaryPermission.update({
      where: { id },
      data: { isActive: false },
    });
    const profile = await prisma.platformStaffProfile.findUnique({ where: { id: perm.staffProfileId } });
    if (profile) clearAccessCache(profile.userId);
    sendSuccess(res, perm, 'Temporary permission revoked');
  } catch (err) { next(err); }
});

// ─── Permission Requests ───────────────────────────────────────────────────────

router.get('/requests', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const requests = await prisma.platformPermissionRequest.findMany({
      where: { ...(status && { status: status as never }) },
      orderBy: { createdAt: 'desc' },
      include: { staffProfile: { select: { fullName: true, employeeId: true } } },
    });
    sendSuccess(res, requests);
  } catch (err) { next(err); }
});

router.post('/requests', validateBody(z.object({
  module: z.string(),
  action: z.string(),
  reason: z.string().min(1),
})), async (req: AuthRequest, res, next) => {
  try {
    const profile = await prisma.platformStaffProfile.findUnique({ where: { userId: req.user!.userId } });
    if (!profile) throw new AppError('Platform staff profile required', 403);

    const request = await prisma.platformPermissionRequest.create({
      data: {
        staffProfileId: profile.id,
        module: req.body.module,
        action: req.body.action,
        reason: req.body.reason,
      },
    });
    sendSuccess(res, request, 'Access request submitted', 201);
  } catch (err) { next(err); }
});

router.patch('/requests/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { status, reviewNote } = z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
      reviewNote: z.string().optional(),
    }).parse(req.body);

    const request = await prisma.platformPermissionRequest.update({
      where: { id },
      data: { status, reviewNote, reviewedByEmail: req.user?.email, reviewedAt: new Date() },
      include: { staffProfile: true },
    });

    if (status === 'APPROVED') {
      const custom = (request.staffProfile.customPermissions as StaffPermissions) || {};
      if (!custom[request.module]) custom[request.module] = {};
      (custom[request.module] as Record<string, boolean>)[request.action] = true;
      await prisma.platformStaffProfile.update({
        where: { id: request.staffProfileId },
        data: { customPermissions: custom as Prisma.InputJsonValue },
      });
      await logPermissionChange(request.staffProfileId, request.module, request.action, 'denied', 'allowed', req.user?.email, request.reason);
      clearAccessCache(request.staffProfile.userId);
    }

    sendSuccess(res, request);
  } catch (err) { next(err); }
});

// ─── Permission History ────────────────────────────────────────────────────────

router.get('/history', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const staffProfileId = req.query.staffProfileId as string | undefined;

    const [history, total] = await Promise.all([
      prisma.platformPermissionHistory.findMany({
        where: { ...(staffProfileId && { staffProfileId }) },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { staffProfile: { select: { fullName: true } } },
      }),
      prisma.platformPermissionHistory.count({ where: { ...(staffProfileId && { staffProfileId }) } }),
    ]);
    sendPaginated(res, history, { page, limit, total });
  } catch (err) { next(err); }
});

// ─── Current User Permissions (for frontend) ───────────────────────────────────

router.get('/me', async (req: AuthRequest, res, next) => {
  try {
    const access = await resolveUserAccess(req.user!.userId, req.user!.role);
    sendSuccess(res, access);
  } catch (err) { next(err); }
});

// ─── Settings ────────────────────────────────────────────────────────────────

router.get('/settings', async (_req, res, next) => {
  try {
    sendSuccess(res, {
      defaultDeleteOff: true,
      preferArchive: true,
      explicitDenyWins: true,
      sensitiveModules: RESTRICTED_MODULES,
      sessionTimeoutMinutes: 30,
      maxLoginAttempts: 5,
      require2FAForSensitive: true,
    });
  } catch (err) { next(err); }
});

export default router;
