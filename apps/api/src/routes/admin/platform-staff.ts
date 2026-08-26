import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/auth';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import {
  PLATFORM_MODULES,
  DEFAULT_ROLE_TEMPLATES,
  mergePermissions,
  StaffPermissions,
} from '../../lib/permissions';

const router = Router();

async function logStaffActivity(
  staffProfileId: string,
  action: string,
  options?: { entityType?: string; entityId?: string; entityName?: string; details?: Prisma.InputJsonValue; ip?: string }
) {
  await prisma.platformStaffActivity.create({
    data: {
      staffProfileId,
      action,
      entityType: options?.entityType,
      entityId: options?.entityId,
      entityName: options?.entityName,
      details: options?.details,
      ipAddress: options?.ip,
    },
  });
}

async function getProfileByUserId(userId: string) {
  return prisma.platformStaffProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true } },
      department: true,
      platformRole: true,
      assignments: { include: { organization: { select: { id: true, name: true, city: true } } } },
    },
  });
}

const staffInclude = {
  user: { select: { id: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true } },
  department: true,
  platformRole: true,
  _count: { select: { tasks: true, activities: true } },
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [
      total, active, inactive, suspended, departments,
      pendingTasks, openTickets, pendingVerifications,
      onlineUsers,
    ] = await Promise.all([
      prisma.platformStaffProfile.count(),
      prisma.platformStaffProfile.count({ where: { status: 'ACTIVE' } }),
      prisma.platformStaffProfile.count({ where: { status: 'INACTIVE' } }),
      prisma.platformStaffProfile.count({ where: { status: 'SUSPENDED' } }),
      prisma.platformDepartment.count({ where: { isActive: true } }),
      prisma.platformStaffTask.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
      prisma.complaint.count({ where: { status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] } } }),
      prisma.organization.count({ where: { verificationStatus: 'PENDING' } }),
      prisma.refreshToken.findMany({
        where: { expiresAt: { gt: new Date() }, user: { role: { in: ['PLATFORM_STAFF', 'SUPER_ADMIN'] } } },
        distinct: ['userId'],
        select: { userId: true },
      }),
    ]);

    sendSuccess(res, {
      totalStaff: total,
      activeStaff: active,
      inactiveStaff: inactive,
      suspendedStaff: suspended,
      onlineStaff: onlineUsers.length,
      departments,
      pendingTasks,
      openSupportTickets: openTickets,
      pendingVerifications,
    });
  } catch (err) { next(err); }
});

// ─── Departments ─────────────────────────────────────────────────────────────

router.get('/departments', async (_req, res, next) => {
  try {
    const deps = await prisma.platformDepartment.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { staff: true } } },
    });
    sendSuccess(res, deps);
  } catch (err) { next(err); }
});

router.post('/departments', async (req: AuthRequest, res, next) => {
  try {
    const { name, description } = z.object({ name: z.string().min(1), description: z.string().optional() }).parse(req.body);
    const dep = await prisma.platformDepartment.create({ data: { name, description } });
    sendSuccess(res, dep, 'Department created', 201);
  } catch (err) { next(err); }
});

// ─── Roles & Permissions ─────────────────────────────────────────────────────

router.get('/roles', async (_req, res, next) => {
  try {
    const roles = await prisma.platformStaffRole.findMany({
      orderBy: { level: 'asc' },
      include: { _count: { select: { staff: true } } },
    });
    sendSuccess(res, roles);
  } catch (err) { next(err); }
});

router.post('/roles', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      name: z.string(), code: z.string().optional(), description: z.string().optional(),
      level: z.number().optional(), permissions: z.record(z.unknown()),
    }).parse(req.body);
    const role = await prisma.platformStaffRole.create({
      data: { ...body, permissions: body.permissions as Prisma.InputJsonValue },
    });
    sendSuccess(res, role, 'Role created', 201);
  } catch (err) { next(err); }
});

router.patch('/roles/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const role = await prisma.platformStaffRole.update({
      where: { id },
      data: { ...req.body, ...(req.body.permissions && { permissions: req.body.permissions as Prisma.InputJsonValue }) },
    });
    sendSuccess(res, role);
  } catch (err) { next(err); }
});

router.get('/modules', async (_req, res, next) => {
  try {
    sendSuccess(res, { modules: PLATFORM_MODULES, restricted: ['global_settings', 'emergency', 'security', 'super_admin'] });
  } catch (err) { next(err); }
});

// ─── Staff CRUD ──────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;

    const [staff, total] = await Promise.all([
      prisma.platformStaffProfile.findMany({
        where: {
          ...(status && { status: status as never }),
          ...(departmentId && { departmentId }),
        },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: staffInclude,
      }),
      prisma.platformStaffProfile.count({ where: { ...(status && { status: status as never }), ...(departmentId && { departmentId }) } }),
    ]);
    sendPaginated(res, staff, { page, limit, total });
  } catch (err) { next(err); }
});

router.post('/', validateBody(z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8).optional(),
  sendInvitation: z.boolean().optional(),
  employeeId: z.string().optional(),
  departmentId: z.string().optional(),
  designation: z.string().optional(),
  platformRoleId: z.string().optional(),
  joiningDate: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  assignedLocations: z.array(z.string()).optional(),
  customPermissions: z.record(z.unknown()).optional(),
  role: z.enum(['PLATFORM_STAFF', 'SUPER_ADMIN']).optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const body = req.body;
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new AppError('Email already exists', 409);

    const password = body.password || `Temp${Date.now().toString(36)}!`;
    const passwordHash = await hashPassword(password);
    const userRole = body.role || 'PLATFORM_STAFF';

    const user = await prisma.user.create({
      data: {
        email: body.email,
        phone: body.phone,
        passwordHash,
        role: userRole,
        isActive: body.status !== 'SUSPENDED' && body.status !== 'INACTIVE',
        emailVerified: true,
      },
    });

    const profile = await prisma.platformStaffProfile.create({
      data: {
        userId: user.id,
        fullName: body.fullName,
        phone: body.phone,
        employeeId: body.employeeId,
        departmentId: body.departmentId,
        designation: body.designation,
        platformRoleId: body.platformRoleId,
        joiningDate: body.joiningDate ? new Date(body.joiningDate) : new Date(),
        status: body.status || 'ACTIVE',
        assignedLocations: body.assignedLocations || [],
        customPermissions: body.customPermissions as Prisma.InputJsonValue,
      },
      include: staffInclude,
    });

    await logStaffActivity(profile.id, 'STAFF_CREATED', { entityName: body.fullName });
    await logAudit(req, 'CREATE', 'PlatformStaffProfile', profile.id);

    sendSuccess(res, {
      ...profile,
      ...(body.sendInvitation && !body.password ? { temporaryPassword: password } : {}),
    }, 'Staff created', 201);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const profile = await prisma.platformStaffProfile.findUnique({
      where: { id },
      include: {
        ...staffInclude,
        assignments: { include: { organization: { select: { id: true, name: true, city: true, type: true } } } },
        tasks: { orderBy: { createdAt: 'desc' }, take: 10 },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!profile) { res.status(404).json({ success: false, message: 'Not found' }); return; }

    const rolePerms = profile.platformRole?.permissions as StaffPermissions | undefined;
    const customPerms = profile.customPermissions as StaffPermissions | undefined;
    const effectivePermissions = mergePermissions(rolePerms, customPerms);

    sendSuccess(res, { ...profile, effectivePermissions });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const body = req.body as Record<string, unknown>;
    const profile = await prisma.platformStaffProfile.update({
      where: { id },
      data: {
        fullName: body.fullName as string | undefined,
        phone: body.phone as string | undefined,
        employeeId: body.employeeId as string | undefined,
        departmentId: body.departmentId as string | undefined,
        designation: body.designation as string | undefined,
        platformRoleId: body.platformRoleId as string | undefined,
        status: body.status as never,
        assignedLocations: body.assignedLocations as string[] | undefined,
        customPermissions: body.customPermissions as Prisma.InputJsonValue,
        twoFactorEnabled: body.twoFactorEnabled as boolean | undefined,
        joiningDate: body.joiningDate ? new Date(body.joiningDate as string) : undefined,
      },
      include: staffInclude,
    });

    if (body.isActive !== undefined && profile.userId) {
      await prisma.user.update({ where: { id: profile.userId }, data: { isActive: Boolean(body.isActive) } });
    }

    await logStaffActivity(id, 'STAFF_UPDATED');
    sendSuccess(res, profile);
  } catch (err) { next(err); }
});

// ─── Account Controls ────────────────────────────────────────────────────────

router.post('/:id/suspend', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const profile = await prisma.platformStaffProfile.update({
      where: { id }, data: { status: 'SUSPENDED' }, include: staffInclude,
    });
    await prisma.user.update({ where: { id: profile.userId }, data: { isActive: false } });
    await prisma.refreshToken.deleteMany({ where: { userId: profile.userId } });
    await logStaffActivity(id, 'STAFF_SUSPENDED', { entityName: profile.fullName });
    sendSuccess(res, profile);
  } catch (err) { next(err); }
});

router.post('/:id/activate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const profile = await prisma.platformStaffProfile.update({
      where: { id }, data: { status: 'ACTIVE' }, include: staffInclude,
    });
    await prisma.user.update({ where: { id: profile.userId }, data: { isActive: true } });
    await logStaffActivity(id, 'STAFF_ACTIVATED', { entityName: profile.fullName });
    sendSuccess(res, profile);
  } catch (err) { next(err); }
});

router.post('/:id/reset-password', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { password } = z.object({ password: z.string().min(8) }).parse(req.body);
    const profile = await prisma.platformStaffProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError('Not found', 404);
    await prisma.user.update({ where: { id: profile.userId }, data: { passwordHash: await hashPassword(password) } });
    await logStaffActivity(id, 'PASSWORD_RESET', { entityName: profile.fullName });
    sendSuccess(res, null, 'Password reset');
  } catch (err) { next(err); }
});

router.post('/:id/force-logout', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const profile = await prisma.platformStaffProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError('Not found', 404);
    const result = await prisma.refreshToken.deleteMany({ where: { userId: profile.userId } });
    await logStaffActivity(id, 'FORCE_LOGOUT', { entityName: profile.fullName });
    sendSuccess(res, { sessionsRevoked: result.count });
  } catch (err) { next(err); }
});

router.get('/:id/sessions', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const profile = await prisma.platformStaffProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError('Not found', 404);
    const sessions = await prisma.refreshToken.findMany({
      where: { userId: profile.userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, sessions);
  } catch (err) { next(err); }
});

// ─── Tasks ───────────────────────────────────────────────────────────────────

router.get('/tasks/list', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const tasks = await prisma.platformStaffTask.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { assignedTo: { select: { id: true, fullName: true, employeeId: true } } },
      take: 100,
    });
    sendSuccess(res, tasks);
  } catch (err) { next(err); }
});

router.post('/tasks', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      title: z.string(), description: z.string().optional(), assignedToId: z.string(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
      dueDate: z.string().optional(),
    }).parse(req.body);
    const task = await prisma.platformStaffTask.create({
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        assignedByEmail: req.user?.email,
      },
      include: { assignedTo: { select: { fullName: true } } },
    });
    await logStaffActivity(body.assignedToId, 'TASK_ASSIGNED', { entityName: body.title });
    sendSuccess(res, task, 'Task created', 201);
  } catch (err) { next(err); }
});

router.patch('/tasks/:taskId', async (req: AuthRequest, res, next) => {
  try {
    const taskId = paramId(req.params.taskId);
    const body = req.body as { status?: string };
    const data: Prisma.PlatformStaffTaskUpdateInput = { status: body.status as never };
    if (body.status === 'COMPLETED') data.completedAt = new Date();
    const task = await prisma.platformStaffTask.update({ where: { id: taskId }, data });
    sendSuccess(res, task);
  } catch (err) { next(err); }
});

// ─── Assignments ─────────────────────────────────────────────────────────────

router.get('/assignments/list', async (_req, res, next) => {
  try {
    const assignments = await prisma.platformStaffAssignment.findMany({
      include: {
        staffProfile: { select: { fullName: true, employeeId: true } },
        organization: { select: { name: true, city: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, assignments);
  } catch (err) { next(err); }
});

router.post('/assignments', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      staffProfileId: z.string(),
      organizationId: z.string().optional(),
      locationName: z.string().optional(),
      stateName: z.string().optional(),
      assignmentType: z.enum(['organization', 'location']).optional(),
    }).parse(req.body);
    const assignment = await prisma.platformStaffAssignment.create({ data: body });
    await logStaffActivity(body.staffProfileId, 'ASSIGNMENT_CREATED', {
      entityType: body.assignmentType,
      entityName: body.locationName || body.organizationId,
    });
    sendSuccess(res, assignment, 'Assignment created', 201);
  } catch (err) { next(err); }
});

router.delete('/assignments/:assignmentId', async (req, res, next) => {
  try {
    await prisma.platformStaffAssignment.delete({ where: { id: paramId(req.params.assignmentId) } });
    sendSuccess(res, null, 'Assignment removed');
  } catch (err) { next(err); }
});

// ─── Activity & Performance ──────────────────────────────────────────────────

router.get('/activity/list', async (req, res, next) => {
  try {
    const staffProfileId = req.query.staffProfileId as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const activities = await prisma.platformStaffActivity.findMany({
      where: staffProfileId ? { staffProfileId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { staffProfile: { select: { fullName: true, employeeId: true } } },
    });
    sendSuccess(res, activities);
  } catch (err) { next(err); }
});

router.get('/performance/list', async (_req, res, next) => {
  try {
    const staff = await prisma.platformStaffProfile.findMany({
      include: {
        _count: { select: { tasks: true, activities: true } },
        tasks: { where: { status: 'COMPLETED' } },
      },
    });

    const performance = await Promise.all(staff.map(async (s) => {
      const completedTasks = await prisma.platformStaffTask.count({ where: { assignedToId: s.id, status: 'COMPLETED' } });
      const ticketsResolved = await prisma.complaint.count({ where: { assignedToId: s.userId, status: 'RESOLVED' } });
      const hospitalsVerified = await prisma.platformStaffActivity.count({
        where: { staffProfileId: s.id, action: { contains: 'HOSPITAL' } },
      });
      return {
        id: s.id,
        fullName: s.fullName,
        employeeId: s.employeeId,
        department: s.departmentId,
        tasksCompleted: completedTasks,
        ticketsResolved,
        hospitalsVerified,
        activityCount: s._count.activities,
      };
    }));

    sendSuccess(res, performance);
  } catch (err) { next(err); }
});

// ─── Attendance ──────────────────────────────────────────────────────────────

router.get('/attendance/list', async (req, res, next) => {
  try {
    const staffProfileId = req.query.staffProfileId as string | undefined;
    const records = await prisma.platformStaffAttendance.findMany({
      where: staffProfileId ? { staffProfileId } : undefined,
      orderBy: { checkInAt: 'desc' },
      take: 100,
      include: { staffProfile: { select: { fullName: true } } },
    });
    sendSuccess(res, records);
  } catch (err) { next(err); }
});

router.post('/attendance/check-in', async (req: AuthRequest, res, next) => {
  try {
    const { staffProfileId } = z.object({ staffProfileId: z.string() }).parse(req.body);
    const record = await prisma.platformStaffAttendance.create({ data: { staffProfileId } });
    sendSuccess(res, record);
  } catch (err) { next(err); }
});

router.post('/attendance/:id/check-out', async (req, res, next) => {
  try {
    const record = await prisma.platformStaffAttendance.update({
      where: { id: paramId(req.params.id) },
      data: { checkOutAt: new Date() },
    });
    sendSuccess(res, record);
  } catch (err) { next(err); }
});

// ─── Announcements ───────────────────────────────────────────────────────────

router.get('/announcements/list', async (_req, res, next) => {
  try {
    const items = await prisma.platformStaffAnnouncement.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    sendSuccess(res, items);
  } catch (err) { next(err); }
});

router.post('/announcements', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({ title: z.string(), message: z.string(), audience: z.array(z.string()).optional() }).parse(req.body);
    const item = await prisma.platformStaffAnnouncement.create({
      data: { ...body, createdByEmail: req.user?.email },
    });
    sendSuccess(res, item, 'Announcement created', 201);
  } catch (err) { next(err); }
});

// ─── Ticket assignment helper ────────────────────────────────────────────────

router.post('/tickets/:complaintId/assign', async (req: AuthRequest, res, next) => {
  try {
    const complaintId = paramId(req.params.complaintId);
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    const complaint = await prisma.complaint.update({
      where: { id: complaintId },
      data: { assignedToId: userId, status: 'ASSIGNED' },
    });
    const profile = await prisma.platformStaffProfile.findUnique({ where: { userId } });
    if (profile) {
      await logStaffActivity(profile.id, 'TICKET_ASSIGNED', { entityType: 'Complaint', entityId: complaintId, entityName: complaint.ticketId });
    }
    sendSuccess(res, complaint, 'Ticket assigned');
  } catch (err) { next(err); }
});

export default router;
