import { prisma } from '../../lib/prisma';
import { aiComplete, isAiFeatureEnabled } from '../ai';

export async function getCampaignAnalytics() {
  const ads = await prisma.advertisement.findMany({
    where: { status: { in: ['ACTIVE', 'APPROVED', 'EXPIRED'] } },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const leads = await prisma.lead.findMany({
    where: {
      source: { in: ['ADVERTISEMENT', 'CAMPAIGN'] },
    },
    select: { id: true, source: true, status: true, createdAt: true },
  });

  const campaigns = ads.map((ad) => {
    const relatedLeads = leads.filter((l) =>
      l.source === 'ADVERTISEMENT' || l.source === 'CAMPAIGN'
    );
    const appointments = relatedLeads.filter((l) =>
      ['APPOINTMENT_BOOKED', 'CONVERTED'].includes(l.status)
    ).length;
    const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
    const costPerLead = relatedLeads.length > 0 && ad.budget ? ad.budget / relatedLeads.length : null;
    const costPerAppointment = appointments > 0 && ad.budget ? ad.budget / appointments : null;
    const conversionRate = relatedLeads.length > 0 ? (appointments / relatedLeads.length) * 100 : 0;

    return {
      id: ad.id,
      title: ad.title,
      type: ad.type,
      status: ad.status,
      organization: ad.organization?.name,
      impressions: ad.impressions,
      clicks: ad.clicks,
      ctr: Math.round(ctr * 100) / 100,
      budget: ad.budget,
      leads: relatedLeads.length,
      appointments,
      conversionRate: Math.round(conversionRate * 100) / 100,
      costPerLead,
      costPerAppointment,
      qualityScore: conversionRate >= 20 ? 'HIGH' : conversionRate >= 10 ? 'MEDIUM' : 'LOW',
    };
  });

  campaigns.sort((a, b) => b.conversionRate - a.conversionRate);

  let insight: string | null = null;
  if (await isAiFeatureEnabled('copilot') && campaigns.length >= 2) {
    const top = campaigns[0];
    const byLeads = [...campaigns].sort((a, b) => b.leads - a.leads)[0];
    const ai = await aiComplete({
      module: 'advertisements',
      feature: 'campaign_insight',
      system: 'Compare ad campaigns using only provided metrics. One insight sentence.',
      user: `Best conversion: ${top?.title} (${top?.conversionRate}%). Most leads: ${byLeads?.title} (${byLeads?.leads} leads).`,
    });
    if (ai.fromAi) insight = ai.text;
  } else if (campaigns.length >= 2) {
    const top = campaigns[0];
    const byLeads = [...campaigns].sort((a, b) => b.leads - a.leads)[0];
    if (top && byLeads && top.id !== byLeads.id) {
      insight = `Campaign "${byLeads.title}" generates more leads, but "${top.title}" produces better appointment conversion (${top.conversionRate}%).`;
    }
  }

  return { campaigns, insight };
}
