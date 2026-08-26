import crypto from 'crypto';
import { AppError } from './response';

// Cashfree Payment Gateway client.
//
// Credentials are read ONLY from environment variables and are never logged,
// returned to the client, or persisted to the database:
//   CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV (production | sandbox)
const API_VERSION = '2023-08-01';

export function getCashfreeConfig() {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  const env = (process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
  const baseUrl = env === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  return { appId, secretKey, env, baseUrl };
}

export function isCashfreeConfigured(): boolean {
  const { appId, secretKey } = getCashfreeConfig();
  return Boolean(appId && secretKey);
}

export interface CreateOrderInput {
  orderId: string;
  amount: number;
  currency?: string;
  customer: { id: string; email?: string; phone?: string };
  returnUrl?: string;
  notifyUrl?: string;
}

export interface CashfreeOrder {
  orderId: string;
  paymentSessionId: string | null;
  orderStatus: string;
}

export async function createCashfreeOrder(input: CreateOrderInput): Promise<CashfreeOrder> {
  const { appId, secretKey, baseUrl } = getCashfreeConfig();
  if (!appId || !secretKey) throw new AppError('Payment gateway is not configured', 503);

  const res = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'x-client-id': appId,
      'x-client-secret': secretKey,
      'x-api-version': API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: Number(input.amount.toFixed(2)),
      order_currency: input.currency || 'INR',
      customer_details: {
        customer_id: input.customer.id,
        customer_email: input.customer.email || undefined,
        customer_phone: input.customer.phone || '9999999999',
      },
      order_meta: {
        return_url: input.returnUrl,
        notify_url: input.notifyUrl,
      },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    // Note: never include credentials in the error surfaced to clients/logs.
    throw new AppError((data.message as string) || 'Failed to create payment order', 502);
  }
  return {
    orderId: String(data.order_id ?? input.orderId),
    paymentSessionId: (data.payment_session_id as string) ?? null,
    orderStatus: String(data.order_status ?? 'ACTIVE'),
  };
}

export async function getCashfreeOrder(orderId: string): Promise<{ orderStatus: string; raw: Record<string, unknown> }> {
  const { appId, secretKey, baseUrl } = getCashfreeConfig();
  if (!appId || !secretKey) throw new AppError('Payment gateway is not configured', 503);

  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
    headers: { 'x-client-id': appId, 'x-client-secret': secretKey, 'x-api-version': API_VERSION },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new AppError((data.message as string) || 'Failed to fetch order', 502);
  return { orderStatus: String(data.order_status ?? 'UNKNOWN'), raw: data };
}

// Verify a Cashfree webhook: signature = base64(HMAC_SHA256(timestamp + rawBody, secretKey)).
export function verifyCashfreeWebhook(rawBody: string, signature?: string, timestamp?: string): boolean {
  const { secretKey } = getCashfreeConfig();
  if (!secretKey || !signature || !timestamp) return false;
  const expected = crypto.createHmac('sha256', secretKey).update(timestamp + rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
