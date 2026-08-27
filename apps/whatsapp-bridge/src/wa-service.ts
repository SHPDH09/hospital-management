import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';

export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'qr' | 'connected';

export interface WhatsAppStatus {
  status: WhatsAppConnectionStatus;
  qrDataUrl?: string;
  phone?: string;
  name?: string;
  lastError?: string;
}

export interface WhatsAppGroupInfo {
  id: string;
  name: string;
  participantCount: number;
}

export interface WhatsAppParticipant {
  jid: string;
  phone: string;
  name?: string;
  isAdmin?: boolean;
}

interface BulkSendResult {
  phone: string;
  success: boolean;
  error?: string;
}

const SESSION_DIR = process.env.SESSION_DIR || path.join(process.cwd(), '.data', 'whatsapp-session');

let sock: Awaited<ReturnType<typeof createSocket>> | null = null;
let connectionStatus: WhatsAppConnectionStatus = 'disconnected';
let qrDataUrl: string | null = null;
let connectedPhone: string | null = null;
let connectedName: string | null = null;
let lastError: string | null = null;
let connectingPromise: Promise<void> | null = null;

function ensureSessionDir() {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function phoneToJid(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

function jidToPhone(jid: string): string {
  return jid.split('@')[0]?.replace(/:\d+$/, '') || jid;
}

async function createSocket() {
  const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
  } = await import('@whiskeysockets/baileys');

  ensureSessionDir();
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['Healthcare Affiliate Bridge', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    logger: (await import('pino')).default({ level: 'silent' }),
  });

  socket.ev.on('creds.update', saveCreds);

  socket.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connectionStatus = 'qr';
      qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 280 });
    }

    if (connection === 'open') {
      connectionStatus = 'connected';
      qrDataUrl = null;
      lastError = null;
      const user = socket.user;
      connectedPhone = user?.id ? jidToPhone(user.id) : null;
      connectedName = user?.name || user?.verifiedName || null;
    }

    if (connection === 'close') {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      connectionStatus = 'disconnected';
      connectedPhone = null;
      connectedName = null;
      sock = null;

      if (code === DisconnectReason.loggedOut) {
        lastError = 'Logged out from WhatsApp';
        try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
      } else {
        lastError = 'Connection lost. Reconnect to continue.';
      }
    }
  });

  return socket;
}

export function getWhatsAppStatus(): WhatsAppStatus {
  return {
    status: connectionStatus,
    qrDataUrl: qrDataUrl || undefined,
    phone: connectedPhone || undefined,
    name: connectedName || undefined,
    lastError: lastError || undefined,
  };
}

export async function startWhatsAppConnection(): Promise<WhatsAppStatus> {
  if (connectionStatus === 'connected' && sock) return getWhatsAppStatus();
  if (connectingPromise) {
    await connectingPromise;
    return getWhatsAppStatus();
  }

  connectingPromise = (async () => {
    try {
      connectionStatus = 'connecting';
      lastError = null;
      if (sock) {
        try { sock.end(undefined); } catch { /* ignore */ }
        sock = null;
      }
      sock = await createSocket();
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      connectionStatus = 'disconnected';
      lastError = err instanceof Error ? err.message : 'Failed to start WhatsApp connection';
      throw err;
    } finally {
      connectingPromise = null;
    }
  })();

  await connectingPromise;
  return getWhatsAppStatus();
}

export async function disconnectWhatsApp(): Promise<void> {
  if (sock) {
    try { await sock.logout(); } catch { /* ignore */ }
    try { sock.end(undefined); } catch { /* ignore */ }
  }
  sock = null;
  connectionStatus = 'disconnected';
  qrDataUrl = null;
  connectedPhone = null;
  connectedName = null;
  try { fs.rmSync(SESSION_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
}

function requireSocket() {
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp is not connected. Scan the QR code first.');
  }
  return sock;
}

export async function listWhatsAppGroups(): Promise<WhatsAppGroupInfo[]> {
  const socket = requireSocket();
  const groups = await socket.groupFetchAllParticipating();
  return Object.values(groups).map((g) => ({
    id: g.id,
    name: g.subject || 'Unnamed Group',
    participantCount: g.participants?.length || 0,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function exportGroupParticipants(groupId: string): Promise<WhatsAppParticipant[]> {
  const socket = requireSocket();
  const meta = await socket.groupMetadata(groupId);
  return meta.participants.map((p) => ({
    jid: p.id,
    phone: jidToPhone(p.id),
    name: p.id,
    isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
  }));
}

export async function createWhatsAppGroup(name: string, phones: string[]): Promise<{ groupId: string; name: string; added: number }> {
  const socket = requireSocket();
  const unique = [...new Set(phones.map(normalizePhone).filter((p) => p.length >= 10))];
  if (unique.length < 1) throw new Error('At least one valid phone number is required');

  const participants = unique.map(phoneToJid);
  const result = await socket.groupCreate(name, participants);
  return { groupId: result.id, name, added: participants.length };
}

export async function sendBulkWhatsAppMessages(phones: string[], message: string, delayMs = 2000): Promise<BulkSendResult[]> {
  const socket = requireSocket();
  const unique = [...new Set(phones.map(normalizePhone).filter((p) => p.length >= 10))];
  if (!unique.length) throw new Error('No valid phone numbers provided');
  if (!message.trim()) throw new Error('Message is required');

  const results: BulkSendResult[] = [];
  for (let i = 0; i < unique.length; i++) {
    const phone = unique[i];
    try {
      await socket.sendMessage(phoneToJid(phone), { text: message });
      results.push({ phone, success: true });
    } catch (err) {
      results.push({ phone, success: false, error: err instanceof Error ? err.message : 'Send failed' });
    }
    if (i < unique.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

export function parsePhoneList(input: string): string[] {
  return input.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}
