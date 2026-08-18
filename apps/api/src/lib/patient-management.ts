import { OrganizationType, PatientAccountStatus, PatientRegistrationSource, Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface PatientListFilters {
  search?: string;
  city?: string;
  state?: string;
  organizationId?: string;
  organizationType?: OrganizationType;
  doctorId?: string;
  accountStatus?: string;
  registrationSource?: string;
  referralOnly?: boolean;
  page?: number;
  limit?: number;
}

export async function generateGlobalPatientId(): Promise<string> {
  const latest = await prisma.patient.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { globalPatientId: true },
  });
  const lastNum = latest?.globalPatientId
    ? parseInt(latest.globalPatientId.replace(/\D/g, ''), 10) || 0
    : 0;
  return `PAT-${String(lastNum + 1).padStart(8, '0')}`;
}

export async function getPatientManagementDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    totalPatients,
    newPatients,
    activePatients,
    pendingProfile,
    blockedPatients,
    verifiedPatients,
    addedToday,
    addedThisMonth,
    referralPatients,
    directPatients,
    advertisementPatients,
    byGender,
    totalAppointments,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.patient.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.patient.count({ where: { accountStatus: 'ACTIVE', user: { isActive: true } } }),
    prisma.patient.count({ where: { accountStatus: 'PENDING_PROFILE' } }),
    prisma.patient.count({ where: { accountStatus: { in: ['BLOCKED', 'SUSPENDED'] } } }),
    prisma.patient.count({ where: { user: { emailVerified: true, phoneVerified: true }, accountStatus: 'ACTIVE' } }),
    prisma.patient.count({ where: { createdAt: { gte: today } } }),
    prisma.patient.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.patient.count({ where: { registrationSource: { in: ['REFERRAL', 'AASHA'] } } }),
    prisma.patient.count({ where: { registrationSource: 'DIRECT' } }),
    prisma.patient.count({ where: { registrationSource: 'ADVERTISEMENT' } }),
    prisma.patient.groupBy({ by: ['gender'], _count: true }),
    prisma.appointment.count(),
  ]);

  const returningPatients = await prisma.appointment.groupBy({
    by: ['patientId'],
    _count: true,
    having: { patientId: { _count: { gt: 1 } } },
  });

  const byState = await prisma.patient.groupBy({
    by: ['state'],
    _count: true,
    where: { state: { not: null } },
    orderBy: { _count: { state: 'desc' } },
  });

  const byCity = await prisma.patient.groupBy({
    by: ['city'],
    _count: true,
    where: { city: { not: null } },
    orderBy: { _count: { city: 'desc' } },
  });

  const hospitalPatients = await prisma.patientOrganization.count({
    where: { organization: { type: 'HOSPITAL' } },
  });
  const clinicPatients = await prisma.patientOrganization.count({
    where: { organization: { type: 'CLINIC' } },
  });

  const ageGroups = await getAgeGroupBreakdown();

  return {
    totalPatients,
    newPatients,
    activePatients,
    returningPatients: returningPatients.length,
    verifiedPatients,
    pendingProfile,
    blockedPatients,
    addedToday,
    addedThisMonth,
    byState: byState.slice(0, 10).map((s) => ({ state: s.state || 'Unknown', count: s._count })),
    byCity: byCity.slice(0, 10).map((c) => ({ city: c.city || 'Unknown', count: c._count })),
    byGender: byGender.map((g) => ({ gender: g.gender || 'Unknown', count: g._count })),
    byAgeGroup: ageGroups,
    byHospital: hospitalPatients,
    byClinic: clinicPatients,
    referralPatients,
    directPatients,
    advertisementPatients,
    totalAppointments,
  };
}

async function getAgeGroupBreakdown() {
  const patients = await prisma.patient.findMany({
    where: { dateOfBirth: { not: null } },
    select: { dateOfBirth: true },
  });
  const groups: Record<string, number> = {
    '0-17': 0, '18-30': 0, '31-45': 0, '46-60': 0, '60+': 0,
  };
  const now = new Date();
  for (const p of patients) {
    if (!p.dateOfBirth) continue;
    const age = Math.floor((now.getTime() - p.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 18) groups['0-17']++;
    else if (age <= 30) groups['18-30']++;
    else if (age <= 45) groups['31-45']++;
    else if (age <= 60) groups['46-60']++;
    else groups['60+']++;
  }
  return Object.entries(groups).map(([range, count]) => ({ range, count }));
}

export async function listPatients(filters: PatientListFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.PatientWhereInput = {
    ...(filters.accountStatus && { accountStatus: filters.accountStatus as PatientAccountStatus }),
    ...(filters.registrationSource && { registrationSource: filters.registrationSource as PatientRegistrationSource }),
    ...(filters.referralOnly && { registrationSource: { in: ['REFERRAL', 'AASHA'] } }),
    ...(filters.city && { city: { contains: filters.city, mode: 'insensitive' } }),
    ...(filters.state && { state: { contains: filters.state, mode: 'insensitive' } }),
    ...(filters.organizationId && { organizations: { some: { organizationId: filters.organizationId } } }),
    ...(filters.organizationType && { organizations: { some: { organization: { type: filters.organizationType } } } }),
    ...(filters.doctorId && { appointments: { some: { doctorId: filters.doctorId } } }),
    ...(filters.search && {
      OR: [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { globalPatientId: { contains: filters.search, mode: 'insensitive' } },
        { user: { email: { contains: filters.search, mode: 'insensitive' } } },
        { user: { phone: { contains: filters.search, mode: 'insensitive' } } },
      ],
    }),
  };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, phone: true, isActive: true, emailVerified: true, phoneVerified: true, lastLoginAt: true } },
        organizations: {
          include: { organization: { select: { id: true, name: true, type: true, city: true, logoUrl: true } } },
        },
        _count: { select: { appointments: true, bills: true, reviews: true, organizations: true } },
      },
    }),
    prisma.patient.count({ where }),
  ]);

  const withLastVisit = await Promise.all(patients.map(async (p) => {
    const lastAppt = await prisma.appointment.findFirst({
      where: { patientId: p.id, status: 'COMPLETED' },
      orderBy: { appointmentDate: 'desc' },
      select: { appointmentDate: true },
    });
    return { ...p, lastVisit: lastAppt?.appointmentDate || null };
  }));

  return { patients: withLastVisit, page, limit, total };
}

export async function getPatientOverview(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      user: {
        select: {
          id: true, email: true, phone: true, isActive: true,
          emailVerified: true, phoneVerified: true, lastLoginAt: true, createdAt: true,
        },
      },
      organizations: {
        include: {
          organization: {
            select: { id: true, name: true, type: true, city: true, state: true, logoUrl: true, verificationStatus: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { appointments: true, bills: true, reviews: true, organizations: true } },
    },
  });
  if (!patient) return null;

  const [
    appointmentStats,
    recentAppointments,
    recentBills,
    loginHistory,
    auditLogs,
  ] = await Promise.all([
    prisma.appointment.groupBy({ by: ['status'], where: { patientId }, _count: true }),
    prisma.appointment.findMany({
      where: { patientId },
      orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
      take: 10,
      include: {
        doctor: { select: { fullName: true, specialization: true } },
        organization: { select: { name: true, type: true, logoUrl: true } },
      },
    }),
    prisma.bill.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { organization: { select: { name: true } }, payments: true },
    }),
    prisma.loginHistory.findMany({
      where: { userId: patient.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: { OR: [{ entityType: 'Patient', entityId: patientId }, { userId: patient.userId }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { email: true } } },
    }),
  ]);

  const revenueAgg = await prisma.payment.aggregate({
    where: { status: 'COMPLETED', bill: { patientId } },
    _sum: { amount: true },
  });

  const compliance = getPatientComplianceAlerts(patient);

  return {
    patient,
    stats: {
      ...patient._count,
      revenue: revenueAgg._sum.amount || 0,
      appointmentByStatus: Object.fromEntries(appointmentStats.map((a) => [a.status, a._count])),
      verified: patient.user.emailVerified && patient.user.phoneVerified,
    },
    recentAppointments,
    recentBills,
    loginHistory,
    auditLogs,
    compliance,
  };
}

function getPatientComplianceAlerts(patient: {
  accountStatus: PatientAccountStatus;
  profileCompleted: boolean;
  user: { isActive: boolean; emailVerified: boolean; phoneVerified: boolean };
}) {
  const alerts: { level: string; message: string }[] = [];
  if (patient.accountStatus === 'BLOCKED' || patient.accountStatus === 'SUSPENDED') {
    alerts.push({ level: 'red', message: `Patient account is ${patient.accountStatus.toLowerCase()}` });
  }
  if (!patient.profileCompleted) {
    alerts.push({ level: 'orange', message: 'Profile incomplete — dashboard limited' });
  }
  if (!patient.user.emailVerified && !patient.user.phoneVerified) {
    alerts.push({ level: 'yellow', message: 'Identity not verified' });
  }
  if (!patient.user.isActive) {
    alerts.push({ level: 'red', message: 'Login disabled' });
  }
  return alerts;
}

export async function verifyPatient(patientId: string, actorUserId: string) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new Error('Patient not found');

  await prisma.user.update({
    where: { id: patient.userId },
    data: { emailVerified: true, phoneVerified: true, isActive: true },
  });

  const updated = await prisma.patient.update({
    where: { id: patientId },
    data: { accountStatus: 'ACTIVE', profileCompleted: true },
  });

  await prisma.auditLog.create({
    data: { userId: actorUserId, action: 'PATIENT_VERIFIED', entityType: 'Patient', entityId: patientId },
  });

  return updated;
}

export async function blockPatient(patientId: string, reason: string, actorUserId: string) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new Error('Patient not found');

  await prisma.user.update({ where: { id: patient.userId }, data: { isActive: false } });
  await prisma.refreshToken.deleteMany({ where: { userId: patient.userId } });

  const updated = await prisma.patient.update({
    where: { id: patientId },
    data: { accountStatus: 'BLOCKED' },
  });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: 'PATIENT_BLOCKED',
      entityType: 'Patient',
      entityId: patientId,
      details: { reason } as Prisma.InputJsonValue,
    },
  });

  return updated;
}

export async function activatePatient(patientId: string, actorUserId: string) {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new Error('Patient not found');

  await prisma.user.update({ where: { id: patient.userId }, data: { isActive: true } });

  const updated = await prisma.patient.update({
    where: { id: patientId },
    data: { accountStatus: patient.profileCompleted ? 'ACTIVE' : 'PENDING_PROFILE' },
  });

  await prisma.auditLog.create({
    data: { userId: actorUserId, action: 'PATIENT_ACTIVATED', entityType: 'Patient', entityId: patientId },
  });

  return updated;
}

export async function detectDuplicatePatients() {
  const patients = await prisma.patient.findMany({
    include: { user: { select: { email: true, phone: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const groups: { key: string; patients: typeof patients }[] = [];
  const byPhone = new Map<string, typeof patients>();
  const byEmail = new Map<string, typeof patients>();

  for (const p of patients) {
    if (p.user.phone) {
      const list = byPhone.get(p.user.phone) || [];
      list.push(p);
      byPhone.set(p.user.phone, list);
    }
    if (p.user.email && !p.user.email.includes('@temp.')) {
      const list = byEmail.get(p.user.email) || [];
      list.push(p);
      byEmail.set(p.user.email, list);
    }
  }

  for (const [phone, list] of byPhone) {
    if (list.length > 1) groups.push({ key: `phone:${phone}`, patients: list });
  }
  for (const [email, list] of byEmail) {
    if (list.length > 1) groups.push({ key: `email:${email}`, patients: list });
  }

  return groups;
}

export async function mergePatients(primaryId: string, secondaryId: string, actorUserId: string) {
  if (primaryId === secondaryId) throw new Error('Cannot merge patient with itself');

  const [primary, secondary] = await Promise.all([
    prisma.patient.findUnique({ where: { id: primaryId } }),
    prisma.patient.findUnique({ where: { id: secondaryId } }),
  ]);
  if (!primary || !secondary) throw new Error('Patient not found');

  await prisma.$transaction(async (tx) => {
    await tx.appointment.updateMany({ where: { patientId: secondaryId }, data: { patientId: primaryId } });
    await tx.bill.updateMany({ where: { patientId: secondaryId }, data: { patientId: primaryId } });
    await tx.review.updateMany({ where: { patientId: secondaryId }, data: { patientId: primaryId } });

    const secondaryOrgs = await tx.patientOrganization.findMany({ where: { patientId: secondaryId } });
    for (const org of secondaryOrgs) {
      await tx.patientOrganization.upsert({
        where: { patientId_organizationId: { patientId: primaryId, organizationId: org.organizationId } },
        create: {
          patientId: primaryId,
          organizationId: org.organizationId,
          patientNumber: org.patientNumber,
          sourceType: org.sourceType,
          referralName: org.referralName,
          referralId: org.referralId,
          notes: org.notes,
        },
        update: {},
      });
    }
    await tx.patientOrganization.deleteMany({ where: { patientId: secondaryId } });

    await tx.patient.delete({ where: { id: secondaryId } });
    await tx.user.delete({ where: { id: secondary.userId } });
  });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: 'PATIENT_MERGED',
      entityType: 'Patient',
      entityId: primaryId,
      details: { mergedFrom: secondaryId, mergedGlobalId: secondary.globalPatientId } as Prisma.InputJsonValue,
    },
  });

  return getPatientOverview(primaryId);
}

export function patientsToCsv(patients: Record<string, unknown>[]): string {
  const headers = ['Global ID', 'Name', 'Email', 'Phone', 'City', 'State', 'Source', 'Status', 'Organizations', 'Registered'];
  const rows = patients.map((p) => {
    const user = p.user as { email?: string; phone?: string } | undefined;
    const count = p._count as { organizations?: number } | undefined;
    return [
      p.globalPatientId,
      p.fullName,
      user?.email,
      user?.phone,
      p.city,
      p.state,
      p.registrationSource,
      p.accountStatus,
      count?.organizations ?? 0,
      p.createdAt ? new Date(String(p.createdAt)).toISOString().slice(0, 10) : '',
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
