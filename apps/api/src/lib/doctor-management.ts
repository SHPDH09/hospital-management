import { OrganizationType, Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface DoctorListFilters {
  search?: string;
  specialization?: string;
  qualification?: string;
  state?: string;
  city?: string;
  organizationId?: string;
  organizationType?: OrganizationType;
  verificationStatus?: string;
  isActive?: boolean;
  accountActivated?: boolean;
  page?: number;
  limit?: number;
}

export async function getDoctorManagementDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const soon = new Date();
  soon.setDate(soon.getDate() + 90);

  const [
    totalDoctors,
    pendingVerification,
    underReview,
    verifiedDoctors,
    activeDoctors,
    suspendedDoctors,
    rejectedDoctors,
    reVerificationRequired,
    addedToday,
    addedThisMonth,
    bySpecialty,
    byHospital,
    byClinic,
    expiringRegistrations,
    totalAppointments,
    totalReviews,
  ] = await Promise.all([
    prisma.doctor.count(),
    prisma.doctor.count({ where: { verificationStatus: 'PENDING', accountActivated: false } }),
    prisma.doctor.count({ where: { verificationStatus: 'PENDING', registrationNumber: { not: null } } }),
    prisma.doctor.count({ where: { verificationStatus: 'APPROVED', accountActivated: true } }),
    prisma.doctor.count({ where: { verificationStatus: 'APPROVED', accountActivated: true, isActive: true } }),
    prisma.doctor.count({ where: { OR: [{ verificationStatus: 'SUSPENDED' }, { isActive: false, verificationStatus: 'SUSPENDED' }] } }),
    prisma.doctor.count({ where: { verificationStatus: 'REJECTED' } }),
    prisma.doctor.count({ where: { verificationStatus: 'CORRECTION_REQUESTED' } }),
    prisma.doctor.count({ where: { createdAt: { gte: today } } }),
    prisma.doctor.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.doctor.groupBy({ by: ['specialization'], _count: true, where: { specialization: { not: null } }, orderBy: { _count: { specialization: 'desc' } }, take: 10 }),
    prisma.doctor.count({ where: { organization: { type: 'HOSPITAL' } } }),
    prisma.doctor.count({ where: { organization: { type: 'CLINIC' } } }),
    prisma.doctor.count({
      where: {
        registrationNumber: { not: null },
        updatedAt: { lte: soon },
        verificationStatus: 'APPROVED',
      },
    }),
    prisma.appointment.count(),
    prisma.review.count({ where: { doctorId: { not: null } } }),
  ]);

  const byLocationRaw = await prisma.doctor.groupBy({
    by: ['organizationId'],
    _count: true,
    orderBy: { _count: { organizationId: 'desc' } },
  });
  const byLocation = byLocationRaw.slice(0, 10);
  const orgIds = byLocation.map((l) => l.organizationId);
  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, city: true, state: true },
  });
  const locationMap = Object.fromEntries(orgs.map((o) => [o.id, `${o.city || ''}, ${o.state || ''}`]));

  return {
    totalDoctors,
    pendingVerification,
    underReview,
    verifiedDoctors,
    activeDoctors,
    suspendedDoctors,
    rejectedDoctors,
    reVerificationRequired,
    addedToday,
    addedThisMonth,
    bySpecialty: bySpecialty.map((s) => ({ specialty: s.specialization || 'Unknown', count: s._count })),
    byLocation: byLocation.map((l) => ({ location: locationMap[l.organizationId] || 'Unknown', count: l._count })),
    byHospital,
    byClinic,
    expiringRegistrations,
    totalAppointments,
    totalReviews,
  };
}

export async function listDoctors(filters: DoctorListFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.DoctorWhereInput = {
    ...(filters.verificationStatus && { verificationStatus: filters.verificationStatus as never }),
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    ...(filters.accountActivated !== undefined && { accountActivated: filters.accountActivated }),
    ...(filters.specialization && { specialization: { contains: filters.specialization, mode: 'insensitive' } }),
    ...(filters.qualification && { qualification: { contains: filters.qualification, mode: 'insensitive' } }),
    ...(filters.organizationId && { organizationId: filters.organizationId }),
    ...(filters.organizationType && { organization: { type: filters.organizationType } }),
    ...(filters.state && { organization: { state: { contains: filters.state, mode: 'insensitive' } } }),
    ...(filters.city && { organization: { city: { contains: filters.city, mode: 'insensitive' } } }),
    ...(filters.search && {
      OR: [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { registrationNumber: { contains: filters.search, mode: 'insensitive' } },
        { id: { contains: filters.search, mode: 'insensitive' } },
        { specialization: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [doctors, total] = await Promise.all([
    prisma.doctor.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, phone: true, isActive: true, lastLoginAt: true } },
        organization: { select: { id: true, name: true, type: true, city: true, state: true, logoUrl: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        _count: { select: { appointments: true, reviews: true, slots: true } },
      },
    }),
    prisma.doctor.count({ where }),
  ]);

  return { doctors, page, limit, total };
}

export async function getDoctorOverview(doctorId: string) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: {
      user: { select: { id: true, email: true, phone: true, isActive: true, emailVerified: true, lastLoginAt: true, createdAt: true } },
      organization: { select: { id: true, name: true, type: true, city: true, state: true, logoUrl: true, verificationStatus: true } },
      branch: true,
      department: true,
      _count: { select: { appointments: true, reviews: true, slots: true } },
    },
  });
  if (!doctor) return null;

  const [
    appointmentStats,
    recentAppointments,
    recentReviews,
    uniquePatients,
    services,
    revenueAgg,
    loginHistory,
  ] = await Promise.all([
    prisma.appointment.groupBy({ by: ['status'], where: { doctorId }, _count: true }),
    prisma.appointment.findMany({
      where: { doctorId },
      orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
      take: 10,
      include: {
        patient: { select: { fullName: true } },
        organization: { select: { name: true, type: true } },
      },
    }),
    prisma.review.findMany({
      where: { doctorId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { patient: { select: { fullName: true } } },
    }),
    prisma.appointment.findMany({
      where: { doctorId },
      distinct: ['patientId'],
      select: { patientId: true },
    }),
    prisma.service.findMany({ where: { organizationId: doctor.organizationId }, take: 20 }),
    prisma.bill.aggregate({
      where: { appointment: { doctorId }, status: 'PAID' },
      _sum: { total: true },
    }),
    prisma.loginHistory.findMany({
      where: { userId: doctor.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const compliance = getDoctorComplianceAlerts(doctor);

  const associations = [{
    organization: doctor.organization,
    branch: doctor.branch,
    department: doctor.department,
    consultationFee: doctor.consultationFee,
    isPrimary: true,
    status: 'ACTIVE',
  }];

  return {
    doctor,
    stats: {
      ...doctor._count,
      patients: uniquePatients.length,
      revenue: revenueAgg._sum.total || 0,
      appointmentByStatus: Object.fromEntries(appointmentStats.map((a) => [a.status, a._count])),
    },
    associations,
    recentAppointments,
    recentReviews,
    services,
    loginHistory,
    compliance,
  };
}

function getDoctorComplianceAlerts(doctor: {
  verificationStatus: string;
  accountActivated: boolean;
  isActive: boolean;
  registrationNumber: string | null;
}) {
  const alerts: { level: string; message: string }[] = [];
  if (doctor.verificationStatus === 'SUSPENDED') {
    alerts.push({ level: 'red', message: 'Doctor account is suspended' });
  }
  if (!doctor.accountActivated) {
    alerts.push({ level: 'orange', message: 'Doctor dashboard not activated — pending verification' });
  }
  if (!doctor.registrationNumber) {
    alerts.push({ level: 'yellow', message: 'Medical registration number missing' });
  }
  if (doctor.verificationStatus === 'CORRECTION_REQUESTED') {
    alerts.push({ level: 'orange', message: 'Re-verification required' });
  }
  return alerts;
}

export interface DoctorSuspensionOptions {
  reason: string;
  suspendLogin?: boolean;
  hidePublicProfile?: boolean;
  stopNewAppointments?: boolean;
  stopAdvertisements?: boolean;
  disableAssociations?: boolean;
  fullSuspension?: boolean;
}

export async function suspendDoctor(
  doctorId: string,
  options: DoctorSuspensionOptions,
  actorUserId: string,
) {
  const full = options.fullSuspension ?? true;
  const existing = await prisma.doctor.findUnique({ where: { id: doctorId }, include: { user: true } });
  if (!existing) throw new Error('Doctor not found');

  const doctor = await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      verificationStatus: 'SUSPENDED',
      isActive: false,
      accountActivated: full || options.suspendLogin ? false : existing.accountActivated,
    },
  });

  if (options.suspendLogin || full) {
    await prisma.user.update({ where: { id: existing.userId }, data: { isActive: false } });
    await prisma.refreshToken.deleteMany({ where: { userId: existing.userId } });
  }

  if (options.stopAdvertisements || full) {
    await prisma.advertisement.updateMany({
      where: { organizationId: existing.organizationId, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: 'DOCTOR_SUSPENDED',
      entityType: 'Doctor',
      entityId: doctorId,
      details: options as unknown as Prisma.InputJsonValue,
    },
  });

  return doctor;
}

export async function activateDoctor(doctorId: string, actorUserId: string) {
  const existing = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!existing) throw new Error('Doctor not found');

  const doctor = await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      verificationStatus: 'APPROVED',
      isActive: true,
      accountActivated: true,
    },
  });

  await prisma.user.update({ where: { id: existing.userId }, data: { isActive: true } });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: 'DOCTOR_ACTIVATED',
      entityType: 'Doctor',
      entityId: doctorId,
    },
  });

  return doctor;
}

export async function requestDoctorReVerification(doctorId: string, reason: string, actorUserId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
  if (!doctor) throw new Error('Doctor not found');

  const updated = await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      verificationStatus: 'CORRECTION_REQUESTED',
      accountActivated: false,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: 'DOCTOR_RE_VERIFICATION',
      entityType: 'Doctor',
      entityId: doctorId,
      details: { reason } as Prisma.InputJsonValue,
    },
  });

  return updated;
}

export function doctorsToCsv(doctors: Record<string, unknown>[]): string {
  const headers = ['ID', 'Name', 'Specialization', 'Qualification', 'Registration', 'Verification', 'Active', 'Organization', 'City', 'Fee', 'Registered'];
  const rows = doctors.map((d) => {
    const org = d.organization as { name?: string; city?: string } | undefined;
    return [
      d.id,
      d.fullName,
      d.specialization,
      d.qualification,
      d.registrationNumber,
      d.verificationStatus,
      d.isActive ? 'Yes' : 'No',
      org?.name,
      org?.city,
      d.consultationFee,
      d.createdAt ? new Date(String(d.createdAt)).toISOString().slice(0, 10) : '',
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
