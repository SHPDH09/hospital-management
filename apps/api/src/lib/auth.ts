import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { JwtPayload } from '@healthcare/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions);
}

export function signRefreshToken(payload: { userId: string }): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN } as SignOptions);
}

function parseDurationToMinutes(value: string): number {
  const match = /^(\d+)([smhd])$/i.exec(value.trim());
  if (!match) return 15;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') return Math.max(1, Math.round(amount / 60));
  if (unit === 'm') return amount;
  if (unit === 'h') return amount * 60;
  return amount * 24 * 60;
}

function parseDurationToDays(value: string): number {
  const match = /^(\d+)([smhd])$/i.exec(value.trim());
  if (!match) return 7;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'd') return amount;
  if (unit === 'h') return amount / 24;
  if (unit === 'm') return amount / (24 * 60);
  return amount / (24 * 60 * 60);
}

export function getTokenDurations() {
  return {
    accessLifetimeMinutes: parseDurationToMinutes(JWT_EXPIRES_IN),
    sessionLifetimeDays: parseDurationToDays(JWT_REFRESH_EXPIRES_IN),
  };
}

export function buildSessionMeta(refreshExpiresAt: Date) {
  const { accessLifetimeMinutes, sessionLifetimeDays } = getTokenDurations();
  const accessExpiresAt = new Date(Date.now() + accessLifetimeMinutes * 60 * 1000);
  return {
    accessExpiresAt: accessExpiresAt.toISOString(),
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    accessLifetimeMinutes,
    sessionLifetimeDays,
    message: `Your session stays active for ${sessionLifetimeDays} day${sessionLifetimeDays === 1 ? '' : 's'}. Access refreshes automatically every ${accessLifetimeMinutes} minute${accessLifetimeMinutes === 1 ? '' : 's'} while you are active.`,
  };
}

export function decodeAccessTokenExpiry(token: string): Date | null {
  try {
    const payload = jwt.decode(token) as { exp?: number } | null;
    if (!payload?.exp) return null;
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): { userId: string } {
  return jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string };
}

// Short-lived token granting access to the PIN-protected admin Payment console.
export function signPaymentAccessToken(userId: string): string {
  return jwt.sign({ userId, scope: 'payment-console' }, JWT_SECRET, { expiresIn: '30m' });
}

export function verifyPaymentAccessToken(token: string): { userId: string; scope: string } {
  const payload = jwt.verify(token, JWT_SECRET) as { userId: string; scope?: string };
  if (payload.scope !== 'payment-console') throw new Error('Invalid payment access token');
  return { userId: payload.userId, scope: 'payment-console' };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function generateBillNumber(orgId: string): string {
  const prefix = orgId.slice(0, 4).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  return `BILL-${prefix}-${timestamp}`;
}
