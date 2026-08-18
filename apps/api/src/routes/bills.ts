import { Router } from 'express';
import { z } from 'zod';
import { Payment } from '@prisma/client';
import { prisma, TransactionClient } from '../lib/prisma';
import { generateBillNumber } from '../lib/auth';
import { sendSuccess, sendPaginated, AppError } from '../lib/response';
import { paramId } from '../lib/params';
import { authenticate, requireRoles, AuthRequest, CRM_ROLES, resolveOrganizationId } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

const createBillSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  items: z.array(
    z.object({
      serviceId: z.string().uuid().optional(),
      description: z.string(),
      quantity: z.number().min(1).default(1),
      unitPrice: z.number().min(0),
    })
  ),
  tax: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  notes: z.string().optional(),
});

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.string(),
  transactionId: z.string().optional(),
});

router.get('/', authenticate, requireRoles(...CRM_ROLES, 'SUPER_ADMIN'), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await resolveOrganizationId(req);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    const where = {
      ...(orgId && { organizationId: orgId }),
      ...(status && { status: status as never }),
    };

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          patient: { select: { id: true, fullName: true } },
          items: true,
          payments: true,
        },
      }),
      prisma.bill.count({ where }),
    ]);

    sendPaginated(res, bills, { page, limit, total });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, requireRoles('HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT'), validateBody(createBillSchema), async (req: AuthRequest, res, next) => {
  try {
    const orgId = await resolveOrganizationId(req);
    if (!orgId) throw new AppError('Organization context required', 400);

    const data = req.body;
    const subtotal = data.items.reduce((sum: number, item: { quantity: number; unitPrice: number }) => sum + item.quantity * item.unitPrice, 0);
    const total = subtotal + data.tax - data.discount;

    const bill = await prisma.bill.create({
      data: {
        organizationId: orgId,
        patientId: data.patientId,
        appointmentId: data.appointmentId,
        billNumber: generateBillNumber(orgId),
        subtotal,
        tax: data.tax,
        discount: data.discount,
        total,
        status: 'PENDING',
        notes: data.notes,
        items: {
          create: data.items.map((item: { serviceId?: string; description: string; quantity: number; unitPrice: number }) => ({
            serviceId: item.serviceId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { items: true, patient: { select: { fullName: true } } },
    });

    sendSuccess(res, bill, 'Bill created', 201);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/payments', authenticate, requireRoles('HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST'), validateBody(recordPaymentSchema), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const orgId = await resolveOrganizationId(req);
    const bill = await prisma.bill.findFirst({
      where: { id, ...(orgId && { organizationId: orgId }) },
      include: { payments: true },
    });
    if (!bill) throw new AppError('Bill not found', 404);

    const paidAmount = bill.payments
      .filter((p: Payment) => p.status === 'COMPLETED')
      .reduce((sum: number, p: Payment) => sum + p.amount, 0);
    const remaining = bill.total - paidAmount;
    if (req.body.amount > remaining) throw new AppError('Payment exceeds remaining balance', 400);

    const payment = await prisma.$transaction(async (tx: TransactionClient) => {
      const p = await tx.payment.create({
        data: {
          billId: bill.id,
          amount: req.body.amount,
          method: req.body.method,
          transactionId: req.body.transactionId,
          status: 'COMPLETED',
          paidAt: new Date(),
        },
      });

      const newPaid = paidAmount + req.body.amount;
      const newStatus = newPaid >= bill.total ? 'PAID' : 'PARTIALLY_PAID';
      await tx.bill.update({ where: { id: bill.id }, data: { status: newStatus } });

      return p;
    });

    sendSuccess(res, payment, 'Payment recorded', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        patient: true,
        organization: { select: { name: true, address: true } },
        appointment: true,
      },
    });

    if (!bill) throw new AppError('Bill not found', 404);
    sendSuccess(res, bill);
  } catch (err) {
    next(err);
  }
});

export default router;
