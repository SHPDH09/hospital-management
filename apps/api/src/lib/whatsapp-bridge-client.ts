import { prisma } from './prisma';
import { AppError } from './response';

export interface BridgeConfig {
  url: string;
  secret: string;
}

let cachedConfig: BridgeConfig | null = null;
let cacheExpiry = 0;

export function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export async function getBridgeConfig(): Promise<BridgeConfig | null> {
  if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig;

  const envUrl = process.env.WHATSAPP_BRIDGE_URL?.replace(/\/$/, '');
  const envSecret = process.env.WHATSAPP_BRIDGE_SECRET;
  if (envUrl && envSecret) {
    cachedConfig = { url: envUrl, secret: envSecret };
    cacheExpiry = Date.now() + 60_000;
    return cachedConfig;
  }

  const row = await prisma.platformSetting.findUnique({ where: { key: 'settings.affiliate' } });
  const settings = (row?.value || {}) as Record<string, unknown>;
  const url = String(settings.whatsappBridgeUrl || '').replace(/\/$/, '');
  const secret = String(settings.whatsappBridgeSecret || '');
  if (url && secret) {
    cachedConfig = { url, secret };
    cacheExpiry = Date.now() + 60_000;
    return cachedConfig;
  }

  return null;
}

export function invalidateBridgeConfigCache() {
  cachedConfig = null;
  cacheExpiry = 0;
}

export async function bridgeRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const config = await getBridgeConfig();
  if (!config) {
    throw new AppError(getBridgeSetupMessage(), 503);
  }

  let response: Response;
  try {
    response = await fetch(`${config.url}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Key': config.secret,
        ...(options.headers as Record<string, string>),
      },
    });
  } catch {
    throw new AppError(
      `Cannot reach WhatsApp Bridge at ${config.url}. Ensure the bridge service is running.`,
      503,
    );
  }

  const body = await response.json().catch(() => ({})) as { success?: boolean; data?: T; message?: string };
  if (!response.ok || body.success === false) {
    throw new AppError(body.message || `WhatsApp Bridge error (${response.status})`, response.status);
  }
  return body.data as T;
}

export function getBridgeSetupMessage(): string {
  if (isServerless()) {
    return [
      'WhatsApp requires a WhatsApp Bridge service on Railway/VPS.',
      'Deploy apps/whatsapp-bridge, then set WHATSAPP_BRIDGE_URL and WHATSAPP_BRIDGE_SECRET',
      'in Vercel env vars or Admin → Affiliate Marketing → Settings.',
    ].join(' ');
  }
  return 'WhatsApp is not configured. Run npm run dev:api locally, or deploy the WhatsApp Bridge service.';
}

export async function isBridgeConfigured(): Promise<boolean> {
  return Boolean(await getBridgeConfig());
}
