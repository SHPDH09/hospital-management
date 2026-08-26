import { prisma } from '../../lib/prisma';
import { aiComplete, isAiFeatureEnabled } from '../ai';

const REFERRAL_SOURCES = ['REFERRAL', 'AASHA', 'DOCTOR_REFERRAL', 'CAMPAIGN'];

export async function getReferralAnalytics() {
  const leads = await prisma.lead.findMany({
    where: {
      source: { in: ['REFERRAL', 'AASHA', 'DOCTOR_REFERRAL', 'CAMPAIGN'] },
    },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const bySource: Record<string, {
    source: string;
    clicks: number;
    leads: number;
    appointments: number;
    converted: number;
    organizations: Set<string>;
  }> = {};

  for (const lead of leads) {
    const key = (lead.source || 'UNKNOWN').toUpperCase();
    if (!bySource[key]) {
      bySource[key] = { source: key, clicks: 0, leads: 0, appointments: 0, converted: 0, organizations: new Set() };
    }
    const bucket = bySource[key];
    bucket.leads += 1;
    bucket.organizations.add(lead.organization?.name || 'Unknown');
    if (lead.status === 'APPOINTMENT_BOOKED') bucket.appointments += 1;
    if (lead.status === 'CONVERTED') bucket.converted += 1;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = leads.filter((l) => l.createdAt >= monthStart).length;
  const lastMonthStart = new Date(monthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  const lastMonth = leads.filter((l) => l.createdAt >= lastMonthStart && l.createdAt < monthStart).length;
  const growthPct = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : thisMonth > 0 ? 100 : 0;

  const partners = Object.values(bySource).map((b) => ({
    source: b.source,
    leads: b.leads,
    appointments: b.appointments,
    converted: b.converted,
    conversionRate: b.leads > 0 ? Math.round((b.converted / b.leads) * 100) : 0,
    hospitals: b.organizations.size,
    performance: b.converted >= 10 ? 'HIGH' : b.leads >= 5 ? 'MEDIUM' : 'LOW',
  })).sort((a, b) => b.leads - a.leads);

  const inactive = partners.filter((p) => p.leads <= 2 && p.performance === 'LOW');

  let insight: string | null = null;
  if (await isAiFeatureEnabled('copilot')) {
    const ai = await aiComplete({
      module: 'referrals',
      feature: 'referral_insight',
      system: 'Summarize referral performance using only provided data.',
      user: `Partners: ${JSON.stringify(partners.slice(0, 5))}. Month-over-month lead growth: ${growthPct}%.`,
    });
    if (ai.fromAi) insight = ai.text;
  } else if (growthPct !== 0) {
    insight = `Referral lead volume ${growthPct > 0 ? 'increased' : 'decreased'} by ${Math.abs(growthPct)}% this month.`;
  }

  return {
    partners,
    inactivePartners: inactive,
    totals: {
      leads: leads.length,
      thisMonth,
      lastMonth,
      growthPct,
    },
    insight,
  };
}
