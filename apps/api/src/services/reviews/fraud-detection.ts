import { prisma } from '../../lib/prisma';
import { aiComplete, isAiFeatureEnabled } from '../ai';

export interface FraudFlag {
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  entityType: string;
  entityId: string;
  message: string;
  details?: Record<string, unknown>;
}

export async function detectReviewFraud(): Promise<{ flags: FraudFlag[]; insight?: string }> {
  const flags: FraudFlag[] = [];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const recentReviews = await prisma.review.findMany({
    where: { createdAt: { gte: weekAgo } },
    include: {
      patient: { select: { fullName: true, userId: true } },
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const byPatient = new Map<string, typeof recentReviews>();
  for (const r of recentReviews) {
    const list = byPatient.get(r.patientId) || [];
    list.push(r);
    byPatient.set(r.patientId, list);
  }

  for (const [patientId, reviews] of byPatient) {
    if (reviews.length >= 5) {
      flags.push({
        type: 'review_velocity',
        severity: 'HIGH',
        entityType: 'Patient',
        entityId: patientId,
        message: `Patient ${reviews[0].patient.fullName} posted ${reviews.length} reviews in 7 days.`,
        details: { count: reviews.length },
      });
    }

    const allFiveStar = reviews.length >= 3 && reviews.every((r) => r.rating === 5);
    const sameOrg = reviews.length >= 3 && new Set(reviews.map((r) => r.organizationId)).size === 1;
    if (allFiveStar && sameOrg) {
      flags.push({
        type: 'suspicious_pattern',
        severity: 'MEDIUM',
        entityType: 'Patient',
        entityId: patientId,
        message: `Multiple 5-star reviews for same provider by ${reviews[0].patient.fullName}.`,
      });
    }
  }

  const duplicateComments = new Map<string, typeof recentReviews>();
  for (const r of recentReviews) {
    if (!r.comment || r.comment.length < 20) continue;
    const normalized = r.comment.toLowerCase().replace(/\s+/g, ' ').trim();
    const list = duplicateComments.get(normalized) || [];
    list.push(r);
    duplicateComments.set(normalized, list);
  }

  for (const [comment, reviews] of duplicateComments) {
    if (reviews.length >= 2 && new Set(reviews.map((r) => r.patientId)).size >= 2) {
      flags.push({
        type: 'duplicate_review_text',
        severity: 'HIGH',
        entityType: 'Review',
        entityId: reviews[0].id,
        message: `Identical review text used by ${reviews.length} different patients.`,
        details: { snippet: comment.slice(0, 80) },
      });
    }
  }

  const orgBurst = await prisma.review.groupBy({
    by: ['organizationId'],
    where: { createdAt: { gte: weekAgo }, organizationId: { not: null } },
    _count: { id: true },
    having: { id: { _count: { gte: 10 } } },
  });

  for (const g of orgBurst) {
    if (!g.organizationId) continue;
    const org = await prisma.organization.findUnique({ where: { id: g.organizationId }, select: { name: true } });
    flags.push({
      type: 'review_burst',
      severity: 'MEDIUM',
      entityType: 'Organization',
      entityId: g.organizationId,
      message: `${org?.name || 'Provider'} received ${g._count.id} reviews in 7 days.`,
    });
  }

  let insight: string | undefined;
  if (await isAiFeatureEnabled('fraudDetection') && flags.length > 0) {
    const ai = await aiComplete({
      module: 'fraud',
      feature: 'review_fraud_summary',
      system: 'Summarize review fraud flags in 1-2 sentences for platform admins.',
      user: flags.map((f) => `[${f.severity}] ${f.message}`).join('\n'),
    });
    if (ai.fromAi) insight = ai.text;
  }

  return { flags: flags.slice(0, 50), insight };
}

export async function detectReferralFraud(): Promise<{ flags: FraudFlag[]; insight?: string }> {
  const flags: FraudFlag[] = [];
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const referralLeads = await prisma.lead.findMany({
    where: {
      createdAt: { gte: monthAgo },
      source: { in: ['REFERRAL', 'AASHA', 'DOCTOR_REFERRAL', 'CAMPAIGN'] },
    },
    select: { id: true, email: true, phone: true, source: true, status: true, organizationId: true, createdAt: true },
    take: 500,
  });

  const byContact = new Map<string, typeof referralLeads>();
  for (const lead of referralLeads) {
    const key = (lead.email?.toLowerCase() || lead.phone?.replace(/\D/g, '') || '').trim();
    if (!key) continue;
    const list = byContact.get(key) || [];
    list.push(lead);
    byContact.set(key, list);
  }

  for (const [contact, leads] of byContact) {
    if (leads.length >= 3) {
      flags.push({
        type: 'duplicate_referral_contact',
        severity: 'HIGH',
        entityType: 'Lead',
        entityId: leads[0].id,
        message: `Contact ${contact.slice(0, 20)}... appears in ${leads.length} referral leads.`,
        details: { leadIds: leads.map((l) => l.id) },
      });
    }
  }

  const byOrgSource = await prisma.lead.groupBy({
    by: ['organizationId', 'source'],
    where: { createdAt: { gte: monthAgo } },
    _count: { id: true },
  });

  for (const g of byOrgSource) {
    const count = g._count?.id ?? 0;
    if (count >= 50) {
      const org = await prisma.organization.findUnique({ where: { id: g.organizationId }, select: { name: true } });
      flags.push({
        type: 'referral_volume_spike',
        severity: 'MEDIUM',
        entityType: 'Organization',
        entityId: g.organizationId,
        message: `${org?.name || 'Org'} has ${count} leads from source "${g.source}" this month.`,
      });
    }
  }

  const convertedWithoutContact = referralLeads.filter(
    (l) => l.status === 'CONVERTED' && !l.email && !l.phone
  );
  if (convertedWithoutContact.length >= 3) {
    flags.push({
      type: 'ghost_conversions',
      severity: 'MEDIUM',
      entityType: 'Lead',
      entityId: convertedWithoutContact[0].id,
      message: `${convertedWithoutContact.length} referral leads marked converted without contact info.`,
    });
  }

  let insight: string | undefined;
  if (await isAiFeatureEnabled('fraudDetection') && flags.length > 0) {
    const ai = await aiComplete({
      module: 'fraud',
      feature: 'referral_fraud_summary',
      system: 'Summarize referral fraud flags in 1-2 sentences for platform admins.',
      user: flags.map((f) => `[${f.severity}] ${f.message}`).join('\n'),
    });
    if (ai.fromAi) insight = ai.text;
  }

  return { flags: flags.slice(0, 50), insight };
}

export async function getFraudDashboard() {
  const [reviews, referrals] = await Promise.all([
    detectReviewFraud(),
    detectReferralFraud(),
  ]);
  return {
    reviews,
    referrals,
    totalFlags: reviews.flags.length + referrals.flags.length,
    highSeverity: [...reviews.flags, ...referrals.flags].filter((f) => f.severity === 'HIGH').length,
  };
}
