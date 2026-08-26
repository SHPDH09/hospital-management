import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { hashPassword } from '../../lib/auth';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { authenticate, requireRoles, AuthRequest, CRM_ROLES, ORG_ADMIN_ROLES } from '../../middleware/auth';
import { validateBody, validateQuery } from '../../middleware/validate';
import { logCrmAudit } from '../../lib/crm-audit';
import { requireOrgId, getBranchFilter, assertOrgAdmin } from '../../lib/crm-tenant';
import { createCashfreeOrder, getCashfreeOrder, isCashfreeConfigured } from '../../lib/cashfree';
import { renewalAmountFor, generateInvoiceNumber, applySubscriptionRenewal } from '../../lib/subscription-renewal';

const router = Router();
router.use(authenticate, requireRoles(...CRM_ROLES));

const pagination = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  query: z.string().optional(),
  status: z.string().optional(),
});

// ─── Hospital Profile ────────────────────────────────────────────────────────

router.get('/profile', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        branches: { select: { id: true, name: true, isActive: true } },
        documents: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { doctors: true, staff: true, departments: true, branches: true } },
      },
    });
    if (!org) throw new AppError('Organization not found', 404);
    sendSuccess(res, org);
  } catch (err) { next(err); }
});

router.patch('/profile', validateBody(z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  aboutHospital: z.string().optional(),
  logoUrl: z.string().optional(),
  coverImageUrl: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pinCode: z.string().optional(),
  establishmentYear: z.coerce.number().optional(),
  registrationNumber: z.string().optional(),
  openingHours: z.record(z.unknown()).optional(),
  facilities: z.array(z.string()).optional(),
  galleryUrls: z.array(z.string()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
}).partial()), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const { verificationStatus: _, ...data } = req.body;
    const org = await prisma.organization.update({ where: { id: orgId }, data });
    await logCrmAudit(req, orgId, 'UPDATE', 'Organization', orgId, data);
    sendSuccess(res, org, 'Profile updated');
  } catch (err) { next(err); }
});

// ─── Branches ────────────────────────────────────────────────────────────────

router.get('/branches', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const branchFilter = await getBranchFilter(req);
    const branches = await prisma.branch.findMany({
      where: { organizationId: orgId, ...branchFilter },
      include: { _count: { select: { doctors: true, staff: true, departments: true } } },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, branches);
  } catch (err) { next(err); }
});

router.post('/branches', validateBody(z.object({
  name: z.string().min(2),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  managerName: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const branch = await prisma.branch.create({ data: { organizationId: orgId, ...req.body } });
    await logCrmAudit(req, orgId, 'CREATE', 'Branch', branch.id, req.body);
    sendSuccess(res, branch, 'Branch created', 201);
  } catch (err) { next(err); }
});

router.patch('/branches/:id', async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const branch = await prisma.branch.updateMany({
      where: { id, organizationId: orgId },
      data: req.body,
    });
    if (!branch.count) throw new AppError('Branch not found', 404);
    await logCrmAudit(req, orgId, 'UPDATE', 'Branch', id, req.body);
    sendSuccess(res, { id }, 'Branch updated');
  } catch (err) { next(err); }
});

// ─── Departments ─────────────────────────────────────────────────────────────

router.get('/departments', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const branchFilter = await getBranchFilter(req);
    const departments = await prisma.department.findMany({
      where: { organizationId: orgId, ...branchFilter },
      include: { _count: { select: { doctors: true } }, branch: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, departments);
  } catch (err) { next(err); }
});

router.post('/departments', validateBody(z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  branchId: z.string().optional(),
  headDoctorId: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const dept = await prisma.department.create({ data: { organizationId: orgId, ...req.body } });
    await logCrmAudit(req, orgId, 'CREATE', 'Department', dept.id, req.body);
    sendSuccess(res, dept, 'Department created', 201);
  } catch (err) { next(err); }
});

router.patch('/departments/:id', async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const result = await prisma.department.updateMany({
      where: { id, organizationId: orgId },
      data: req.body,
    });
    if (!result.count) throw new AppError('Department not found', 404);
    await logCrmAudit(req, orgId, 'UPDATE', 'Department', id, req.body);
    sendSuccess(res, { id }, 'Department updated');
  } catch (err) { next(err); }
});

// ─── Staff ───────────────────────────────────────────────────────────────────

router.get('/staff', validateQuery(pagination), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const { page, limit, query } = req.query as unknown as { page: number; limit: number; query?: string };
    const branchFilter = await getBranchFilter(req);
    const where = {
      organizationId: orgId,
      ...branchFilter,
      ...(query ? { fullName: { contains: query, mode: 'insensitive' as const } } : {}),
    };
    const [staff, total] = await Promise.all([
      prisma.staff.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { email: true, phone: true, isActive: true, lastLoginAt: true } }, branch: { select: { name: true } } },
        orderBy: { fullName: 'asc' },
      }),
      prisma.staff.count({ where }),
    ]);
    sendPaginated(res, staff, { page, limit, total });
  } catch (err) { next(err); }
});

router.post('/staff', validateBody(z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  role: z.enum(['BRANCH_ADMIN', 'RECEPTIONIST', 'NURSE', 'ACCOUNTANT', 'PHARMACIST', 'LAB_STAFF', 'MANAGER']),
  branchId: z.string().optional(),
  employeeId: z.string().optional(),
  department: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
    if (existing) throw new AppError('Email already registered', 409);

    const passwordHash = await hashPassword(req.body.password);
    const { email, password: _, fullName, role, branchId, employeeId, department } = req.body;

    const staff = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash, role } });
      return tx.staff.create({
        data: { userId: user.id, organizationId: orgId, fullName, role, branchId, employeeId, department },
        include: { user: { select: { email: true } } },
      });
    });
    await logCrmAudit(req, orgId, 'CREATE', 'Staff', staff.id, { fullName, role });
    sendSuccess(res, staff, 'Staff created', 201);
  } catch (err) { next(err); }
});

router.patch('/staff/:id', async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const result = await prisma.staff.updateMany({
      where: { id, organizationId: orgId },
      data: {
        ...(req.body.fullName && { fullName: req.body.fullName }),
        ...(req.body.role && { role: req.body.role }),
        ...(req.body.branchId !== undefined && { branchId: req.body.branchId }),
        ...(req.body.department !== undefined && { department: req.body.department }),
        ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
        ...(req.body.employeeId !== undefined && { employeeId: req.body.employeeId }),
      },
    });
    if (!result.count) throw new AppError('Staff not found', 404);
    await logCrmAudit(req, orgId, 'UPDATE', 'Staff', id, req.body);
    sendSuccess(res, { id }, 'Staff updated');
  } catch (err) { next(err); }
});

// ─── Services ────────────────────────────────────────────────────────────────

router.get('/services', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const services = await prisma.service.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, services);
  } catch (err) { next(err); }
});

router.post('/services', validateBody(z.object({
  name: z.string().min(2),
  category: z.string().optional(),
  description: z.string().optional(),
  price: z.number().min(0),
  duration: z.number().optional(),
  branchId: z.string().optional(),
  departmentId: z.string().optional(),
  doctorId: z.string().optional(),
  isOnline: z.boolean().optional(),
  isOffline: z.boolean().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const service = await prisma.service.create({ data: { organizationId: orgId, ...req.body } });
    await logCrmAudit(req, orgId, 'CREATE', 'Service', service.id, req.body);
    sendSuccess(res, service, 'Service created', 201);
  } catch (err) { next(err); }
});

router.patch('/services/:id', async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const result = await prisma.service.updateMany({ where: { id, organizationId: orgId }, data: req.body });
    if (!result.count) throw new AppError('Service not found', 404);
    await logCrmAudit(req, orgId, 'UPDATE', 'Service', id, req.body);
    sendSuccess(res, { id }, 'Service updated');
  } catch (err) { next(err); }
});

// ─── Health Packages ─────────────────────────────────────────────────────────

router.get('/health-packages', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const packages = await prisma.healthPackage.findMany({
      where: { organizationId: orgId },
      include: { branch: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, packages);
  } catch (err) { next(err); }
});

router.post('/health-packages', validateBody(z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  includedServices: z.array(z.string()).default([]),
  originalPrice: z.number().min(0),
  offerPrice: z.number().min(0),
  validityDays: z.number().optional(),
  branchId: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const pkg = await prisma.healthPackage.create({ data: { organizationId: orgId, ...req.body } });
    await logCrmAudit(req, orgId, 'CREATE', 'HealthPackage', pkg.id, req.body);
    sendSuccess(res, pkg, 'Package created', 201);
  } catch (err) { next(err); }
});

router.patch('/health-packages/:id', async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const result = await prisma.healthPackage.updateMany({ where: { id, organizationId: orgId }, data: req.body });
    if (!result.count) throw new AppError('Package not found', 404);
    await logCrmAudit(req, orgId, 'UPDATE', 'HealthPackage', id, req.body);
    sendSuccess(res, { id }, 'Package updated');
  } catch (err) { next(err); }
});

// ─── Leads ───────────────────────────────────────────────────────────────────

router.get('/leads', validateQuery(pagination), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const { page, limit, status } = req.query as unknown as { page: number; limit: number; status?: string };
    const where = { organizationId: orgId, ...(status ? { status: status as never } : {}) };
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { advertisement: { select: { title: true, campaignName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);
    sendPaginated(res, leads, { page, limit, total });
  } catch (err) { next(err); }
});

router.patch('/leads/:id', validateBody(z.object({
  status: z.enum(['NEW', 'CONTACTED', 'INTERESTED', 'APPOINTMENT_BOOKED', 'CONVERTED', 'LOST']).optional(),
  notes: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const lead = await prisma.lead.updateMany({ where: { id, organizationId: orgId }, data: req.body });
    if (!lead.count) throw new AppError('Lead not found', 404);
    await logCrmAudit(req, orgId, 'UPDATE', 'Lead', id, req.body);
    sendSuccess(res, { id }, 'Lead updated');
  } catch (err) { next(err); }
});

// ─── Reviews ─────────────────────────────────────────────────────────────────

router.get('/reviews', validateQuery(pagination), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const where = { organizationId: orgId };
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { patient: { select: { fullName: true } }, doctor: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.review.count({ where }),
    ]);
    sendPaginated(res, reviews, { page, limit, total });
  } catch (err) { next(err); }
});

router.patch('/reviews/:id', validateBody(z.object({
  response: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const result = await prisma.review.updateMany({ where: { id, organizationId: orgId }, data: req.body });
    if (!result.count) throw new AppError('Review not found', 404);
    await logCrmAudit(req, orgId, 'UPDATE', 'Review', id, req.body);
    sendSuccess(res, { id }, 'Response saved');
  } catch (err) { next(err); }
});

// ─── Documents ───────────────────────────────────────────────────────────────

router.get('/documents', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const docs = await prisma.document.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, docs);
  } catch (err) { next(err); }
});

router.post('/documents', validateBody(z.object({
  fileName: z.string().min(1),
  fileKey: z.string().min(1),
  mimeType: z.string().optional(),
  fileSize: z.number().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const doc = await prisma.document.create({
      data: { organizationId: orgId, ...req.body, uploadedBy: req.user!.email },
    });
    await logCrmAudit(req, orgId, 'CREATE', 'Document', doc.id, { fileName: req.body.fileName });
    sendSuccess(res, doc, 'Document uploaded', 201);
  } catch (err) { next(err); }
});

// ─── Advertisements ──────────────────────────────────────────────────────────

router.get('/advertisements', validateQuery(pagination), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const where = { organizationId: orgId };
    const [ads, total] = await Promise.all([
      prisma.advertisement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.advertisement.count({ where }),
    ]);
    sendPaginated(res, ads, { page, limit, total });
  } catch (err) { next(err); }
});

router.post('/advertisements', validateBody(z.object({
  title: z.string().min(2),
  campaignName: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(['HOMEPAGE_BANNER', 'SEARCH_PROMOTION', 'FEATURED_HOSPITAL', 'FEATURED_DOCTOR', 'FEATURED_CLINIC', 'FEATURED_SERVICE', 'HEALTH_PACKAGE', 'PROMOTIONAL_CARD', 'SEARCH_AD']),
  imageUrl: z.string().optional(),
  targetUrl: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.number().optional(),
  targetCities: z.array(z.string()).optional(),
  targetStates: z.array(z.string()).optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const ad = await prisma.advertisement.create({
      data: {
        organizationId: orgId,
        ...req.body,
        status: 'PENDING',
        createdByEmail: req.user!.email,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      },
    });
    await logCrmAudit(req, orgId, 'CREATE', 'Advertisement', ad.id, req.body);
    sendSuccess(res, ad, 'Advertisement submitted for approval', 201);
  } catch (err) { next(err); }
});

router.patch('/advertisements/:id', validateBody(z.object({
  isPaused: z.boolean().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const id = paramId(req.params.id);
    const result = await prisma.advertisement.updateMany({
      where: { id, organizationId: orgId, status: { in: ['ACTIVE', 'APPROVED'] } },
      data: req.body,
    });
    if (!result.count) throw new AppError('Advertisement not found or cannot be modified', 404);
    await logCrmAudit(req, orgId, 'UPDATE', 'Advertisement', id, req.body);
    sendSuccess(res, { id }, 'Advertisement updated');
  } catch (err) { next(err); }
});

// ─── Subscription ────────────────────────────────────────────────────────────

router.get('/subscription', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        history: { take: 10, orderBy: { createdAt: 'desc' } },
        payments: { take: 20, orderBy: { createdAt: 'desc' } },
      },
    });

    let daysRemaining: number | null = null;
    let renewalAmount = 0;
    if (subscription) {
      if (subscription.endDate) {
        daysRemaining = Math.ceil((subscription.endDate.getTime() - Date.now()) / 86_400_000);
      }
      renewalAmount = renewalAmountFor(subscription.plan, subscription.billingCycle);
    }

    sendSuccess(res, {
      subscription,
      daysRemaining,
      renewalAmount,
      autoRenew: subscription?.autoRenew ?? false,
      paymentConfigured: isCashfreeConfigured(),
    });
  } catch (err) { next(err); }
});

// Toggle auto-renewal for the organization's subscription.
router.patch('/subscription/auto-renew', validateBody(z.object({ autoRenew: z.boolean() })), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const subscription = await prisma.subscription.findFirst({ where: { organizationId: orgId }, orderBy: { createdAt: 'desc' } });
    if (!subscription) throw new AppError('No subscription found', 404);
    const updated = await prisma.subscription.update({ where: { id: subscription.id }, data: { autoRenew: req.body.autoRenew } });
    await logCrmAudit(req, orgId, 'UPDATE', 'Subscription', subscription.id, { autoRenew: req.body.autoRenew });
    sendSuccess(res, { autoRenew: updated.autoRenew }, 'Auto-renewal preference updated');
  } catch (err) { next(err); }
});

// Start a renewal: creates a PENDING renewal payment and a Cashfree order.
// The subscription is only activated by the verified webhook — never here.
router.post('/subscription/renew', validateBody(z.object({ billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional() })), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    if (!isCashfreeConfigured()) throw new AppError('Payment gateway is not configured. Add Cashfree credentials to enable online renewal.', 503);

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, include: { plan: true, organization: { select: { name: true, email: true, phone: true } } },
    });
    if (!subscription) throw new AppError('No subscription found', 404);

    const cycle = req.body.billingCycle || subscription.billingCycle;
    const amount = renewalAmountFor(subscription.plan, cycle);
    if (amount <= 0) throw new AppError('This plan has no renewal price configured', 400);

    const payment = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id, organizationId: orgId, planId: subscription.planId,
        amount, currency: subscription.plan.currency || 'INR', billingCycle: cycle, status: 'PENDING',
        gateway: 'cashfree', invoiceNumber: generateInvoiceNumber(),
      },
    });

    const orderId = `sub_${payment.id}`;
    const appUrl = process.env.APP_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
    const apiUrl = process.env.API_PUBLIC_URL || '';
    const order = await createCashfreeOrder({
      orderId,
      amount,
      currency: subscription.plan.currency || 'INR',
      customer: { id: orgId, email: subscription.organization.email || undefined, phone: subscription.organization.phone || undefined },
      returnUrl: `${appUrl}/crm/subscription?order_id={order_id}`,
      notifyUrl: apiUrl ? `${apiUrl}/api/v1/webhooks/cashfree` : undefined,
    });

    await prisma.subscriptionPayment.update({ where: { id: payment.id }, data: { gatewayOrderId: order.orderId } });

    sendSuccess(res, {
      paymentId: payment.id,
      orderId: order.orderId,
      paymentSessionId: order.paymentSessionId,
      amount,
      billingCycle: cycle,
      invoiceNumber: payment.invoiceNumber,
    }, 'Renewal order created. Complete payment to activate.');
  } catch (err) { next(err); }
});

// Server-side verification of a renewal (used on payment return). The
// subscription is activated only if Cashfree confirms the order is PAID.
router.post('/subscription/verify/:paymentId', async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const paymentId = paramId(req.params.paymentId);
    const payment = await prisma.subscriptionPayment.findFirst({ where: { id: paymentId, organizationId: orgId } });
    if (!payment) throw new AppError('Renewal payment not found', 404);
    if (payment.status === 'COMPLETED') return sendSuccess(res, { status: 'COMPLETED', invoiceNumber: payment.invoiceNumber }, 'Already renewed');

    const order = await getCashfreeOrder(payment.gatewayOrderId || `sub_${payment.id}`);
    if (order.orderStatus === 'PAID') {
      await applySubscriptionRenewal(payment.id, { method: 'cashfree' });
      return sendSuccess(res, { status: 'COMPLETED', invoiceNumber: payment.invoiceNumber }, 'Subscription renewed');
    }
    sendSuccess(res, { status: order.orderStatus }, 'Payment not completed yet');
  } catch (err) { next(err); }
});

// ─── Support Tickets ─────────────────────────────────────────────────────────

router.get('/support', validateQuery(pagination), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const where = { organizationId: orgId };
    const [tickets, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { category: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.complaint.count({ where }),
    ]);
    sendPaginated(res, tickets, { page, limit, total });
  } catch (err) { next(err); }
});

router.post('/support', validateBody(z.object({
  subject: z.string().min(3),
  description: z.string().min(10),
  categoryId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const ticket = await prisma.complaint.create({
      data: {
        ticketId,
        kind: 'SUPPORT_REQUEST',
        type: 'HOSPITAL',
        complainantType: 'HOSPITAL',
        organizationId: orgId,
        userId: req.user!.userId,
        subject: req.body.subject,
        description: req.body.description,
        categoryId: req.body.categoryId,
        priority: req.body.priority || 'MEDIUM',
      },
    });
    await logCrmAudit(req, orgId, 'CREATE', 'SupportTicket', ticket.id, { subject: req.body.subject });
    sendSuccess(res, ticket, 'Ticket created', 201);
  } catch (err) { next(err); }
});

// ─── Notifications ───────────────────────────────────────────────────────────

router.get('/notifications', async (req: AuthRequest, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    sendSuccess(res, notifications);
  } catch (err) { next(err); }
});

router.patch('/notifications/:id/read', async (req: AuthRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: paramId(req.params.id), userId: req.user!.userId },
      data: { isRead: true },
    });
    sendSuccess(res, null, 'Marked as read');
  } catch (err) { next(err); }
});

// ─── Analytics ───────────────────────────────────────────────────────────────

router.get('/analytics', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const [
      totalPatients, newPatientsMonth, returningPatients,
      totalAppointments, completedAppointments, cancelledAppointments, noShowAppointments,
      dailyRevenue, weeklyRevenue, monthlyRevenue,
      doctorStats, adStats, leadStats,
    ] = await Promise.all([
      prisma.patientOrganization.count({ where: { organizationId: orgId } }),
      prisma.patientOrganization.count({ where: { organizationId: orgId, createdAt: { gte: startOfMonth } } }),
      prisma.appointment.groupBy({
        by: ['patientId'],
        where: { organizationId: orgId, status: 'COMPLETED' },
        having: { patientId: { _count: { gt: 1 } } },
      }).then((r) => r.length),
      prisma.appointment.count({ where: { organizationId: orgId } }),
      prisma.appointment.count({ where: { organizationId: orgId, status: 'COMPLETED' } }),
      prisma.appointment.count({ where: { organizationId: orgId, status: 'CANCELLED' } }),
      prisma.appointment.count({ where: { organizationId: orgId, status: 'NO_SHOW' } }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED', bill: { organizationId: orgId, createdAt: { gte: today } } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED', bill: { organizationId: orgId, createdAt: { gte: startOfWeek } } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED', bill: { organizationId: orgId, createdAt: { gte: startOfMonth } } },
        _sum: { amount: true },
      }),
      prisma.doctor.findMany({
        where: { organizationId: orgId, isActive: true },
        select: {
          id: true, fullName: true, specialization: true,
          _count: { select: { appointments: true } },
        },
        take: 10,
        orderBy: { appointments: { _count: 'desc' } },
      }),
      prisma.advertisement.aggregate({
        where: { organizationId: orgId },
        _sum: { impressions: true, clicks: true, leads: true, appointments: true, conversions: true },
      }),
      prisma.lead.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: true,
      }),
    ]);

    sendSuccess(res, {
      patients: { total: totalPatients, newThisMonth: newPatientsMonth, returning: returningPatients },
      appointments: { total: totalAppointments, completed: completedAppointments, cancelled: cancelledAppointments, noShow: noShowAppointments },
      revenue: { daily: dailyRevenue._sum.amount || 0, weekly: weeklyRevenue._sum.amount || 0, monthly: monthlyRevenue._sum.amount || 0 },
      doctors: doctorStats,
      marketing: {
        impressions: adStats._sum.impressions || 0,
        clicks: adStats._sum.clicks || 0,
        leads: adStats._sum.leads || 0,
        appointments: adStats._sum.appointments || 0,
        conversions: adStats._sum.conversions || 0,
      },
      leadsByStatus: leadStats,
    });
  } catch (err) { next(err); }
});

// ─── Audit Logs ──────────────────────────────────────────────────────────────

router.get('/audit-logs', validateQuery(pagination), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const where = { organizationId: orgId };
    const [logs, total] = await Promise.all([
      prisma.organizationAuditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.organizationAuditLog.count({ where }),
    ]);
    sendPaginated(res, logs, { page, limit, total });
  } catch (err) { next(err); }
});

// ─── Doctor Slots / Schedule ───────────────────────────────────────────────────

router.get('/slots', validateQuery(z.object({
  doctorId: z.string(),
  date: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const { doctorId, date } = req.query as { doctorId: string; date?: string };
    const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, organizationId: orgId } });
    if (!doctor) throw new AppError('Doctor not found', 404);
    const slots = await prisma.appointmentSlot.findMany({
      where: {
        doctorId,
        ...(date ? { date: new Date(date) } : { date: { gte: new Date() } }),
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
    sendSuccess(res, slots);
  } catch (err) { next(err); }
});

router.post('/slots', validateBody(z.object({
  doctorId: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
})), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const doctor = await prisma.doctor.findFirst({ where: { id: req.body.doctorId, organizationId: orgId } });
    if (!doctor) throw new AppError('Doctor not found', 404);
    const slot = await prisma.appointmentSlot.create({
      data: { ...req.body, date: new Date(req.body.date) },
    });
    await logCrmAudit(req, orgId, 'CREATE', 'AppointmentSlot', slot.id, req.body);
    sendSuccess(res, slot, 'Slot created', 201);
  } catch (err) { next(err); }
});

// ─── Settings ────────────────────────────────────────────────────────────────

router.get('/settings', async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        openingHours: true, facilities: true, emergencyAvailable: true,
        isPubliclyListed: true, verificationStatus: true,
      },
    });
    sendSuccess(res, org);
  } catch (err) { next(err); }
});

router.patch('/settings', validateBody(z.object({
  openingHours: z.record(z.unknown()).optional(),
  facilities: z.array(z.string()).optional(),
  emergencyAvailable: z.boolean().optional(),
  isPubliclyListed: z.boolean().optional(),
}).partial()), async (req: AuthRequest, res, next) => {
  try {
    assertOrgAdmin(req);
    const orgId = await requireOrgId(req);
    const org = await prisma.organization.update({ where: { id: orgId }, data: req.body });
    await logCrmAudit(req, orgId, 'UPDATE', 'Settings', orgId, req.body);
    sendSuccess(res, org, 'Settings updated');
  } catch (err) { next(err); }
});

// ─── Communications (placeholder — log intent) ───────────────────────────────

router.post('/communications/send', validateBody(z.object({
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP']),
  recipientType: z.enum(['PATIENT', 'STAFF', 'DOCTOR']),
  recipientIds: z.array(z.string()).min(1),
  subject: z.string().optional(),
  message: z.string().min(1),
  templateKey: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await requireOrgId(req);
    await logCrmAudit(req, orgId, 'SEND', 'Communication', undefined, req.body);
    sendSuccess(res, { queued: true, messageId: crypto.randomUUID() }, 'Communication queued');
  } catch (err) { next(err); }
});

export default router;
