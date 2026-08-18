import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { AuthRequest } from '../middleware/auth';

export async function logAdHistory(
  advertisementId: string,
  action: string,
  options?: { performedByEmail?: string; reason?: string; details?: Prisma.InputJsonValue }
) {
  await prisma.adHistory.create({
    data: {
      advertisementId,
      action,
      performedByEmail: options?.performedByEmail,
      reason: options?.reason,
      details: options?.details,
    },
  });
}

export async function syncAdStatuses() {
  const now = new Date();

  await prisma.advertisement.updateMany({
    where: {
      status: { in: ['ACTIVE', 'SCHEDULED'] },
      endDate: { lt: now },
      isPaused: false,
    },
    data: { status: 'EXPIRED' },
  });

  const toActivate = await prisma.advertisement.findMany({
    where: {
      status: { in: ['SCHEDULED', 'APPROVED'] },
      isPaused: false,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
  });

  for (const ad of toActivate) {
    await prisma.advertisement.update({ where: { id: ad.id }, data: { status: 'ACTIVE' } });
    await logAdHistory(ad.id, 'AUTO_ACTIVATED', { details: { at: now.toISOString() } });
  }

  const toSchedule = await prisma.advertisement.findMany({
    where: {
      status: 'APPROVED',
      isPaused: false,
      startDate: { gt: now },
    },
  });

  for (const ad of toSchedule) {
    await prisma.advertisement.update({ where: { id: ad.id }, data: { status: 'SCHEDULED' } });
  }
}

export async function checkAdvertiserVerified(organizationId?: string | null): Promise<boolean> {
  if (!organizationId) return true;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { verificationStatus: true, isActive: true },
  });
  return org?.verificationStatus === 'APPROVED' && org?.isActive === true;
}

export const REJECTION_REASONS = [
  'Advertisement content does not meet platform advertising requirements.',
  'Misleading or false medical claim detected.',
  'Unverified provider — organization must be verified before publishing.',
  'Inappropriate content or imagery.',
  'Invalid pricing or expired offer.',
  'Unsupported health claim.',
  'Policy violation.',
  'Landing page unavailable or invalid.',
];

export const AD_TYPE_LABELS: Record<string, string> = {
  HOMEPAGE_BANNER: 'Homepage Banner',
  FEATURED_HOSPITAL: 'Featured Hospital',
  FEATURED_CLINIC: 'Featured Clinic',
  FEATURED_DOCTOR: 'Featured Doctor',
  FEATURED_SERVICE: 'Featured Service',
  HEALTH_PACKAGE: 'Health Package',
  SEARCH_AD: 'Search Advertisement',
  SEARCH_PROMOTION: 'Search Promotion',
  PROMOTIONAL_CARD: 'Promotional Card',
};

export const CREATIVE_DIMENSIONS: Record<string, { width: number; height: number; label: string }[]> = {
  HOMEPAGE_BANNER: [
    { width: 1200, height: 400, label: 'Desktop Banner' },
    { width: 750, height: 300, label: 'Mobile Banner' },
  ],
  PROMOTIONAL_CARD: [{ width: 600, height: 600, label: 'Square Image' }],
  FEATURED_HOSPITAL: [{ width: 400, height: 300, label: 'Featured Card' }],
};
