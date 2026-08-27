import { prisma } from './prisma';
import { Prisma } from '@prisma/client';
import { AppError } from './response';
import { getAppUrl } from './app-url';

const META_GRAPH = 'https://graph.facebook.com/v19.0';

export type SocialPlatform = 'facebook' | 'instagram';

export interface SocialConnectionInfo {
  platform: SocialPlatform;
  status: 'disconnected' | 'connected';
  accountName?: string;
  accountId?: string;
  profilePicture?: string;
  connectedAt?: string;
  connectedByEmail?: string;
}

async function getSettings() {
  const row = await prisma.platformSetting.findUnique({ where: { key: 'settings.affiliate' } });
  const value = (row?.value || {}) as Record<string, unknown>;
  return {
    metaAppId: String(value.metaAppId || process.env.META_APP_ID || ''),
    metaAppSecret: String(value.metaAppSecret || process.env.META_APP_SECRET || ''),
  };
}

export async function getSocialConnection(platform: SocialPlatform): Promise<SocialConnectionInfo> {
  const conn = await prisma.affiliateSocialConnection.findUnique({ where: { platform } });
  if (!conn || conn.status !== 'connected') {
    return { platform, status: 'disconnected' };
  }
  return {
    platform,
    status: 'connected',
    accountName: conn.accountName || undefined,
    accountId: conn.accountId || undefined,
    profilePicture: conn.profilePicture || undefined,
    connectedAt: conn.connectedAt?.toISOString(),
    connectedByEmail: conn.connectedByEmail || undefined,
  };
}

export async function getMetaAuthUrl(platform: SocialPlatform, state: string): Promise<string> {
  const { metaAppId } = await getSettings();
  if (!metaAppId) {
    throw new AppError('Meta App ID is not configured. Add it in Affiliate Marketing → Settings.', 400);
  }

  const redirectUri = `${getAppUrl()}/api/v1/affiliate-oauth/${platform}/callback`;
  const scope = platform === 'instagram'
    ? 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement'
    : 'pages_manage_posts,pages_read_engagement,pages_show_list,business_management';

  const params = new URLSearchParams({
    client_id: metaAppId,
    redirect_uri: redirectUri,
    scope,
    response_type: 'code',
    state,
  });

  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
}

export async function handleMetaCallback(
  platform: SocialPlatform,
  code: string,
  connectedByEmail?: string,
): Promise<SocialConnectionInfo> {
  const { metaAppId, metaAppSecret } = await getSettings();
  if (!metaAppId || !metaAppSecret) {
    throw new AppError('Meta App credentials are not configured', 400);
  }

  const redirectUri = `${getAppUrl()}/api/v1/affiliate-oauth/${platform}/callback`;
  const tokenRes = await fetch(
    `${META_GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id: metaAppId,
      client_secret: metaAppSecret,
      redirect_uri: redirectUri,
      code,
    })}`,
  );
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: { message: string } };
  if (!tokenData.access_token) {
    throw new AppError(tokenData.error?.message || 'Failed to obtain Meta access token', 502);
  }

  const profileRes = await fetch(
    `${META_GRAPH}/me?fields=id,name,picture&access_token=${tokenData.access_token}`,
  );
  const profile = (await profileRes.json()) as { id?: string; name?: string; picture?: { data?: { url?: string } } };

  const conn = await prisma.affiliateSocialConnection.upsert({
    where: { platform },
    create: {
      platform,
      status: 'connected',
      accountId: profile.id,
      accountName: profile.name,
      profilePicture: profile.picture?.data?.url,
      accessToken: tokenData.access_token,
      connectedByEmail,
      connectedAt: new Date(),
    },
    update: {
      status: 'connected',
      accountId: profile.id,
      accountName: profile.name,
      profilePicture: profile.picture?.data?.url,
      accessToken: tokenData.access_token,
      connectedByEmail,
      connectedAt: new Date(),
    },
  });

  return {
    platform,
    status: 'connected',
    accountName: conn.accountName || undefined,
    accountId: conn.accountId || undefined,
    profilePicture: conn.profilePicture || undefined,
    connectedAt: conn.connectedAt?.toISOString(),
    connectedByEmail: conn.connectedByEmail || undefined,
  };
}

export async function disconnectSocial(platform: SocialPlatform): Promise<void> {
  await prisma.affiliateSocialConnection.upsert({
    where: { platform },
    create: { platform, status: 'disconnected' },
    update: {
      status: 'disconnected',
      accountName: null,
      accountId: null,
      profilePicture: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      connectedAt: null,
    },
  });
}

export async function saveAffiliateSettings(body: Record<string, unknown>) {
  await prisma.platformSetting.upsert({
    where: { key: 'settings.affiliate' },
    update: { value: body as Prisma.InputJsonValue, category: 'settings' },
    create: { key: 'settings.affiliate', value: body as Prisma.InputJsonValue, category: 'settings' },
  });
}

export async function getAffiliateSettings() {
  const row = await prisma.platformSetting.findUnique({ where: { key: 'settings.affiliate' } });
  return (row?.value || {}) as Record<string, unknown>;
}
