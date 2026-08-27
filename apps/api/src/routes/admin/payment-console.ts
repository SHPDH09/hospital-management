import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { hashPassword, comparePassword, signPaymentAccessToken, verifyPaymentAccessToken } from '../../lib/auth';
import { sendSuccess, AppError } from '../../lib/response';
import { AuthRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';
import { isCashfreeConfigured, getCashfreeOrder, createCashfreeRefund } from '../../lib/cashfree';

const router = Router();

const pinSchema = z.object({ pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4-6 digits') });

// ── PIN gate ────────────────────────────────────────────────────────────────

router.get('/pin/status', async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { paymentPinHash: true } });
    sendSuccess(res, { isSet: Boolean(user?.paymentPinHash) });
  } catch (err) { next(err); }
});

router.post('/pin/setup', validateBody(pinSchema), async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { paymentPinHash: true } });
    if (user?.paymentPinHash) throw new AppError('A payment PIN is already set. Use verify or change instead.', 409);
    const paymentPinHash = await hashPassword(req.body.pin);
    await prisma.user.update({ where: { id: req.user!.userId }, data: { paymentPinHash, paymentPinSetAt: new Date() } });
    await logAudit(req, 'PAYMENT_PIN_SET', 'User', req.user!.userId);
    sendSuccess(res, { accessToken: signPaymentAccessToken(req.user!.userId) }, 'Payment PIN created');
  } catch (err) { next(err); }
});

router.post('/pin/verify', validateBody(pinSchema), async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { paymentPinHash: true } });
    if (!user?.paymentPinHash) throw new AppError('No payment PIN set up yet', 400);
    const ok = await comparePassword(req.body.pin, user.paymentPinHash);
    if (!ok) {
      await logAudit(req, 'PAYMENT_PIN_FAILED', 'User', req.user!.userId);
      throw new AppError('Incorrect PIN', 401);
    }
    sendSuccess(res, { accessToken: signPaymentAccessToken(req.user!.userId) }, 'PIN verified');
  } catch (err) { next(err); }
});

router.post('/pin/change', validateBody(z.object({ currentPin: z.string(), newPin: z.string().regex(/^\d{4,6}$/) })), async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { paymentPinHash: true } });
    if (!user?.paymentPinHash) throw new AppError('No payment PIN set up yet', 400);
    if (!(await comparePassword(req.body.currentPin, user.paymentPinHash))) throw new AppError('Current PIN is incorrect', 401);
    await prisma.user.update({ where: { id: req.user!.userId }, data: { paymentPinHash: await hashPassword(req.body.newPin), paymentPinSetAt: new Date() } });
    await logAudit(req, 'PAYMENT_PIN_CHANGED', 'User', req.user!.userId);
    sendSuccess(res, null, 'Payment PIN updated');
  } catch (err) { next(err); }
});

// Require a valid payment-console access token (issued after PIN verify/setup).
async function requirePaymentAccess(req: AuthRequest, _res: unknown, next: (err?: unknown) => void) {
  try {
    const token = req.header('x-payment-access');
    if (!token) throw new AppError('Payment console is locked. Enter your PIN.', 401);
    const payload = verifyPaymentAccessToken(token);
    if (payload.userId !== req.user!.userId) throw new AppError('Payment access token mismatch', 401);
    next();
  } catch {
    next(new AppError('Payment console is locked. Enter your PIN.', 401));
  }
}

// ── Transaction search ───────────────────────────────────────────────────────

const searchSchema = z.object({
  query: z.string().min(2),
  type: z.enum(['auto', 'phone', 'email', 'orderId', 'paymentId', 'upi', 'txn']).default('auto'),
});

router.post('/search', requirePaymentAccess, validateBody(searchSchema), async (req: AuthRequest, res, next) => {
  try {
    const { query, type } = req.body as z.infer<typeof searchSchema>;
    const q = query.trim();
    const contains = (v: string) => ({ contains: v, mode: 'insensitive' as const });

    const or: Record<string, unknown>[] = [];
    if (type === 'auto' || type === 'orderId' || type === 'txn') or.push({ gatewayOrderId: contains(q) });
    if (type === 'auto' || type === 'paymentId' || type === 'txn') or.push({ gatewayPaymentId: contains(q) });
    if (type === 'auto' || type === 'txn') or.push({ invoiceNumber: contains(q) });
    if (type === 'auto' || type === 'email') or.push({ subscription: { organization: { email: contains(q) } } });
    if (type === 'auto' || type === 'phone') or.push({ subscription: { organization: { phone: contains(q) } } });
    if (or.length === 0) or.push({ gatewayOrderId: contains(q) });

    const records = await prisma.subscriptionPayment.findMany({
      where: { OR: or },
      take: 25,
      orderBy: { createdAt: 'desc' },
      include: { subscription: { include: { organization: { select: { name: true, email: true, phone: true } }, plan: { select: { name: true } } } } },
    });

    const configured = await isCashfreeConfigured();
    const results = await Promise.all(records.map(async (r) => {
      let liveStatus: string | null = null;
      if (configured && r.gatewayOrderId) {
        try { liveStatus = (await getCashfreeOrder(r.gatewayOrderId)).orderStatus; } catch { liveStatus = null; }
      }
      return {
        id: r.id,
        source: 'subscription',
        orderId: r.gatewayOrderId,
        paymentId: r.gatewayPaymentId,
        invoiceNumber: r.invoiceNumber,
        amount: r.amount,
        currency: r.currency,
        method: r.method,
        status: r.status,
        liveStatus,
        organization: r.subscription?.organization,
        plan: r.subscription?.plan?.name,
        createdAt: r.createdAt,
        paidAt: r.paidAt,
      };
    }));

    // Direct gateway lookup when searching by an order id that isn't in our records.
    let gatewayResult: Record<string, unknown> | null = null;
    if (configured && (type === 'orderId' || type === 'auto') && results.length === 0) {
      try {
        const order = await getCashfreeOrder(q);
        gatewayResult = { orderId: q, liveStatus: order.orderStatus, raw: order.raw };
      } catch { gatewayResult = null; }
    }

    sendSuccess(res, { results, gatewayResult, paymentConfigured: configured, note: configured ? undefined : 'Cashfree not configured — showing local records only. UPI-id search requires the payment gateway.' });
  } catch (err) { next(err); }
});

// ── Refund ────────────────────────────────────────────────────────────────────

router.post('/refund', requirePaymentAccess, validateBody(z.object({
  orderId: z.string().min(3),
  amount: z.number().positive(),
  note: z.string().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    if (!await isCashfreeConfigured()) throw new AppError('Payment gateway is not configured. Add Cashfree credentials to process refunds.', 503);
    const { orderId, amount, note } = req.body;
    const refund = await createCashfreeRefund({ orderId, amount, note });
    await prisma.subscriptionPayment.updateMany({ where: { gatewayOrderId: orderId }, data: { status: 'REFUNDED', failureReason: note || 'Refunded by admin' } });
    await logAudit(req, 'PAYMENT_REFUND', 'SubscriptionPayment', orderId, { amount, note });
    sendSuccess(res, refund, 'Refund initiated');
  } catch (err) { next(err); }
});

export default router;
