import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { verifyCashfreeWebhook } from '../lib/cashfree';
import { applySubscriptionRenewal } from '../lib/subscription-renewal';

const router = Router();

// Cashfree payment webhook. This is the ONLY trusted source of truth for
// activating a renewal — the frontend never activates a subscription.
// The request body is verified with the Cashfree signature before use.
router.post('/cashfree', async (req, res) => {
  const signature = req.header('x-webhook-signature');
  const timestamp = req.header('x-webhook-timestamp');
  const rawBody = (req as { rawBody?: Buffer }).rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {});

  if (!verifyCashfreeWebhook(rawBody, signature, timestamp)) {
    return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
  }

  try {
    const event = (req.body ?? {}) as { type?: string; data?: { order?: { order_id?: string; order_status?: string }; payment?: Record<string, unknown> } };
    const order = event.data?.order;
    const payment = event.data?.payment;
    const orderId = order?.order_id;
    const status = String((payment?.payment_status as string) || order?.order_status || '').toUpperCase();

    if (orderId && orderId.startsWith('sub_')) {
      const paymentId = orderId.slice(4);
      if (status === 'SUCCESS' || status === 'PAID') {
        await applySubscriptionRenewal(paymentId, {
          gatewayPaymentId: payment?.cf_payment_id ? String(payment.cf_payment_id) : undefined,
          method: (payment?.payment_group as string) || (payment?.payment_method as string) || 'cashfree',
        });
      } else if (status === 'FAILED' || status === 'USER_DROPPED') {
        await prisma.subscriptionPayment.updateMany({
          where: { id: paymentId, status: 'PENDING' },
          data: { status: 'FAILED', failureReason: (payment?.payment_message as string) || 'Payment failed' },
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    // Return 500 so the gateway retries transient failures.
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Webhook processing failed' });
  }
});

export default router;
