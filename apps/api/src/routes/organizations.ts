import { Router } from 'express';
import { z } from 'zod';
import { prisma, readDb, TransactionClient } from '../lib/prisma';
import { hashPassword, slugify } from '../lib/auth';
import { sendSuccess, sendPaginated, AppError } from '../lib/response';
import { paramId } from '../lib/params';
import { authenticate, requireRoles, AuthRequest, PLATFORM_ROLES, CRM_ROLES } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  ORG_BRANDING_SELECT,
  attachBrandingToOrganization,
} from '../lib/hospital-branding';

const router = Router();

const registerOrgSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['HOSPITAL', 'CLINIC', 'DIAGNOSTIC_CENTER', 'PHARMACY']),
  email: z.string().email(),
  password: z.string().min(8),
  ownerName: z.string().min(2),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pinCode: z.string().optional(),
  description: z.string().optional(),
  registrationNumber: z.string().optional(),
});

const searchQuerySchema = z.object({
  query: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  type: z.enum(['HOSPITAL', 'CLINIC', 'DIAGNOSTIC_CENTER', 'PHARMACY']).optional(),
  emergencyAvailable: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

router.post('/register', validateBody(registerOrgSchema), async (req, res, next) => {
  try {
    const data = req.body;
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already registered', 409);

    let slug = slugify(data.name);
    const slugExists = await prisma.organization.findUnique({ where: { slug } });
    if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

    const passwordHash = await hashPassword(data.password);
    const defaultPlan = await prisma.subscriptionPlan.findFirst({ where: { isDefault: true } })
      || await prisma.subscriptionPlan.findFirst({ where: { code: 'basic' } })
      || await prisma.subscriptionPlan.findFirst({ where: { code: 'starter' } });

    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const user = await tx.user.create({
        data: { email: data.email, phone: data.phone, passwordHash, role: 'HOSPITAL_ADMIN' },
      });

      const organization = await tx.organization.create({
        data: {
          name: data.name,
          slug,
          type: data.type,
          email: data.email,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          pinCode: data.pinCode,
          description: data.description,
          ownerName: data.ownerName,
          registrationNumber: data.registrationNumber,
          verificationStatus: 'PENDING',
          isPubliclyListed: false,
        },
      });

      await tx.staff.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          fullName: data.ownerName,
          role: 'HOSPITAL_ADMIN',
        },
      });

      if (defaultPlan) {
        const endDate = new Date();
        if (defaultPlan.trialDays > 0) {
          endDate.setDate(endDate.getDate() + defaultPlan.trialDays);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }
        await tx.subscription.create({
          data: {
            organizationId: organization.id,
            planId: defaultPlan.id,
            status: defaultPlan.trialDays > 0 ? 'TRIAL' : 'ACTIVE',
            billingCycle: 'MONTHLY',
            price: defaultPlan.monthlyPrice ?? defaultPlan.price,
            endDate,
            trialEndsAt: defaultPlan.trialDays > 0 ? endDate : undefined,
            changeSource: 'SYSTEM',
          },
        });
      }

      return { user, organization };
    });

    sendSuccess(res, result, 'Organization registered. Awaiting verification.', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/search', validateQuery(searchQuerySchema), async (req, res, next) => {
  try {
    const { query, city, state, type, emergencyAvailable, page, limit } = req.query as unknown as z.infer<typeof searchQuerySchema>;
    const skip = (page - 1) * limit;

    const where = {
      verificationStatus: 'APPROVED' as const,
      isActive: true,
      isPubliclyListed: true,
      ...(type && { type }),
      ...(city && { city: { contains: city, mode: 'insensitive' as const } }),
      ...(state && { state: { contains: state, mode: 'insensitive' as const } }),
      ...(emergencyAvailable && { emergencyAvailable: true }),
      ...(query && {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { description: { contains: query, mode: 'insensitive' as const } },
          { city: { contains: query, mode: 'insensitive' as const } },
        ],
      }),
    };

    const db = readDb();
    const [organizations, total] = await Promise.all([
      db.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ averageRating: 'desc' }, { name: 'asc' }],
        select: {
          ...ORG_BRANDING_SELECT,
          type: true,
          city: true,
          state: true,
          address: true,
          averageRating: true,
          reviewCount: true,
          emergencyAvailable: true,
          facilities: true,
          _count: { select: { doctors: true } },
        },
      }),
      db.organization.count({ where }),
    ]);

    const withBranding = organizations.map((org) => attachBrandingToOrganization(org));
    sendPaginated(res, withBranding, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.get('/by-id/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const org = await prisma.organization.findFirst({
      where: { id, verificationStatus: 'APPROVED', isActive: true, isPubliclyListed: true },
      include: {
        departments: { where: { isActive: true } },
        services: { where: { isActive: true } },
        doctors: {
          where: { isActive: true },
          select: {
            id: true,
            fullName: true,
            specialization: true,
            qualification: true,
            experience: true,
            consultationFee: true,
            photoUrl: true,
            averageRating: true,
            reviewCount: true,
          },
        },
      },
    });
    if (!org) throw new AppError('Organization not found', 404);
    sendSuccess(res, attachBrandingToOrganization(org));
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: req.params.slug },
      include: {
        departments: { where: { isActive: true } },
        services: { where: { isActive: true } },
        doctors: {
          where: { isActive: true },
          select: {
            id: true,
            fullName: true,
            specialization: true,
            qualification: true,
            experience: true,
            consultationFee: true,
            photoUrl: true,
            averageRating: true,
            reviewCount: true,
          },
        },
        reviews: {
          where: { isPublished: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { patient: { select: { fullName: true } } },
        },
      },
    });

    if (!org) throw new AppError('Organization not found', 404);
    if (org.verificationStatus !== 'APPROVED' && !req.headers.authorization) {
      throw new AppError('Organization not found', 404);
    }

    sendSuccess(res, attachBrandingToOrganization(org));
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, requireRoles(...PLATFORM_ROLES, ...CRM_ROLES), async (req: AuthRequest, res, next) => {
  try {
    const isPlatform = PLATFORM_ROLES.includes(req.user!.role);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const where = isPlatform
      ? {}
      : { id: req.user!.organizationId! };

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: { select: { doctors: true, appointments: true } },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    sendPaginated(res, organizations, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.patch(
  '/:id/verification',
  authenticate,
  requireRoles('SUPER_ADMIN', 'PLATFORM_STAFF'),
  async (req: AuthRequest, res, next) => {
    try {
      const { status, isPubliclyListed } = req.body;
      const validStatuses = ['APPROVED', 'REJECTED', 'SUSPENDED', 'CORRECTION_REQUESTED'];
      if (!validStatuses.includes(status)) throw new AppError('Invalid status', 400);

      const id = paramId(req.params.id);
      const org = await prisma.organization.update({
        where: { id },
        data: {
          verificationStatus: status,
          isPubliclyListed: status === 'APPROVED' ? (isPubliclyListed ?? true) : false,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'ORGANIZATION_VERIFICATION',
          entityType: 'Organization',
          entityId: org.id,
          details: { status },
        },
      });

      sendSuccess(res, org, 'Verification status updated');
    } catch (err) {
      next(err);
    }
  }
);

export default router;
