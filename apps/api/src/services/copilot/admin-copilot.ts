import { prisma } from '../../lib/prisma';
import { aiComplete, COPILOT_SYSTEM_PROMPT, isMedicalQuery, medicalSafetyResponse } from '../ai';

export interface CopilotContext {
  userId: string;
  role: string;
  organizationId?: string;
}

type QueryTemplate = {
  keywords: string[];
  run: (ctx: CopilotContext) => Promise<Record<string, unknown>>;
  format: (data: Record<string, unknown>) => string;
};

const templates: QueryTemplate[] = [
  {
    keywords: ['summary', 'today', 'platform', 'overview', 'dashboard'],
    run: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const [
        todayAppointments, todayPayments, newPatients, newLeads,
        pendingVerifications, openComplaints, failedPayments,
      ] = await Promise.all([
        prisma.appointment.count({ where: { appointmentDate: { gte: today } } }),
        prisma.payment.aggregate({ where: { status: 'COMPLETED', paidAt: { gte: today } }, _sum: { amount: true } }),
        prisma.patient.count({ where: { createdAt: { gte: today } } }),
        prisma.lead.count({ where: { createdAt: { gte: today } } }),
        prisma.organization.count({ where: { verificationStatus: 'PENDING' } }),
        prisma.complaint.count({ where: { status: { in: ['NEW', 'ASSIGNED', 'IN_PROGRESS'] } } }),
        prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: today } } }),
      ]);
      return {
        todayAppointments,
        todayRevenue: todayPayments._sum.amount || 0,
        newPatients,
        newLeads,
        pendingVerifications,
        openComplaints,
        failedPayments,
      };
    },
    format: (d) =>
      `Today's platform summary:\n• ${d.todayAppointments} appointments\n• ₹${Number(d.todayRevenue).toLocaleString('en-IN')} successful payments\n• ${d.newPatients} new patients\n• ${d.newLeads} new leads\n• ${d.pendingVerifications} pending verifications\n• ${d.openComplaints} open support tickets\n• ${d.failedPayments} failed payments today`,
  },
  {
    keywords: ['failed payment', 'payment fail', 'failed payments'],
    run: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const count = await prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: today } } });
      const recent = await prisma.payment.findMany({
        where: { status: 'FAILED', createdAt: { gte: today } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { amount: true, method: true, createdAt: true },
      });
      return { count, recent };
    },
    format: (d) => {
      const lines = (d.recent as { amount: number; method: string; createdAt: Date }[])
        .map((p) => `  - ₹${p.amount} via ${p.method}`)
        .join('\n');
      return `Failed payments today: ${d.count}\n${lines || '  No recent failures.'}`;
    },
  },
  {
    keywords: ['pending verification', 'verification', 'approve hospital'],
    run: async () => {
      const orgs = await prisma.organization.findMany({
        where: { verificationStatus: 'PENDING' },
        take: 10,
        select: { name: true, type: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      return { count: orgs.length, orgs };
    },
    format: (d) => {
      const orgs = d.orgs as { name: string; type: string }[];
      if (!orgs.length) return 'No pending verifications.';
      return `Pending verifications (${d.count}):\n${orgs.map((o) => `• ${o.name} (${o.type})`).join('\n')}`;
    },
  },
  {
    keywords: ['hospital', 'most appointment', 'top hospital'],
    run: async () => {
      const grouped = await prisma.appointment.groupBy({
        by: ['organizationId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      });
      const orgs = await prisma.organization.findMany({
        where: { id: { in: grouped.map((g) => g.organizationId) } },
        select: { id: true, name: true },
      });
      const map = Object.fromEntries(orgs.map((o) => [o.id, o.name]));
      return {
        hospitals: grouped.map((g) => ({ name: map[g.organizationId] || 'Unknown', count: g._count.id })),
      };
    },
    format: (d) => {
      const hospitals = d.hospitals as { name: string; count: number }[];
      return `Top hospitals by appointments:\n${hospitals.map((h, i) => `${i + 1}. ${h.name} — ${h.count} appointments`).join('\n')}`;
    },
  },
  {
    keywords: ['rating', 'low rating', 'below 4'],
    run: async () => {
      const orgs = await prisma.organization.findMany({
        where: { averageRating: { lt: 4, gt: 0 }, isActive: true },
        take: 10,
        select: { name: true, averageRating: true, reviewCount: true },
        orderBy: { averageRating: 'asc' },
      });
      return { orgs };
    },
    format: (d) => {
      const orgs = d.orgs as { name: string; averageRating: number; reviewCount: number }[];
      if (!orgs.length) return 'No providers with rating below 4.';
      return `Providers rated below 4:\n${orgs.map((o) => `• ${o.name} — ${o.averageRating.toFixed(1)} (${o.reviewCount} reviews)`).join('\n')}`;
    },
  },
  {
    keywords: ['subscription', 'renewal', 'expiring'],
    run: async () => {
      const weekAhead = new Date();
      weekAhead.setDate(weekAhead.getDate() + 7);
      const subs = await prisma.subscription.findMany({
        where: { status: 'ACTIVE', endDate: { lte: weekAhead, gte: new Date() } },
        include: { organization: { select: { name: true } }, plan: { select: { name: true } } },
        take: 10,
      });
      return { count: subs.length, subs };
    },
    format: (d) => {
      const subs = d.subs as { organization: { name: string }; plan: { name: string }; endDate: Date }[];
      if (!subs.length) return 'No subscriptions expiring in the next 7 days.';
      return `Subscriptions expiring this week (${d.count}):\n${subs.map((s) => `• ${s.organization.name} — ${s.plan.name}`).join('\n')}`;
    },
  },
  {
    keywords: ['hot lead', 'leads'],
    run: async () => {
      const hot = await prisma.lead.count({ where: { temperature: 'HOT' } });
      const warm = await prisma.lead.count({ where: { temperature: 'WARM' } });
      const cold = await prisma.lead.count({ where: { temperature: 'COLD' } });
      return { hot, warm, cold };
    },
    format: (d) => `Lead pipeline: ${d.hot} hot, ${d.warm} warm, ${d.cold} cold leads.`,
  },
  {
    keywords: ['payment alert', 'payment anomaly', 'payment failure'],
    run: async () => {
      const { detectPaymentAnomalies } = await import('../payments/payment-monitoring');
      const alerts = await detectPaymentAnomalies();
      return { alerts };
    },
    format: (d) => {
      const alerts = d.alerts as { message: string; severity: string }[];
      if (!alerts.length) return 'No payment anomalies detected in the last 2 hours.';
      return `Payment alerts:\n${alerts.map((a) => `• [${a.severity}] ${a.message}`).join('\n')}`;
    },
  },
  {
    keywords: ['campaign', 'advertisement', 'ad performance'],
    run: async () => {
      const { getCampaignAnalytics } = await import('../analytics/campaign-analytics');
      const data = await getCampaignAnalytics();
      return { campaigns: data.campaigns.slice(0, 5), insight: data.insight };
    },
    format: (d) => {
      const campaigns = d.campaigns as { title: string; leads: number; conversionRate: number; ctr: number }[];
      const lines = campaigns.map((c) => `• ${c.title}: ${c.leads} leads, ${c.conversionRate}% conversion, ${c.ctr}% CTR`).join('\n');
      return `${d.insight || 'Campaign performance:'}\n${lines}`;
    },
  },
  {
    keywords: ['referral', 'aasha'],
    run: async () => {
      const { getReferralAnalytics } = await import('../analytics/referral-analytics');
      return await getReferralAnalytics();
    },
    format: (d) => {
      const partners = d.partners as { source: string; leads: number; converted: number }[];
      const top = partners.slice(0, 5).map((p) => `• ${p.source}: ${p.leads} leads, ${p.converted} converted`).join('\n');
      return `${d.insight || 'Referral analytics:'}\n${top || 'No referral data yet.'}\nGrowth: ${(d.totals as { growthPct: number })?.growthPct}% this month.`;
    },
  },
  {
    keywords: ['no-show', 'no show', 'appointment risk'],
    run: async () => {
      const { getNoShowRiskDashboard } = await import('../appointments/no-show-batch');
      return await getNoShowRiskDashboard();
    },
    format: (d) => `No-show risk (next 2 days): ${d.high} high, ${d.medium} medium, ${d.low} low risk appointments.`,
  },
];

function matchTemplate(query: string): QueryTemplate | null {
  const lower = query.toLowerCase();
  let best: QueryTemplate | null = null;
  let bestScore = 0;
  for (const t of templates) {
    const score = t.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore > 0 ? best : null;
}

export async function runAdminCopilot(query: string, ctx: CopilotContext) {
  if (isMedicalQuery(query)) {
    return { answer: medicalSafetyResponse(), data: null, fromAi: false };
  }

  const template = matchTemplate(query);
  if (!template) {
    return {
      answer: 'I can help with platform summaries, failed payments, pending verifications, top hospitals, ratings, subscriptions, and leads. Try: "Show me today\'s platform summary."',
      data: null,
      fromAi: false,
    };
  }

  const data = await template.run(ctx);
  const factualAnswer = template.format(data);

  const ai = await aiComplete({
    module: 'copilot',
    feature: 'admin_copilot',
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    system: COPILOT_SYSTEM_PROMPT,
    user: `User question: ${query}\n\nFactual data (use only this, do not invent):\n${factualAnswer}\n\nRephrase this helpfully in 2-4 sentences.`,
  });

  return {
    answer: ai.fromAi && ai.text ? ai.text : factualAnswer,
    data,
    fromAi: ai.fromAi,
  };
}

export async function getPlatformSummary() {
  const template = templates[0];
  const data = await template.run({ userId: '', role: 'SUPER_ADMIN' });
  return { summary: template.format(data), data };
}
