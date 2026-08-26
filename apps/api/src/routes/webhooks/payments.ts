import { Router, raw } from 'express';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../lib/response';
import { mergeWithDefaults, settingsKey } from '../../lib/settings';
import { emitAutomationEvent } from '../../services/automation/engine';

const router = Router();

async function getPaymentSettings() {
  const row = await prisma.platformSetting.findUnique({ where: { key: settingsKey('payment') } });
  return mergeWithDefaults('payment', row?.value as Record<string, unknown> | null) as {
    razorpay?: { webhookSecret?: string };
    stripe?: { webhookSecret?: string };
  };
}

function verifyRazorpaySignature(body: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

router.post('/razorpay', raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const settings = await getPaymentSettings();
    const secret = settings.razorpay?.webhookSecret;
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = req.body as Buffer;

    if (secret && signature) {
      if (!verifyRazorpaySignature(rawBody.toString(), signature, secret)) {
        res.status(400).json({ error: 'Invalid signature' });
        return;
      }
    }

    const event = JSON.parse(rawBody.toString());
    const paymentEntity = event?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id as string | undefined;
    const paymentId = paymentEntity?.id as string | undefined;
    const status = paymentEntity?.status as string | undefined;

    if (orderId && paymentId) {
      const payment = await prisma.payment.findFirst({ where: { gatewayOrderId: orderId } });
      if (payment) {
        const mapped = status === 'captured' ? 'CAPTURED' : status === 'failed' ? 'FAILED' : 'PROCESSING';
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: mapped,
            gatewayPaymentId: paymentId,
            webhookVerified: true,
            capturedAt: status === 'captured' ? new Date() : undefined,
            paidAt: status === 'captured' ? new Date() : undefined,
          },
        });
        if (status === 'captured') {
          await emitAutomationEvent('payment.completed', 'payment', payment.id, { billId: payment.billId });
        }
      }
    }

    sendSuccess(res, { received: true });
  } catch (err) { next(err); }
});

router.post('/stripe', raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const event = JSON.parse((req.body as Buffer).toString());
    const intent = event?.data?.object;
    if (event?.type === 'payment_intent.succeeded' && intent?.id) {
      const payment = await prisma.payment.findFirst({ where: { gatewayPaymentId: intent.id } });
      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'CAPTURED', webhookVerified: true, capturedAt: new Date(), paidAt: new Date() },
        });
        await emitAutomationEvent('payment.completed', 'payment', payment.id, { billId: payment.billId });
      }
    }
    sendSuccess(res, { received: true });
  } catch (err) { next(err); }
});

export default router;
