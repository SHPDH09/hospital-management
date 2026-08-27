import crypto from 'crypto';
import { prisma } from './prisma';
import { AppError } from './response';
import { decryptSecret, mergeWithDefaults, settingsKey } from './settings';

// Cashfree Payment Gateway client.
//
// Credentials are read from environment variables first, then from encrypted
// platform payment settings (Admin → Settings → Payment Gateway → Cashfree).
const API_VERSION = '2023-08-01';

export interface CashfreeConfig {
  appId?: string;
  secretKey?: string;
  env: string;
  baseUrl: string;
  domainWhitelisted?: boolean;
}

let cachedConfig: (CashfreeConfig & { domainWhitelisted?: boolean }) | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000;

function baseUrlForEnv(env: string): string {
  return env === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
}

function decryptIfNeeded(value: string): string {
  return value.startsWith('enc:') ? decryptSecret(value) : value;
}

function isProductionCredential(appId: string, secretKey: string): boolean {
  return secretKey.includes('_prod_') || secretKey.startsWith('cfsk_ma_prod');
}

function isSandboxCredential(appId: string, secretKey: string): boolean {
  return appId.startsWith('TEST') || secretKey.includes('_test_') || secretKey.startsWith('cfsk_ma_test');
}

async function loadCashfreeFromSettings(): Promise<{ appId?: string; secretKey?: string; env: string; domainWhitelisted: boolean }> {
  const row = await prisma.platformSetting.findUnique({ where: { key: settingsKey('payment') } });
  const payment = mergeWithDefaults('payment', row?.value as Record<string, unknown> | null);
  const cf = payment.cashfree as Record<string, unknown> | undefined;
  if (!cf?.enabled) return { env: 'sandbox', domainWhitelisted: false };

  const appId = decryptIfNeeded(typeof cf.appId === 'string' ? cf.appId : '');
  const secretKey = decryptIfNeeded(typeof cf.secretKey === 'string' ? cf.secretKey : '');
  let env = cf.testMode === false ? 'production' : 'sandbox';
  if (isProductionCredential(appId, secretKey)) env = 'production';
  if (isSandboxCredential(appId, secretKey)) env = 'sandbox';
  return {
    appId: appId || undefined,
    secretKey: secretKey || undefined,
    env,
    domainWhitelisted: cf.domainWhitelisted === true,
  };
}

export function invalidateCashfreeConfigCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}

export async function getCashfreeConfig(): Promise<CashfreeConfig> {
  const envAppId = process.env.CASHFREE_APP_ID;
  const envSecretKey = process.env.CASHFREE_SECRET_KEY;
  const envEnv = (process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
  if (envAppId && envSecretKey) {
    return { appId: envAppId, secretKey: envSecretKey, env: envEnv, baseUrl: baseUrlForEnv(envEnv) };
  }

  if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig;

  const fromDb = await loadCashfreeFromSettings();
  const env = fromDb.env || 'sandbox';
  cachedConfig = {
    appId: fromDb.appId,
    secretKey: fromDb.secretKey,
    env,
    baseUrl: baseUrlForEnv(env),
    domainWhitelisted: fromDb.domainWhitelisted,
  };
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cachedConfig;
}

export async function isCashfreeConfigured(): Promise<boolean> {
  const { appId, secretKey } = await getCashfreeConfig();
  return Boolean(appId && secretKey && !appId.startsWith('enc:') && !secretKey.startsWith('enc:'));
}

/** Verify Cashfree credentials by creating a minimal sandbox/production order. */
export async function testCashfreeConnection(): Promise<{ ok: boolean; env: string; message: string }> {
  const cfg = await getCashfreeConfig();
  if (!cfg.appId || !cfg.secretKey) {
    return { ok: false, env: cfg.env, message: 'Cashfree App ID and Secret Key are required.' };
  }
  if (cfg.appId.startsWith('enc:') || cfg.secretKey.startsWith('enc:')) {
    return { ok: false, env: cfg.env, message: 'Cashfree credentials could not be decrypted. Re-save App ID and Secret Key in settings.' };
  }
  try {
    await createCashfreeOrder({
      orderId: `cf_test_${Date.now()}`,
      amount: 1,
      customer: { id: 'connection_test', email: 'test@healthcare.platform', phone: '9999999999' },
      returnUrl: 'https://example.com/cashfree-test',
    });
    return { ok: true, env: cfg.env, message: `Cashfree ${cfg.env} credentials verified successfully.` };
  } catch (err) {
    const msg = err instanceof AppError ? err.message : 'Cashfree connection test failed';
    if (msg.toLowerCase().includes('authentication')) {
      return {
        ok: false,
        env: cfg.env,
        message: `Cashfree rejected the credentials (${cfg.env} mode). Copy App ID and Secret from your Cashfree dashboard — Sandbox keys only work when Sandbox Mode is ON.`,
      };
    }
    return { ok: false, env: cfg.env, message: msg };
  }
}

export interface CreateOrderInput {
  orderId: string;
  amount: number;
  currency?: string;
  customer: { id: string; email?: string; phone?: string };
  returnUrl?: string;
  notifyUrl?: string;
  /** When false, omits return_url so Cashfree checkout opens before domain is whitelisted. */
  includeReturnUrl?: boolean;
}

export interface CashfreeOrder {
  orderId: string;
  paymentSessionId: string | null;
  orderStatus: string;
}

export async function createCashfreeOrder(input: CreateOrderInput): Promise<CashfreeOrder> {
  const { appId, secretKey, baseUrl, domainWhitelisted } = await getCashfreeConfig();
  if (!appId || !secretKey) throw new AppError('Payment gateway is not configured', 503);

  const orderMeta: Record<string, string> = {};
  const useReturnUrl = Boolean(input.returnUrl && (domainWhitelisted || input.includeReturnUrl === true));
  if (useReturnUrl && input.returnUrl) orderMeta.return_url = input.returnUrl;
  if (input.notifyUrl) orderMeta.notify_url = input.notifyUrl;

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
      ...(Object.keys(orderMeta).length > 0 ? { order_meta: orderMeta } : {}),
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (data.message as string) || 'Failed to create payment order';
    if (msg.toLowerCase().includes('authentication')) {
      throw new AppError(
        'Cashfree authentication failed. Verify App ID and Secret Key in Admin → Settings → Payment Gateway, and ensure Sandbox Mode matches your Cashfree credentials.',
        502,
      );
    }
    throw new AppError(msg, 502);
  }
  return {
    orderId: String(data.order_id ?? input.orderId),
    paymentSessionId: (data.payment_session_id as string) ?? null,
    orderStatus: String(data.order_status ?? 'ACTIVE'),
  };
}

export async function getCashfreeOrder(orderId: string): Promise<{ orderStatus: string; raw: Record<string, unknown> }> {
  const { appId, secretKey, baseUrl } = await getCashfreeConfig();
  if (!appId || !secretKey) throw new AppError('Payment gateway is not configured', 503);

  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
    headers: { 'x-client-id': appId, 'x-client-secret': secretKey, 'x-api-version': API_VERSION },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new AppError((data.message as string) || 'Failed to fetch order', 502);
  return { orderStatus: String(data.order_status ?? 'UNKNOWN'), raw: data };
}

export async function getCashfreeOrderPayments(orderId: string): Promise<Record<string, unknown>[]> {
  const { appId, secretKey, baseUrl } = await getCashfreeConfig();
  if (!appId || !secretKey) throw new AppError('Payment gateway is not configured', 503);
  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}/payments`, {
    headers: { 'x-client-id': appId, 'x-client-secret': secretKey, 'x-api-version': API_VERSION },
  });
  const data = (await res.json().catch(() => [])) as unknown;
  if (!res.ok) throw new AppError('Failed to fetch order payments', 502);
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}

export interface RefundInput { orderId: string; amount: number; refundId?: string; note?: string }

export async function createCashfreeRefund(input: RefundInput): Promise<Record<string, unknown>> {
  const { appId, secretKey, baseUrl } = await getCashfreeConfig();
  if (!appId || !secretKey) throw new AppError('Payment gateway is not configured', 503);
  const refundId = input.refundId || `rf_${Date.now()}`;
  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(input.orderId)}/refunds`, {
    method: 'POST',
    headers: { 'x-client-id': appId, 'x-client-secret': secretKey, 'x-api-version': API_VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refund_amount: Number(input.amount.toFixed(2)), refund_id: refundId, refund_note: input.note || 'Admin initiated refund' }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new AppError((data.message as string) || 'Refund failed', 502);
  return data;
}

// Verify a Cashfree webhook: signature = base64(HMAC_SHA256(timestamp + rawBody, secretKey)).
export async function verifyCashfreeWebhook(rawBody: string, signature?: string, timestamp?: string): Promise<boolean> {
  const { secretKey } = await getCashfreeConfig();
  if (!secretKey || !signature || !timestamp) return false;
  const expected = crypto.createHmac('sha256', secretKey).update(timestamp + rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
