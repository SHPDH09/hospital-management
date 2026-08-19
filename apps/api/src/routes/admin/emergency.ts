import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { comparePassword } from '../../lib/auth';
import {
  getEmergencyState,
  saveEmergencyState,
  computeSystemStatus,
  getActiveControls,
  getAffectedModules,
  logEmergencyAction,
  syncLegacyFlags,
  MODULE_KEYS,
  STATUS_LABELS,
} from '../../lib/emergency';

const router = Router();

const reasonSchema = z.object({
  reason: z.string().min(3, 'Reason is required (min 3 characters)'),
  confirm: z.boolean().optional(),
  password: z.string().optional(),
});

async function requireSuperAdminPassword(req: AuthRequest, password?: string) {
  if (!password) return false;
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || user.role !== 'SUPER_ADMIN') return false;
  return comparePassword(password, user.passwordHash);
}

async function buildDashboard() {
  const state = await getEmergencyState();
  const synced = syncLegacyFlags(state);
  const status = computeSystemStatus(synced);
  const [activeSuspensions, activeAnnouncements, scheduledCount, recentLogs] = await Promise.all([
    prisma.emergencySuspension.count({ where: { isActive: true } }),
    prisma.emergencyAnnouncement.count({ where: { isActive: true } }),
    prisma.scheduledMaintenance.count({ where: { isActive: true, endAt: { gte: new Date() } } }),
    prisma.emergencyActionLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
  ]);

  return {
    status,
    statusInfo: STATUS_LABELS[status],
    state: synced,
    activeControls: getActiveControls(synced),
    affectedModules: getAffectedModules(synced),
    activatedBy: synced.activatedByEmail || synced.activatedBy,
    activatedAt: synced.activatedAt,
    reason: synced.reason,
    expectedResolutionAt: synced.expectedResolutionAt,
    activeSuspensions,
    activeAnnouncements,
    scheduledMaintenanceCount: scheduledCount,
    recentLogs,
  };
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (_req, res, next) => {
  try {
    sendSuccess(res, await buildDashboard());
  } catch (err) { next(err); }
});

router.get('/state', async (_req, res, next) => {
  try {
    const state = syncLegacyFlags(await getEmergencyState());
    sendSuccess(res, state);
  } catch (err) { next(err); }
});

// ─── Emergency Mode ──────────────────────────────────────────────────────────

router.post('/activate', async (req: AuthRequest, res, next) => {
  try {
    const { reason, confirm, password } = reasonSchema.extend({
      confirm: z.literal(true),
      expectedResolutionAt: z.string().optional(),
      disableModules: z.array(z.string()).optional(),
    }).parse(req.body);

    if (req.user?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ success: false, message: 'Only Super Admin can activate emergency mode' });
      return;
    }
    if (!(await requireSuperAdminPassword(req, password))) {
      res.status(403).json({ success: false, message: 'Super Admin password required for this action' });
      return;
    }

    const state = await getEmergencyState();
    const modules = { ...(state.modules as Record<string, boolean>) };
    const disabledModules: string[] = [];
    for (const key of req.body.disableModules || []) {
      if (key in modules) {
        modules[key] = false;
        disabledModules.push(key);
      }
    }

    const updated = syncLegacyFlags({
      ...state,
      emergencyModeActive: true,
      activatedBy: req.user.userId,
      activatedByEmail: req.user.email,
      activatedAt: new Date().toISOString(),
      reason,
      expectedResolutionAt: req.body.expectedResolutionAt || null,
      modules,
      lastDisabledModules: disabledModules,
    });

    await saveEmergencyState(updated);
    await logEmergencyAction(req, 'Emergency Mode Activated', reason, {
      affectedScope: 'All Users',
      details: { disabledModules, expectedResolutionAt: req.body.expectedResolutionAt },
    });

    sendSuccess(res, await buildDashboard(), 'Emergency mode activated');
  } catch (err) { next(err); }
});

router.post('/deactivate', async (req: AuthRequest, res, next) => {
  try {
    const { reason } = reasonSchema.parse(req.body);
    const state = await getEmergencyState();
    const updated = syncLegacyFlags({
      ...state,
      emergencyModeActive: false,
      reason: '',
      activatedBy: null,
      activatedByEmail: null,
      activatedAt: null,
      expectedResolutionAt: null,
    });
    await saveEmergencyState(updated);
    await logEmergencyAction(req, 'Emergency Mode Deactivated', reason, { affectedScope: 'All Users' });
    sendSuccess(res, await buildDashboard(), 'Emergency mode deactivated');
  } catch (err) { next(err); }
});

// ─── Maintenance Mode ────────────────────────────────────────────────────────

router.put('/maintenance', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      reason: z.string().min(3),
      maintenanceMode: z.boolean(),
      maintenanceType: z.enum(['full', 'partial']).optional(),
      maintenanceModules: z.array(z.string()).optional(),
      maintenanceMessage: z.string().optional(),
      confirm: z.boolean().optional(),
      password: z.string().optional(),
    }).parse(req.body);

    if (body.maintenanceMode && body.maintenanceType === 'full') {
      if (!(await requireSuperAdminPassword(req, body.password))) {
        res.status(403).json({ success: false, message: 'Super Admin password required for full maintenance' });
        return;
      }
    }

    const state = await getEmergencyState();
    const updated = syncLegacyFlags({
      ...state,
      maintenanceMode: body.maintenanceMode,
      maintenanceType: body.maintenanceType || state.maintenanceType,
      maintenanceModules: body.maintenanceModules ?? state.maintenanceModules,
      maintenanceMessage: body.maintenanceMessage ?? state.maintenanceMessage,
    });
    await saveEmergencyState(updated);
    await logEmergencyAction(req, body.maintenanceMode ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled', body.reason, {
      affectedScope: body.maintenanceType === 'full' ? 'Entire Platform' : 'Selected Modules',
      details: { maintenanceType: body.maintenanceType, modules: body.maintenanceModules },
    });
    sendSuccess(res, updated, 'Maintenance settings updated');
  } catch (err) { next(err); }
});

// ─── Module Kill Switch ──────────────────────────────────────────────────────

router.put('/modules', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      reason: z.string().min(3),
      modules: z.record(z.boolean()),
    }).parse(req.body);

    const state = await getEmergencyState();
    const modules = { ...(state.modules as Record<string, boolean>), ...body.modules };
    const disabled = Object.entries(body.modules).filter(([, v]) => !v).map(([k]) => k);
    const updated = syncLegacyFlags({ ...state, modules, lastDisabledModules: disabled });
    await saveEmergencyState(updated);
    await logEmergencyAction(req, 'Module Kill Switch Updated', body.reason, {
      affectedScope: disabled.length ? disabled.join(', ') : 'Modules restored',
      details: body.modules as Prisma.InputJsonValue,
    });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

// ─── Payment Emergency ───────────────────────────────────────────────────────

router.put('/payment', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      reason: z.string().min(3),
      payment: z.record(z.boolean()),
    }).parse(req.body);

    const state = await getEmergencyState();
    const payment = { ...(state.payment as Record<string, boolean>), ...body.payment };
    const modules = { ...(state.modules as Record<string, boolean>) };
    if (payment.onlinePaymentDisabled) modules.onlinePayment = false;

    const updated = syncLegacyFlags({ ...state, payment, modules });
    await saveEmergencyState(updated);
    await logEmergencyAction(req, 'Payment Emergency Control Updated', body.reason, {
      affectedScope: 'Payment Module',
      details: body.payment as Prisma.InputJsonValue,
    });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

// ─── Appointment Emergency ───────────────────────────────────────────────────

router.put('/appointment', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      reason: z.string().min(3),
      appointment: z.object({
        newAppointmentsDisabled: z.boolean().optional(),
        reschedulingDisabled: z.boolean().optional(),
        cancellationDisabled: z.boolean().optional(),
        disabledOrganizationIds: z.array(z.string()).optional(),
        disabledDoctorIds: z.array(z.string()).optional(),
      }),
    }).parse(req.body);

    const state = await getEmergencyState();
    const appointment = { ...(state.appointment as Record<string, unknown>), ...body.appointment };
    const modules = { ...(state.modules as Record<string, boolean>) };
    if (appointment.newAppointmentsDisabled) modules.appointmentBooking = false;

    const updated = syncLegacyFlags({ ...state, appointment, modules });
    await saveEmergencyState(updated);
    await logEmergencyAction(req, 'Appointment Emergency Control Updated', body.reason, {
      affectedScope: 'Appointment Module',
      details: body.appointment as Prisma.InputJsonValue,
    });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

// ─── API Control ─────────────────────────────────────────────────────────────

router.put('/api', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      reason: z.string().min(3),
      api: z.record(z.union([z.boolean(), z.number()])),
    }).parse(req.body);

    const state = await getEmergencyState();
    const api = { ...(state.api as Record<string, unknown>), ...body.api };
    const updated = syncLegacyFlags({ ...state, api });
    await saveEmergencyState(updated);
    await logEmergencyAction(req, 'API Emergency Control Updated', body.reason, {
      affectedScope: 'API Layer',
      details: body.api as Prisma.InputJsonValue,
    });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

// ─── Communication Emergency ─────────────────────────────────────────────────

router.put('/communication', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      reason: z.string().min(3),
      communication: z.object({
        email: z.boolean().optional(),
        sms: z.boolean().optional(),
        whatsapp: z.boolean().optional(),
        push: z.boolean().optional(),
        queuedMessageAction: z.enum(['pause', 'cancel', 'retry_later']).optional(),
      }),
    }).parse(req.body);

    const state = await getEmergencyState();
    const communication = { ...(state.communication as Record<string, unknown>), ...body.communication };
    const modules = { ...(state.modules as Record<string, boolean>) };
    const allOff = !communication.email && !communication.sms && !communication.whatsapp && !communication.push;
    if (allOff) modules.messaging = false;

    const updated = syncLegacyFlags({ ...state, communication, modules });
    await saveEmergencyState(updated);
    await logEmergencyAction(req, 'Communication Emergency Control Updated', body.reason, {
      affectedScope: 'Communication Channels',
      details: body.communication as Prisma.InputJsonValue,
    });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

// ─── File Upload / Read-Only ─────────────────────────────────────────────────

router.put('/file-upload', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      reason: z.string().min(3),
      enabled: z.boolean(),
    }).parse(req.body);

    const state = await getEmergencyState();
    const modules = { ...(state.modules as Record<string, boolean>), fileUpload: body.enabled };
    const updated = syncLegacyFlags({ ...state, modules });
    await saveEmergencyState(updated);
    await logEmergencyAction(req, body.enabled ? 'File Upload Enabled' : 'File Upload Disabled', body.reason, {
      affectedScope: 'File Upload Module',
    });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

router.put('/read-only', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      reason: z.string().min(3),
      readOnlyMode: z.boolean(),
      password: z.string().optional(),
    }).parse(req.body);

    if (body.readOnlyMode && !(await requireSuperAdminPassword(req, body.password))) {
      res.status(403).json({ success: false, message: 'Super Admin password required for read-only mode' });
      return;
    }

    const state = await getEmergencyState();
    const updated = syncLegacyFlags({ ...state, readOnlyMode: body.readOnlyMode });
    await saveEmergencyState(updated);
    await logEmergencyAction(req, body.readOnlyMode ? 'Read-Only Mode Enabled' : 'Read-Only Mode Disabled', body.reason, {
      affectedScope: 'All Write Operations',
    });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

// ─── Recovery ────────────────────────────────────────────────────────────────

router.post('/recovery', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      reason: z.string().min(3),
      restoreAll: z.boolean().optional(),
      restoreModules: z.array(z.string()).optional(),
      keepOff: z.array(z.string()).optional(),
    }).parse(req.body);

    const state = await getEmergencyState();
    const modules = { ...(state.modules as Record<string, boolean>) };
    const toRestore = body.restoreAll ? [...MODULE_KEYS] : (body.restoreModules || []);
    const keepOff = new Set(body.keepOff || []);

    for (const key of MODULE_KEYS) {
      if (toRestore.includes(key) && !keepOff.has(key)) modules[key] = true;
      if (keepOff.has(key)) modules[key] = false;
    }

    const updated = syncLegacyFlags({
      ...state,
      emergencyModeActive: false,
      maintenanceMode: false,
      readOnlyMode: false,
      modules,
      payment: {
        ...(state.payment as Record<string, boolean>),
        onlinePaymentDisabled: keepOff.has('onlinePayment'),
        razorpayDisabled: false,
        stripeDisabled: false,
      },
      activatedBy: null,
      activatedByEmail: null,
      activatedAt: null,
      reason: '',
    });

    await saveEmergencyState(updated);
    await logEmergencyAction(req, 'Emergency Recovery', body.reason, {
      affectedScope: 'Selected Modules',
      details: { restored: toRestore, keptOff: body.keepOff } as Prisma.InputJsonValue,
    });
    sendSuccess(res, updated, 'Services restored');
  } catch (err) { next(err); }
});

// ─── Security Emergency ──────────────────────────────────────────────────────

router.post('/security/force-logout-all', async (req: AuthRequest, res, next) => {
  try {
    const { reason, confirm, password } = reasonSchema.extend({ confirm: z.literal(true) }).parse(req.body);
    if (req.user?.role !== 'SUPER_ADMIN' || !(await requireSuperAdminPassword(req, password))) {
      res.status(403).json({ success: false, message: 'Super Admin password required' });
      return;
    }
    const result = await prisma.refreshToken.deleteMany({});
    await logEmergencyAction(req, 'Force Logout All Users', reason, {
      affectedScope: 'All Users',
      details: { sessionsRevoked: result.count },
    });
    sendSuccess(res, { sessionsRevoked: result.count }, 'All user sessions revoked');
  } catch (err) { next(err); }
});

router.post('/security/force-logout-admins', async (req: AuthRequest, res, next) => {
  try {
    const { reason, password } = reasonSchema.parse(req.body);
    if (!(await requireSuperAdminPassword(req, password))) {
      res.status(403).json({ success: false, message: 'Super Admin password required' });
      return;
    }
    const admins = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'PLATFORM_STAFF'] } },
      select: { id: true },
    });
    const result = await prisma.refreshToken.deleteMany({
      where: { userId: { in: admins.map((a) => a.id) } },
    });
    await logEmergencyAction(req, 'Force Logout All Admins', reason, {
      affectedScope: 'Admin Users',
      details: { sessionsRevoked: result.count },
    });
    sendSuccess(res, { sessionsRevoked: result.count });
  } catch (err) { next(err); }
});

router.put('/security', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      reason: z.string().min(3),
      security: z.object({
        disableNewRegistrations: z.boolean().optional(),
        disableApiAccess: z.boolean().optional(),
        require2fa: z.boolean().optional(),
        blockedIps: z.array(z.string()).optional(),
      }),
      password: z.string().optional(),
    }).parse(req.body);

    if (body.security.disableApiAccess && !(await requireSuperAdminPassword(req, body.password))) {
      res.status(403).json({ success: false, message: 'Super Admin password required to disable API access' });
      return;
    }

    const state = await getEmergencyState();
    const security = { ...(state.security as Record<string, unknown>), ...body.security };
    const modules = { ...(state.modules as Record<string, boolean>) };
    if (body.security.disableNewRegistrations) {
      modules.patientRegistration = false;
      modules.hospitalRegistration = false;
      modules.clinicRegistration = false;
      modules.doctorRegistration = false;
    }

    const updated = syncLegacyFlags({ ...state, security, modules });
    await saveEmergencyState(updated);
    await logEmergencyAction(req, 'Security Emergency Updated', body.reason, {
      affectedScope: 'Security Layer',
      details: body.security as Prisma.InputJsonValue,
    });
    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

// ─── User Access Control ─────────────────────────────────────────────────────

router.post('/users/:userId/block', async (req: AuthRequest, res, next) => {
  try {
    const userId = paramId(req.params.userId);
    const { reason } = reasonSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await logEmergencyAction(req, 'User Account Blocked', reason, {
      affectedScope: user.email,
      details: { userId },
    });
    sendSuccess(res, user, 'User blocked and sessions revoked');
  } catch (err) { next(err); }
});

router.post('/users/:userId/unblock', async (req: AuthRequest, res, next) => {
  try {
    const userId = paramId(req.params.userId);
    const { reason } = reasonSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: userId }, data: { isActive: true } });
    await logEmergencyAction(req, 'User Account Unblocked', reason, { affectedScope: user.email });
    sendSuccess(res, user);
  } catch (err) { next(err); }
});

router.post('/users/:userId/force-logout', async (req: AuthRequest, res, next) => {
  try {
    const userId = paramId(req.params.userId);
    const { reason } = reasonSchema.parse(req.body);
    const result = await prisma.refreshToken.deleteMany({ where: { userId } });
    await logEmergencyAction(req, 'User Force Logout', reason, { affectedScope: userId });
    sendSuccess(res, { sessionsRevoked: result.count });
  } catch (err) { next(err); }
});

router.get('/users/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '');
    const users = await prisma.user.findMany({
      where: q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : undefined,
      take: 20,
      select: { id: true, email: true, role: true, isActive: true, lastLoginAt: true },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, users);
  } catch (err) { next(err); }
});

// ─── Suspensions ─────────────────────────────────────────────────────────────

router.get('/suspensions', async (req, res, next) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const suspensions = await prisma.emergencySuspension.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { suspendedAt: 'desc' },
      take: 100,
    });
    sendSuccess(res, suspensions);
  } catch (err) { next(err); }
});

router.post('/suspensions', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      type: z.enum(['ORGANIZATION', 'DOCTOR', 'USER']),
      targetId: z.string(),
      reason: z.enum(['SECURITY_ISSUE', 'VERIFICATION_ISSUE', 'POLICY_VIOLATION', 'FRAUD_SUSPICION', 'TECHNICAL_ISSUE', 'OTHER']),
      reasonNotes: z.string().min(3),
      effects: z.record(z.boolean()).optional(),
      appointmentResolution: z.enum(['reassign', 'cancel', 'reschedule', 'none']).optional(),
    }).parse(req.body);

    let targetName = body.targetId;
    if (body.type === 'ORGANIZATION') {
      const org = await prisma.organization.findUnique({ where: { id: body.targetId } });
      targetName = org?.name || body.targetId;
      await prisma.organization.update({ where: { id: body.targetId }, data: { isActive: false, verificationStatus: 'SUSPENDED' } });
    } else if (body.type === 'DOCTOR') {
      const doc = await prisma.doctor.findUnique({ where: { id: body.targetId } });
      targetName = doc?.fullName || body.targetId;
      await prisma.doctor.update({ where: { id: body.targetId }, data: { isActive: false } });
    } else {
      const user = await prisma.user.findUnique({ where: { id: body.targetId } });
      targetName = user?.email || body.targetId;
      await prisma.user.update({ where: { id: body.targetId }, data: { isActive: false } });
      await prisma.refreshToken.deleteMany({ where: { userId: body.targetId } });
    }

    const suspension = await prisma.emergencySuspension.create({
      data: {
        type: body.type,
        targetId: body.targetId,
        targetName,
        reason: body.reason,
        reasonNotes: body.reasonNotes,
        effects: (body.effects || { stopBookings: true, hideFromSearch: true }) as Prisma.InputJsonValue,
        appointmentResolution: body.appointmentResolution,
        suspendedById: req.user?.userId,
        suspendedByEmail: req.user?.email,
      },
    });

    await logEmergencyAction(req, `${body.type} Emergency Suspension`, body.reasonNotes, {
      affectedScope: targetName,
      details: { suspensionId: suspension.id, type: body.type },
    });

    sendSuccess(res, suspension, 'Emergency suspension applied');
  } catch (err) { next(err); }
});

router.post('/suspensions/:id/lift', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { reason } = reasonSchema.parse(req.body);
    const suspension = await prisma.emergencySuspension.findUnique({ where: { id } });
    if (!suspension) { res.status(404).json({ success: false, message: 'Not found' }); return; }

    if (suspension.type === 'ORGANIZATION') {
      await prisma.organization.update({ where: { id: suspension.targetId }, data: { isActive: true } });
    } else if (suspension.type === 'DOCTOR') {
      await prisma.doctor.update({ where: { id: suspension.targetId }, data: { isActive: true } });
    } else {
      await prisma.user.update({ where: { id: suspension.targetId }, data: { isActive: true } });
    }

    const updated = await prisma.emergencySuspension.update({
      where: { id },
      data: { isActive: false, liftedAt: new Date(), liftedByEmail: req.user?.email },
    });

    await logEmergencyAction(req, 'Emergency Suspension Lifted', reason, {
      affectedScope: suspension.targetName || suspension.targetId,
    });

    sendSuccess(res, updated);
  } catch (err) { next(err); }
});

router.get('/organizations/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '');
    const orgs = await prisma.organization.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      take: 20,
      select: { id: true, name: true, type: true, city: true, isActive: true, verificationStatus: true },
    });
    sendSuccess(res, orgs);
  } catch (err) { next(err); }
});

router.get('/doctors/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '');
    const doctors = await prisma.doctor.findMany({
      where: q ? { fullName: { contains: q, mode: 'insensitive' } } : undefined,
      take: 20,
      select: { id: true, fullName: true, specialization: true, isActive: true, organization: { select: { name: true } } },
    });
    sendSuccess(res, doctors);
  } catch (err) { next(err); }
});

// ─── Announcements ───────────────────────────────────────────────────────────

router.get('/announcements', async (_req, res, next) => {
  try {
    const items = await prisma.emergencyAnnouncement.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    sendSuccess(res, items);
  } catch (err) { next(err); }
});

router.post('/announcements', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      title: z.string().min(1),
      message: z.string().min(1),
      severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
      affectedServices: z.array(z.string()).optional(),
      displayLocations: z.array(z.string()).optional(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
      reason: z.string().min(3),
    }).parse(req.body);

    const item = await prisma.emergencyAnnouncement.create({
      data: {
        title: body.title,
        message: body.message,
        severity: body.severity || 'WARNING',
        affectedServices: body.affectedServices || [],
        displayLocations: body.displayLocations || ['website'],
        startsAt: body.startsAt ? new Date(body.startsAt) : new Date(),
        endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
        createdByEmail: req.user?.email,
      },
    });

    await logEmergencyAction(req, 'Emergency Announcement Created', body.reason, {
      affectedScope: body.displayLocations?.join(', ') || 'website',
      details: { announcementId: item.id },
    });

    sendSuccess(res, item);
  } catch (err) { next(err); }
});

router.patch('/announcements/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const body = z.object({
      isActive: z.boolean().optional(),
      reason: z.string().min(3),
    }).parse(req.body);
    const item = await prisma.emergencyAnnouncement.update({
      where: { id },
      data: { isActive: body.isActive },
    });
    await logEmergencyAction(req, 'Emergency Announcement Updated', body.reason, { details: { id } });
    sendSuccess(res, item);
  } catch (err) { next(err); }
});

// ─── Scheduled Maintenance ───────────────────────────────────────────────────

router.get('/scheduled-maintenance', async (_req, res, next) => {
  try {
    const items = await prisma.scheduledMaintenance.findMany({ orderBy: { startAt: 'asc' } });
    sendSuccess(res, items);
  } catch (err) { next(err); }
});

router.post('/scheduled-maintenance', async (req: AuthRequest, res, next) => {
  try {
    const body = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      maintenanceType: z.enum(['full', 'partial']),
      affectedModules: z.array(z.string()).optional(),
      startAt: z.string(),
      endAt: z.string(),
      reason: z.string().min(3),
    }).parse(req.body);

    const item = await prisma.scheduledMaintenance.create({
      data: {
        title: body.title,
        description: body.description,
        maintenanceType: body.maintenanceType,
        affectedModules: body.affectedModules || [],
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        createdByEmail: req.user?.email,
      },
    });

    await logEmergencyAction(req, 'Scheduled Maintenance Created', body.reason, {
      affectedScope: body.maintenanceType === 'full' ? 'Entire Platform' : body.affectedModules?.join(', '),
      details: { maintenanceId: item.id, startAt: body.startAt, endAt: body.endAt },
    });

    sendSuccess(res, item);
  } catch (err) { next(err); }
});

router.delete('/scheduled-maintenance/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const { reason } = reasonSchema.parse(req.body);
    await prisma.scheduledMaintenance.update({ where: { id }, data: { isActive: false } });
    await logEmergencyAction(req, 'Scheduled Maintenance Cancelled', reason, { details: { id } });
    sendSuccess(res, null, 'Cancelled');
  } catch (err) { next(err); }
});

// ─── Audit Logs (immutable) ──────────────────────────────────────────────────

router.get('/logs', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const logs = await prisma.emergencyActionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    sendSuccess(res, logs);
  } catch (err) { next(err); }
});

export default router;
