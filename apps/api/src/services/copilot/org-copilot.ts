import { prisma } from '../../lib/prisma';
import { aiComplete, COPILOT_SYSTEM_PROMPT, isMedicalQuery, medicalSafetyResponse } from '../ai';
import type { CopilotContext } from './admin-copilot';

type OrgTemplate = {
  keywords: string[];
  run: (orgId: string) => Promise<Record<string, unknown>>;
  format: (data: Record<string, unknown>) => string;
};

function orgTemplates(orgId: string): OrgTemplate[] {
  return [
    {
      keywords: ['summary', 'today', 'overview', 'dashboard'],
      run: async (id) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const [todayAppointments, monthRevenue, totalPatients, activeDoctors, pendingBills] = await Promise.all([
          prisma.appointment.count({ where: { organizationId: id, appointmentDate: { gte: today } } }),
          prisma.payment.aggregate({
            where: { status: 'COMPLETED', paidAt: { gte: monthStart }, bill: { organizationId: id } },
            _sum: { amount: true },
          }),
          prisma.patientOrganization.count({ where: { organizationId: id } }),
          prisma.doctor.count({ where: { organizationId: id, isActive: true } }),
          prisma.bill.count({ where: { organizationId: id, status: 'PENDING' } }),
        ]);
        return {
          todayAppointments,
          monthRevenue: monthRevenue._sum.amount || 0,
          totalPatients,
          activeDoctors,
          pendingBills,
        };
      },
      format: (d) =>
        `Organization summary:\n• ${d.todayAppointments} appointments today\n• ₹${Number(d.monthRevenue).toLocaleString('en-IN')} revenue this month\n• ${d.totalPatients} patients\n• ${d.activeDoctors} active doctors\n• ${d.pendingBills} pending bills`,
    },
    {
      keywords: ['appointment', 'schedule', 'today'],
      run: async (id) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const appointments = await prisma.appointment.findMany({
          where: { organizationId: id, appointmentDate: { gte: today } },
          take: 10,
          orderBy: { startTime: 'asc' },
          include: {
            patient: { select: { fullName: true } },
            doctor: { select: { fullName: true } },
          },
        });
        return { count: appointments.length, appointments };
      },
      format: (d) => {
        const apts = d.appointments as { startTime: string; patient: { fullName: string }; doctor: { fullName: string }; status: string }[];
        if (!apts.length) return 'No appointments scheduled for today.';
        return `Today's appointments (${d.count}):\n${apts.map((a) => `• ${a.startTime} — ${a.patient.fullName} with Dr. ${a.doctor.fullName} (${a.status})`).join('\n')}`;
      },
    },
    {
      keywords: ['patient', 'new patient'],
      run: async (id) => {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const newPatients = await prisma.patientOrganization.count({
          where: { organizationId: id, createdAt: { gte: monthStart } },
        });
        const incomplete = await prisma.patient.count({
          where: {
            profileCompletionPercent: { lt: 70 },
            organizations: { some: { organizationId: id } },
          },
        });
        return { newPatients, incomplete };
      },
      format: (d) => `Patients: ${d.newPatients} new this month, ${d.incomplete} with incomplete profiles (<70%).`,
    },
    {
      keywords: ['doctor', 'staff'],
      run: async (id) => {
        const doctors = await prisma.doctor.findMany({
          where: { organizationId: id, isActive: true },
          select: { fullName: true, specialization: true, averageRating: true },
          take: 10,
        });
        return { count: doctors.length, doctors };
      },
      format: (d) => {
        const docs = d.doctors as { fullName: string; specialization: string | null; averageRating: number }[];
        return `Active doctors (${d.count}):\n${docs.map((doc) => `• Dr. ${doc.fullName} — ${doc.specialization || 'General'} (${doc.averageRating.toFixed(1)}★)`).join('\n')}`;
      },
    },
    {
      keywords: ['revenue', 'billing', 'payment'],
      run: async (id) => {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const [completed, pending, failed] = await Promise.all([
          prisma.payment.aggregate({
            where: { status: 'COMPLETED', paidAt: { gte: weekAgo }, bill: { organizationId: id } },
            _sum: { amount: true },
            _count: true,
          }),
          prisma.bill.aggregate({ where: { organizationId: id, status: 'PENDING' }, _sum: { total: true }, _count: true }),
          prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: weekAgo }, bill: { organizationId: id } } }),
        ]);
        return {
          weekRevenue: completed._sum.amount || 0,
          weekPayments: completed._count,
          pendingAmount: pending._sum?.total || 0,
          pendingBills: pending._count,
          failedPayments: failed,
        };
      },
      format: (d) =>
        `Billing (last 7 days):\n• ₹${Number(d.weekRevenue).toLocaleString('en-IN')} collected (${d.weekPayments} payments)\n• ₹${Number(d.pendingAmount).toLocaleString('en-IN')} pending (${d.pendingBills} bills)\n• ${d.failedPayments} failed payments`,
    },
    {
      keywords: ['lead', 'hot lead'],
      run: async (id) => {
        const [hot, warm, cold] = await Promise.all([
          prisma.lead.count({ where: { organizationId: id, temperature: 'HOT' } }),
          prisma.lead.count({ where: { organizationId: id, temperature: 'WARM' } }),
          prisma.lead.count({ where: { organizationId: id, temperature: 'COLD' } }),
        ]);
        return { hot, warm, cold };
      },
      format: (d) => `Lead pipeline: ${d.hot} hot, ${d.warm} warm, ${d.cold} cold.`,
    },
  ];
}

function matchOrgTemplate(query: string, orgId: string): OrgTemplate | null {
  const lower = query.toLowerCase();
  let best: OrgTemplate | null = null;
  let bestScore = 0;
  for (const t of orgTemplates(orgId)) {
    const score = t.keywords.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return bestScore > 0 ? best : null;
}

export async function runOrgCopilot(query: string, ctx: CopilotContext) {
  if (!ctx.organizationId) {
    return {
      answer: 'Organization context is required. Please ensure you are logged in with an organization account.',
      data: null,
      fromAi: false,
    };
  }

  if (isMedicalQuery(query)) {
    return { answer: medicalSafetyResponse(), data: null, fromAi: false };
  }

  const template = matchOrgTemplate(query, ctx.organizationId);
  if (!template) {
    return {
      answer: 'I can help with your organization summary, today\'s appointments, patients, doctors, billing, and leads. Try: "Show me today\'s appointments."',
      data: null,
      fromAi: false,
    };
  }

  const data = await template.run(ctx.organizationId);
  const factualAnswer = template.format(data);

  const ai = await aiComplete({
    module: 'copilot',
    feature: 'org_copilot',
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    system: COPILOT_SYSTEM_PROMPT,
    user: `User question: ${query}\n\nOrganization data (use only this):\n${factualAnswer}\n\nRephrase helpfully in 2-4 sentences.`,
  });

  return {
    answer: ai.fromAi && ai.text ? ai.text : factualAnswer,
    data,
    fromAi: ai.fromAi,
  };
}
