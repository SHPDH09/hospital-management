import crypto from 'crypto';
import { prisma } from './prisma';

const FRONTEND_BASE = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';

export function generateReferralCode(prefix: string, name: string): string {
  const slug = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${slug}-${suffix}`;
}

export function generateAshaId(): string {
  return `AASHA-${Date.now().toString(36).toUpperCase().slice(-6)}${crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 2)}`;
}

export function generateReferralId(): string {
  return `REF-${Date.now().toString(36).toUpperCase().slice(-6)}${crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 2)}`;
}

export function buildReferralLink(code: string): string {
  return `${FRONTEND_BASE.replace(/\/$/, '')}/ref/${code}`;
}

export function buildQrCodeUrl(link: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;
}

export type CommissionRules = {
  perPatient?: number;
  treatmentCompleted?: number;
  percent?: number;
  consultation?: number;
  test?: number;
  surgery?: number;
  package?: number;
};

export function calculateCommission(rules: CommissionRules, ruleType: string, eligibleAmount: number, trigger: 'registration' | 'treatment'): number {
  switch (ruleType) {
    case 'FIXED':
      return trigger === 'registration' ? (rules.perPatient || 0) : 0;
    case 'TREATMENT_BASED':
      return trigger === 'treatment' ? (rules.treatmentCompleted || 0) : 0;
    case 'PERCENTAGE':
      return trigger === 'treatment' ? (eligibleAmount * (rules.percent || 0)) / 100 : 0;
    case 'SERVICE_BASED':
      return trigger === 'treatment' ? (rules.consultation || rules.test || 200) : 0;
    default:
      return trigger === 'treatment' ? (rules.treatmentCompleted || 200) : (rules.perPatient || 100);
  }
}

export async function ensureWallet(
  opts: { ashaProfileId?: string; referralPartnerId?: string },
) {
  const existing = await prisma.referralWallet.findFirst({ where: opts });
  if (existing) return existing;
  return prisma.referralWallet.create({ data: opts });
}
