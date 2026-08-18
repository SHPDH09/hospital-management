import { Router } from 'express';
import { z } from 'zod';
import { prisma, TransactionClient } from '../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../lib/response';
import { paramId } from '../lib/params';
import { authenticate, requireRoles, AuthRequest, CRM_ROLES, resolveOrganizationId } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const createPatientSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  emergencyContact: z.string().optional(),
  bloodGroup: z.string().optional(),
  notes: z.string().optional(),
});

router.get('/', authenticate, requireRoles(...CRM_ROLES, 'SUPER_ADMIN', 'PLATFORM_STAFF'), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await resolveOrganizationId(req);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const query = req.query.query as string | undefined;

    if (!orgId && req.user!.role !== 'SUPER_ADMIN' && req.user!.role !== 'PLATFORM_STAFF') {
      throw new AppError('Organization context required', 400);
    }

    const where = orgId
      ? {
          organizations: { some: { organizationId: orgId } },
          ...(query && {
            OR: [
              { fullName: { contains: query, mode: 'insensitive' as const } },
              { user: { email: { contains: query, mode: 'insensitive' as const } } },
              { user: { phone: { contains: query, mode: 'insensitive' as const } } },
            ],
          }),
        }
      : query
        ? {
            OR: [
              { fullName: { contains: query, mode: 'insensitive' as const } },
              { user: { email: { contains: query, mode: 'insensitive' as const } } },
            ],
          }
        : {};

    const patientInclude = {
      user: { select: { email: true, phone: true } },
      organizations: orgId ? { where: { organizationId: orgId } } : true,
      _count: { select: { appointments: true } },
      ...(orgId ? {
        referralAttributions: {
          where: { organizationId: orgId },
          select: {
            sourceType: true,
            referralDisplayName: true,
            referralDisplayId: true,
            treatmentStatus: true,
            commissionStatus: true,
            ashaProfile: { select: { ashaName: true, ashaId: true } },
            referralPartner: { select: { referralPartnerName: true, referralId: true } },
          },
        },
      } : {}),
    };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: patientInclude,
      }),
      prisma.patient.count({ where }),
    ]);

    sendPaginated(res, patients, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, requireRoles(...CRM_ROLES), validateBody(createPatientSchema), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await resolveOrganizationId(req);
    if (!orgId) throw new AppError('Organization context required', 400);

    const data = req.body;

    const patient = await prisma.$transaction(async (tx: TransactionClient) => {
      let patientRecord;

      if (data.email) {
        let user = await tx.user.findUnique({ where: { email: data.email } });
        if (user) {
          patientRecord = await tx.patient.findUnique({ where: { userId: user.id } });
        } else {
          user = await tx.user.create({
            data: {
              email: data.email,
              phone: data.phone,
              passwordHash: '$2a$12$placeholder', // patient sets password on first login
              role: 'PATIENT',
            },
          });
          patientRecord = await tx.patient.create({
            data: {
              userId: user.id,
              fullName: data.fullName,
              dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
              gender: data.gender,
              address: data.address,
              city: data.city,
              state: data.state,
              emergencyContact: data.emergencyContact,
              bloodGroup: data.bloodGroup,
            },
          });
        }
      } else {
        const tempEmail = `patient-${Date.now()}@temp.healthcare.local`;
        const user = await tx.user.create({
          data: {
            email: tempEmail,
            phone: data.phone,
            passwordHash: '$2a$12$placeholder',
            role: 'PATIENT',
          },
        });
        patientRecord = await tx.patient.create({
          data: {
            userId: user.id,
            fullName: data.fullName,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
            gender: data.gender,
            address: data.address,
            city: data.city,
            state: data.state,
            emergencyContact: data.emergencyContact,
            bloodGroup: data.bloodGroup,
          },
        });
      }

      await tx.patientOrganization.upsert({
        where: {
          patientId_organizationId: { patientId: patientRecord!.id, organizationId: orgId },
        },
        create: {
          patientId: patientRecord!.id,
          organizationId: orgId,
          notes: data.notes,
        },
        update: { notes: data.notes },
      });

      return tx.patient.findUnique({
        where: { id: patientRecord!.id },
        include: { user: { select: { email: true, phone: true } } },
      });
    });

    sendSuccess(res, patient, 'Patient created', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const orgId = await resolveOrganizationId(req);
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, phone: true } },
        organizations: orgId ? { where: { organizationId: orgId } } : true,
        appointments: {
          orderBy: { appointmentDate: 'desc' },
          take: 10,
          include: { doctor: { select: { fullName: true } } },
        },
        bills: orgId ? { where: { organizationId: orgId }, orderBy: { createdAt: 'desc' }, take: 10 } : false,
      },
    });

    if (!patient) throw new AppError('Patient not found', 404);

    if (req.user!.role === 'PATIENT') {
      const ownPatient = await prisma.patient.findUnique({ where: { userId: req.user!.userId } });
      if (ownPatient?.id !== patient.id) throw new AppError('Access denied', 403);
    }

    sendSuccess(res, patient);
  } catch (err) {
    next(err);
  }
});

export default router;
