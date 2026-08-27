import { BillingCycle } from '@prisma/client';
import { prisma } from './prisma';
import { mergeWithDefaults, settingsKey } from './settings';

export interface SubscriptionTaxBreakdown {
  subtotal: number;
  taxRate: number;
  taxName: string;
  taxAmount: number;
  total: number;
  currency: string;
  billingCycle: BillingCycle;
}

export async function getSubscriptionTaxRate(): Promise<{ rate: number; name: string; enabled: boolean }> {
  const row = await prisma.platformSetting.findUnique({ where: { key: settingsKey('currency-tax') } });
  const settings = mergeWithDefaults('currency-tax', row?.value as Record<string, unknown> | null);
  return {
    rate: Number(settings.taxPercentage) || 18,
    name: String(settings.taxName || 'GST'),
    enabled: settings.taxEnabled !== false,
  };
}

export function calculateSubscriptionTotal(
  subtotal: number,
  taxRate: number,
  taxName = 'GST',
  taxEnabled = true,
): SubscriptionTaxBreakdown {
  const base = Number(subtotal.toFixed(2));
  const taxAmount = taxEnabled ? Number((base * taxRate / 100).toFixed(2)) : 0;
  const total = Number((base + taxAmount).toFixed(2));
  return {
    subtotal: base,
    taxRate: taxEnabled ? taxRate : 0,
    taxName,
    taxAmount,
    total,
    currency: 'INR',
    billingCycle: 'MONTHLY',
  };
}

export function yearlySavingsPercent(monthly: number, yearly: number): number {
  if (monthly <= 0 || yearly <= 0) return 0;
  const fullYearMonthly = monthly * 12;
  return Math.round(((fullYearMonthly - yearly) / fullYearMonthly) * 100);
}
