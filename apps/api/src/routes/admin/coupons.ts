import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { sendSuccess, sendPaginated, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';

const router = Router();

const couponSchema = z.object({
  code: z.string().min(3).max(32),
  discountType: z.enum(['PERCENT', 'FIXED']),
  discountValue: z.number().positive(),
  minAmount: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  usageLimit: z.number().int().positive().optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().optional(),
  platformWide: z.boolean().optional(),
  organizationId: z.string().optional(),
});

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function parseCouponData(body: z.infer<typeof couponSchema>) {
  return {
    ...body,
    code: normalizeCode(body.code),
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    platformWide: body.platformWide ?? !body.organizationId,
    organizationId: body.platformWide === false ? body.organizationId : body.organizationId || undefined,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const isActive = req.query.isActive;
    const platformWide = req.query.platformWide;

    const where = {
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
      ...(platformWide !== undefined && { platformWide: platformWide === 'true' }),
    };

    const [coupons, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { organization: { select: { id: true, name: true, type: true } } },
      }),
      prisma.coupon.count({ where }),
    ]);
    sendPaginated(res, coupons, { page, limit, total });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: { organization: { select: { id: true, name: true, type: true } } },
    });
    if (!coupon) throw new AppError('Coupon not found', 404);
    sendSuccess(res, coupon);
  } catch (err) { next(err); }
});

router.post('/', validateBody(couponSchema), async (req: AuthRequest, res, next) => {
  try {
    const data = parseCouponData(req.body);
    if (!data.platformWide && !data.organizationId) {
      throw new AppError('Organization is required for hospital-specific coupons', 400);
    }
    if (data.discountType === 'PERCENT' && data.discountValue > 100) {
      throw new AppError('Percent discount cannot exceed 100', 400);
    }

    const existing = await prisma.coupon.findUnique({ where: { code: data.code } });
    if (existing) throw new AppError('Coupon code already exists', 400);

    const coupon = await prisma.coupon.create({ data });
    await logAudit(req, 'CREATE', 'Coupon', coupon.id);
    sendSuccess(res, coupon, 'Coupon created', 201);
  } catch (err) { next(err); }
});

router.patch('/:id', validateBody(couponSchema.partial()), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new AppError('Coupon not found', 404);

    const data = { ...req.body } as z.infer<typeof couponSchema>;
    if (data.code) data.code = normalizeCode(data.code);
    if (data.expiresAt) data.expiresAt = new Date(data.expiresAt).toISOString();
    if (data.discountType === 'PERCENT' && data.discountValue && data.discountValue > 100) {
      throw new AppError('Percent discount cannot exceed 100', 400);
    }

    if (data.code && data.code !== existing.code) {
      const duplicate = await prisma.coupon.findUnique({ where: { code: data.code } });
      if (duplicate) throw new AppError('Coupon code already exists', 400);
    }

    const platformWide = data.platformWide ?? existing.platformWide;
    const organizationId = data.organizationId ?? existing.organizationId;
    if (!platformWide && !organizationId) {
      throw new AppError('Organization is required for hospital-specific coupons', 400);
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...data,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
        platformWide,
        organizationId: platformWide ? null : organizationId,
      },
      include: { organization: { select: { id: true, name: true, type: true } } },
    });
    await logAudit(req, 'UPDATE', 'Coupon', id, data);
    sendSuccess(res, coupon, 'Coupon updated');
  } catch (err) { next(err); }
});

router.patch('/:id/activate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const coupon = await prisma.coupon.update({ where: { id }, data: { isActive: true } });
    await logAudit(req, 'ACTIVATE', 'Coupon', id);
    sendSuccess(res, coupon, 'Coupon activated');
  } catch (err) { next(err); }
});

router.patch('/:id/deactivate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const coupon = await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    await logAudit(req, 'DEACTIVATE', 'Coupon', id);
    sendSuccess(res, coupon, 'Coupon deactivated');
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    await prisma.coupon.delete({ where: { id } });
    await logAudit(req, 'DELETE', 'Coupon', id);
    sendSuccess(res, null, 'Coupon deleted');
  } catch (err) { next(err); }
});

router.post('/validate', validateBody(z.object({
  code: z.string(),
  amount: z.number().positive().optional(),
  organizationId: z.string().optional(),
})), async (req, res, next) => {
  try {
    const { code, amount, organizationId } = req.body;
    const coupon = await prisma.coupon.findUnique({
      where: { code: normalizeCode(code) },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!coupon) throw new AppError('Invalid coupon code', 404);
    if (!coupon.isActive) throw new AppError('Coupon is inactive', 400);
    if (coupon.expiresAt && coupon.expiresAt < new Date()) throw new AppError('Coupon has expired', 400);
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new AppError('Coupon usage limit reached', 400);
    if (!coupon.platformWide && organizationId && coupon.organizationId !== organizationId) {
      throw new AppError('Coupon not valid for this organization', 400);
    }
    if (amount && coupon.minAmount && amount < coupon.minAmount) {
      throw new AppError(`Minimum order amount is ${coupon.minAmount}`, 400);
    }

    let discount = 0;
    if (amount) {
      discount = coupon.discountType === 'PERCENT'
        ? (amount * coupon.discountValue) / 100
        : coupon.discountValue;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) discount = coupon.maxDiscount;
      discount = Math.min(discount, amount);
    }

    sendSuccess(res, { coupon, discount, finalAmount: amount ? amount - discount : undefined });
  } catch (err) { next(err); }
});

export default router;
