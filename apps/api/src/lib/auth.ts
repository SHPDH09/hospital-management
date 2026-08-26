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
