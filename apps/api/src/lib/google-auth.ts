import { OAuth2Client } from 'google-auth-library';
import { prisma } from './prisma';
import { mergeWithDefaults, settingsKey } from './settings';

export type GoogleUserInfo = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  profilePhoto?: string;
};

export type GoogleAuthConfig = {
  enabled: boolean;
  clientId: string | null;
  source: 'settings' | 'env' | null;
};

let cachedClientId: string | null | undefined;

async function readSettingsClientId(): Promise<string | null> {
  try {
    const row = await prisma.platformSetting.findUnique({
      where: { key: settingsKey('api-integration') },
    });
    const settings = mergeWithDefaults('api-integration', row?.value as Record<string, unknown> | null);
    const enabled = settings.googleOAuthEnabled !== false;
    const clientId = String(settings.googleOAuthClientId || '').trim();
    if (!enabled || !clientId) return null;
    return clientId;
  } catch {
    return null;
  }
}

/** Resolve OAuth client ID: admin settings override env vars. */
export async function resolveGoogleClientId(): Promise<GoogleAuthConfig> {
  const settingsId = await readSettingsClientId();
  if (settingsId) {
    return { enabled: true, clientId: settingsId, source: 'settings' };
  }

  const envId = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  if (envId) {
    return { enabled: true, clientId: envId, source: 'env' };
  }

  return { enabled: false, clientId: null, source: null };
}

export async function getGoogleClientId(): Promise<string | null> {
  if (cachedClientId !== undefined) return cachedClientId;
  const config = await resolveGoogleClientId();
  cachedClientId = config.clientId;
  return cachedClientId;
}

export function clearGoogleClientIdCache(): void {
  cachedClientId = undefined;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserInfo> {
  const clientId = await getGoogleClientId();
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID not configured');
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();

  if (!payload?.email || !payload.sub) {
    throw new Error('Invalid Google token payload');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: Boolean(payload.email_verified),
    fullName: payload.name || payload.email.split('@')[0],
    profilePhoto: payload.picture,
  };
}

export async function isGoogleAuthConfigured(): Promise<boolean> {
  return Boolean(await getGoogleClientId());
}
