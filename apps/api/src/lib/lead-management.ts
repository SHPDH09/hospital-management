import { LeadPriority, LeadSource, LeadStatus, LeadTemperature, LeadType, Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface LeadListFilters {
  search?: string;
  status?: string;
  type?: string;
  source?: string;
  priority?: string;
  temperature?: string;
  organizationId?: string;
  assignedToId?: string;
  unassigned?: boolean;
  city?: string;
  state?: string;
  campaign?: string;
  referralType?: string;
  isDuplicate?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function generateLeadNumber(): Promise<string> {
  const latest = await prisma.lead.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { leadNumber: true },
  });
  const lastNum = latest?.leadNumber
    ? parseInt(latest.leadNumber.replace(/\D/g, ''), 10) || 0
    : 0;
  return `LD-${String(lastNum + 1).padStart(5, '0')}`;
}

function calculateLeadScore(lead: {
  type: LeadType;
  source: LeadSource;
  phoneVerified: boolean;
  emailVerified: boolean;
  interestedDoctorId: string | null;
  preferredDate: Date | null;
  status: LeadStatus;
}): { score: number; temperature: LeadTemperature } {
  let score = 0;
  if (lead.preferredDate) score += 30;
  if (lead.phoneVerified) score += 10;
  if (lead.emailVerified) score += 5;
  if (lead.interestedDoctorId) score += 20;
  if (['REFERRAL', 'AASHA'].includes(lead.source)) score += 10;
  if (['CONTACTED', 'INTERESTED', 'QUALIFIED'].includes(lead.status)) score += 15;
  if (lead.type === 'PATIENT') score += 5;

  const temperature: LeadTemperature = score >= 61 ? 'HOT' : score >= 31 ? 'WARM' : 'COLD';
  return { score, temperature };
}

export async function getLeadManagementDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const followUpStatuses: LeadStatus[] = ['FOLLOW_UP', 'CONTACTED', 'INTERESTED', 'QUALIFIED'];
  const convertedStatuses: LeadStatus[] = ['CONVERTED', 'VISITED', 'TREATMENT_STARTED'];
  const lostStatuses: LeadStatus[] = ['LOST', 'NOT_INTERESTED', 'WRONG_NUMBER', 'INVALID'];

  const [
    totalLeads,
    newLeads,
    todayLeads,
    contactedLeads,
    followUpPending,
    qualifiedLeads,
    convertedLeads,
    lostLeads,
    duplicateLeads,
    hotLeads,
    warmLeads,
    coldLeads,
    referralLeads,
    adLeads,
    websiteLeads,
    googleLeads,
    hospitalLeads,
    clinicLeads,
    doctorLeads,
    unassignedLeads,
    todayFollowUps,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: 'NEW' } }),
    prisma.lead.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.lead.count({ where: { status: { in: ['CONTACTED', 'INTERESTED', 'QUALIFIED', 'FOLLOW_UP'] } } }),
    prisma.lead.count({ where: { status: { in: followUpStatuses }, nextFollowUpAt: { lte: new Date() } } }),
    prisma.lead.count({ where: { status: 'QUALIFIED' } }),
    prisma.lead.count({ where: { status: { in: convertedStatuses } } }),
    prisma.lead.count({ where: { status: { in: lostStatuses } } }),
    prisma.lead.count({ where: { OR: [{ isDuplicate: true }, { status: 'DUPLICATE' }] } }),
    prisma.lead.count({ where: { temperature: 'HOT' } }),
    prisma.lead.count({ where: { temperature: 'WARM' } }),
    prisma.lead.count({ where: { temperature: 'COLD' } }),
    prisma.lead.count({ where: { source: { in: ['REFERRAL', 'AASHA'] } } }),
    prisma.lead.count({ where: { source: 'ADVERTISEMENT' } }),
    prisma.lead.count({ where: { source: 'WEBSITE' } }),
    prisma.lead.count({ where: { source: 'GOOGLE' } }),
    prisma.lead.count({ where: { type: 'HOSPITAL' } }),
    prisma.lead.count({ where: { type: 'CLINIC' } }),
    prisma.lead.count({ where: { type: 'DOCTOR' } }),
    prisma.lead.count({ where: { assignedToId: null, status: { notIn: [...convertedStatuses, ...lostStatuses, 'DUPLICATE'] } } }),
    prisma.leadFollowUp.count({ where: { scheduledAt: { gte: today, lt: tomorrow }, status: 'PENDING' } }),
  ]);

  const funnel = {
    leads: totalLeads,
    contacted: contactedLeads,
    qualified: qualifiedLeads,
    appointments: await prisma.lead.count({ where: { status: 'APPOINTMENT_BOOKED' } }),
    visited: await prisma.lead.count({ where: { status: 'VISITED' } }),
    treatment: await prisma.lead.count({ where: { status: 'TREATMENT_STARTED' } }),
    converted: convertedLeads,
  };

  const bySource = await prisma.lead.groupBy({ by: ['source'], _count: true });
  const byType = await prisma.lead.groupBy({ by: ['type'], _count: true });

  return {
    totalLeads,
    newLeads,
    todayLeads,
    contactedLeads,
    followUpPending,
    qualifiedLeads,
    convertedLeads,
    lostLeads,
    duplicateLeads,
    hotLeads,
    warmLeads,
    coldLeads,
    referralLeads,
    advertisementLeads: adLeads,
    websiteLeads,
    googleLeads,
    hospitalLeads,
    clinicLeads,
    doctorLeads,
    unassignedLeads,
    todayFollowUps,
    funnel,
    bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
    byType: byType.map((t) => ({ type: t.type, count: t._count })),
  };
}

export async function listLeads(filters: LeadListFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.LeadWhereInput = {
    ...(filters.status && { status: filters.status as LeadStatus }),
    ...(filters.type && { type: filters.type as LeadType }),
    ...(filters.source && { source: filters.source as LeadSource }),
    ...(filters.priority && { priority: filters.priority as LeadPriority }),
    ...(filters.temperature && { temperature: filters.temperature as LeadTemperature }),
    ...(filters.organizationId && { organizationId: filters.organizationId }),
    ...(filters.assignedToId && { assignedToId: filters.assignedToId }),
    ...(filters.unassigned && { assignedToId: null }),
    ...(filters.city && { city: { contains: filters.city, mode: 'insensitive' } }),
    ...(filters.state && { state: { contains: filters.state, mode: 'insensitive' } }),
    ...(filters.campaign && { campaign: { contains: filters.campaign, mode: 'insensitive' } }),
    ...(filters.referralType && { referralType: { contains: filters.referralType, mode: 'insensitive' } }),
    ...(filters.isDuplicate !== undefined && { isDuplicate: filters.isDuplicate }),
    ...(filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo && { lte: new Date(`${filters.dateTo}T23:59:59`) }),
      },
    },
    ...(filters.search && {
      OR: [
        { leadNumber: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
        { campaign: { contains: filters.search, mode: 'insensitive' } },
        { referralName: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { id: true, name: true, type: true, city: true } },
        assignedTo: { select: { id: true, email: true } },
        interestedDoctor: { select: { id: true, fullName: true } },
        patient: { select: { id: true, fullName: true, globalPatientId: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, page, limit, total };
}

export async function getLeadOverview(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      organization: true,
      assignedTo: { select: { id: true, email: true, role: true } },
      interestedDoctor: { select: { id: true, fullName: true, specialization: true } },
      patient: { include: { user: { select: { email: true, phone: true } } } },
      appointment: { select: { id: true, appointmentNumber: true, status: true, appointmentDate: true } },
      advertisement: { select: { id: true, title: true } },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { email: true } } },
      },
      followUps: {
        orderBy: { scheduledAt: 'desc' },
        take: 20,
        include: { assignedTo: { select: { email: true } } },
      },
    },
  });
  if (!lead) return null;

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: 'Lead', entityId: leadId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { email: true } } },
  });

  return { lead, auditLogs };
}

export async function detectDuplicateLeads(phone?: string, email?: string, excludeId?: string) {
  if (!phone && !email) return [];
  const duplicates = await prisma.lead.findMany({
    where: {
      ...(excludeId && { id: { not: excludeId } }),
      OR: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
      ],
    },
    take: 10,
    select: { id: true, leadNumber: true, name: true, phone: true, email: true, status: true },
  });
  return duplicates;
}

export async function assignLead(leadId: string, assignedToId: string, actorUserId: string) {
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { assignedToId, assignedAt: new Date() },
  });
  await prisma.leadActivity.create({
    data: {
      leadId,
      userId: actorUserId,
      action: 'ASSIGNED',
      notes: `Assigned to staff ${assignedToId}`,
    },
  });
  return lead;
}

export async function updateLeadStatus(leadId: string, status: LeadStatus, actorUserId: string, notes?: string) {
  const existing = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!existing) throw new Error('Lead not found');

  const { score, temperature } = calculateLeadScore({ ...existing, status });
  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      status,
      score,
      temperature,
      ...(status === 'CONTACTED' && { lastContactAt: new Date() }),
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId,
      userId: actorUserId,
      action: 'STATUS_CHANGE',
      oldStatus: existing.status,
      newStatus: status,
      notes,
    },
  });

  return lead;
}

export async function addLeadNote(leadId: string, notes: string, actorUserId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: { notes: lead.notes ? `${lead.notes}\n${notes}` : notes },
  });

  await prisma.leadActivity.create({
    data: { leadId, userId: actorUserId, action: 'NOTE_ADDED', notes },
  });

  return updated;
}

export async function scheduleFollowUp(
  leadId: string,
  scheduledAt: Date,
  reason: string,
  assignedToId: string | undefined,
  actorUserId: string,
) {
  const followUp = await prisma.leadFollowUp.create({
    data: {
      leadId,
      scheduledAt,
      reason,
      assignedToId,
      status: 'PENDING',
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      nextFollowUpAt: scheduledAt,
      status: 'FOLLOW_UP',
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId,
      userId: actorUserId,
      action: 'FOLLOW_UP_SCHEDULED',
      notes: reason,
    },
  });

  return followUp;
}

export async function completeFollowUp(followUpId: string, notes: string | undefined, actorUserId: string) {
  const followUp = await prisma.leadFollowUp.update({
    where: { id: followUpId },
    data: { status: 'COMPLETED', completedAt: new Date(), notes },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: followUp.leadId,
      userId: actorUserId,
      action: 'FOLLOW_UP_COMPLETED',
      notes,
    },
  });

  return followUp;
}

export async function convertLeadToPatient(leadId: string, actorUserId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');
  if (!lead.phone && !lead.email) throw new Error('Lead must have phone or email to convert');

  let patient = lead.patientId
    ? await prisma.patient.findUnique({ where: { id: lead.patientId } })
    : null;

  if (!patient && lead.phone) {
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ phone: lead.phone }, ...(lead.email ? [{ email: lead.email }] : [])] },
      include: { patient: true },
    });
    if (existingUser?.patient) patient = existingUser.patient;
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: 'CONVERTED',
      patientId: patient?.id,
      score: 100,
      temperature: 'HOT',
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId,
      userId: actorUserId,
      action: 'CONVERTED',
      oldStatus: lead.status,
      newStatus: 'CONVERTED',
      notes: patient ? `Linked to existing patient ${patient.globalPatientId}` : 'Marked converted — patient onboarding pending',
    },
  });

  return { lead: updated, patient, isExistingPatient: Boolean(patient) };
}

export async function markLeadLost(leadId: string, lostReason: string, actorUserId: string) {
  const existing = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!existing) throw new Error('Lead not found');

  const lead = await prisma.lead.update({
    where: { id: leadId },
    data: { status: 'LOST', lostReason },
  });

  await prisma.leadActivity.create({
    data: {
      leadId,
      userId: actorUserId,
      action: 'MARKED_LOST',
      oldStatus: existing.status,
      newStatus: 'LOST',
      notes: lostReason,
    },
  });

  return lead;
}

export async function getTodayFollowUps() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.leadFollowUp.findMany({
    where: { scheduledAt: { gte: today, lt: tomorrow }, status: 'PENDING' },
    orderBy: { scheduledAt: 'asc' },
    include: {
      lead: {
        select: {
          id: true, leadNumber: true, name: true, phone: true, status: true, temperature: true,
        },
      },
      assignedTo: { select: { email: true } },
    },
  });
}

export function leadsToCsv(leads: Record<string, unknown>[]): string {
  const headers = ['Lead ID', 'Name', 'Type', 'Source', 'Phone', 'Email', 'City', 'Status', 'Priority', 'Temperature', 'Assigned To', 'Created'];
  const rows = leads.map((l) => {
    const assigned = l.assignedTo as { email?: string } | undefined;
    const org = l.organization as { name?: string } | undefined;
    return [
      l.leadNumber,
      l.name,
      l.type,
      l.source,
      l.phone,
      l.email,
      l.city,
      l.status,
      l.priority,
      l.temperature,
      assigned?.email || org?.name,
      l.createdAt ? new Date(String(l.createdAt)).toISOString().slice(0, 10) : '',
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
