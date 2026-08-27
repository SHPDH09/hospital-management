import { prisma } from './prisma';
import { AppError } from './response';
import { getAffiliateSettings, saveAffiliateSettings } from './meta-affiliate';

const GRAPH = 'https://graph.facebook.com/v21.0';

export interface WhatsAppCloudConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
}

export interface WhatsAppStatus {
  status: 'disconnected' | 'connected';
  phone?: string;
  name?: string;
  lastError?: string;
  mode: 'cloud';
}

export interface BulkSendResult {
  phone: string;
  success: boolean;
  error?: string;
}

export interface ContactList {
  id: string;
  name: string;
  phones: string[];
  createdAt: string;
}

async function loadConfig(): Promise<WhatsAppCloudConfig | null> {
  const settings = await getAffiliateSettings();
  const token = String(settings.whatsappAccessToken || '');
  const phoneNumberId = String(settings.whatsappPhoneNumberId || '');
  if (!token || !phoneNumberId) return null;
  return {
    accessToken: token,
    phoneNumberId,
    businessAccountId: settings.whatsappBusinessAccountId
      ? String(settings.whatsappBusinessAccountId)
      : undefined,
  };
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function parsePhoneList(input: string): string[] {
  return [...new Set(
    input.split(/[\n,;]+/).map((s) => normalizePhone(s.trim())).filter((p) => p.length >= 10),
  )];
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  const config = await loadConfig();
  if (!config) {
    return { status: 'disconnected', mode: 'cloud' };
  }

  try {
    const res = await fetch(`${GRAPH}/${config.phoneNumberId}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${config.accessToken}` },
    });
    const data = (await res.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message: string };
    };
    if (!res.ok) {
      return {
        status: 'disconnected',
        mode: 'cloud',
        lastError: data.error?.message || 'Invalid WhatsApp credentials',
      };
    }
    return {
      status: 'connected',
      mode: 'cloud',
      phone: data.display_phone_number,
      name: data.verified_name,
    };
  } catch {
    return { status: 'disconnected', mode: 'cloud', lastError: 'Could not verify WhatsApp connection' };
  }
}

export async function connectWhatsAppCloud(credentials: WhatsAppCloudConfig): Promise<WhatsAppStatus> {
  const res = await fetch(`${GRAPH}/${credentials.phoneNumberId}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${credentials.accessToken}` },
  });
  const data = (await res.json()) as {
    display_phone_number?: string;
    verified_name?: string;
    error?: { message: string };
  };
  if (!res.ok) {
    throw new AppError(data.error?.message || 'Invalid WhatsApp credentials. Check Token and Phone Number ID.', 400);
  }

  const current = await getAffiliateSettings();
  await saveAffiliateSettings({
    ...current,
    whatsappAccessToken: credentials.accessToken,
    whatsappPhoneNumberId: credentials.phoneNumberId,
    whatsappBusinessAccountId: credentials.businessAccountId || current.whatsappBusinessAccountId,
  });

  await prisma.affiliateSocialConnection.upsert({
    where: { platform: 'whatsapp' },
    create: {
      platform: 'whatsapp',
      status: 'connected',
      accountName: data.verified_name || data.display_phone_number,
      accountId: credentials.phoneNumberId,
      connectedAt: new Date(),
    },
    update: {
      status: 'connected',
      accountName: data.verified_name || data.display_phone_number,
      accountId: credentials.phoneNumberId,
      connectedAt: new Date(),
    },
  });

  return {
    status: 'connected',
    mode: 'cloud',
    phone: data.display_phone_number,
    name: data.verified_name,
  };
}

export async function disconnectWhatsAppCloud(): Promise<void> {
  const current = await getAffiliateSettings();
  await saveAffiliateSettings({
    ...current,
    whatsappAccessToken: '',
    whatsappPhoneNumberId: '',
  });
  await prisma.affiliateSocialConnection.upsert({
    where: { platform: 'whatsapp' },
    create: { platform: 'whatsapp', status: 'disconnected' },
    update: { status: 'disconnected', accountName: null, accountId: null, connectedAt: null },
  });
}

export async function sendBulkWhatsAppMessages(
  phones: string[],
  message: string,
  delayMs = 1500,
): Promise<BulkSendResult[]> {
  const config = await loadConfig();
  if (!config) {
    throw new AppError('WhatsApp is not connected. Add your Meta API credentials first.', 400);
  }
  if (!message.trim()) throw new AppError('Message is required', 400);

  const unique = [...new Set(phones.map(normalizePhone).filter((p) => p.length >= 10))];
  if (!unique.length) throw new AppError('No valid phone numbers provided', 400);

  const results: BulkSendResult[] = [];
  for (let i = 0; i < unique.length; i++) {
    const phone = unique[i];
    try {
      const res = await fetch(`${GRAPH}/${config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: message },
        }),
      });
      const data = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        results.push({ phone, success: false, error: data.error?.message || 'Send failed' });
      } else {
        results.push({ phone, success: true });
      }
    } catch (err) {
      results.push({ phone, success: false, error: err instanceof Error ? err.message : 'Send failed' });
    }
    if (i < unique.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

export async function getContactLists(): Promise<ContactList[]> {
  const settings = await getAffiliateSettings();
  return (settings.contactLists as ContactList[] | undefined) || [];
}

export async function saveContactList(name: string, phones: string[]): Promise<ContactList[]> {
  const unique = parsePhoneList(phones.join('\n'));
  if (!name.trim()) throw new AppError('List name is required', 400);
  if (!unique.length) throw new AppError('Add at least one phone number', 400);

  const settings = await getAffiliateSettings();
  const lists = (settings.contactLists as ContactList[] | undefined) || [];
  const item: ContactList = {
    id: `list_${Date.now()}`,
    name: name.trim(),
    phones: unique,
    createdAt: new Date().toISOString(),
  };
  const next = [item, ...lists];
  await saveAffiliateSettings({ ...settings, contactLists: next });
  return next;
}

export async function deleteContactList(id: string): Promise<ContactList[]> {
  const settings = await getAffiliateSettings();
  const lists = ((settings.contactLists as ContactList[] | undefined) || []).filter((l) => l.id !== id);
  await saveAffiliateSettings({ ...settings, contactLists: lists });
  return lists;
}

export function getWhatsAppSetupInfo() {
  return {
    mode: 'cloud' as const,
    setupMessage: null,
    helpUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
  };
}

// Legacy stubs — groups not supported on Cloud API (use Contact Lists instead)
export async function listWhatsAppGroups() {
  return [];
}

export async function exportGroupParticipants(_groupId: string) {
  throw new AppError('Group export is not available with WhatsApp Cloud API. Save numbers in Contact Lists instead.', 400);
}

export async function createWhatsAppGroup(_name: string, _phones: string[]) {
  throw new AppError('Auto group create is not available with WhatsApp Cloud API. Create groups manually in WhatsApp app.', 400);
}

export async function startWhatsAppConnection() {
  throw new AppError('Use Save & Connect with your Meta API credentials instead of QR login.', 400);
}
