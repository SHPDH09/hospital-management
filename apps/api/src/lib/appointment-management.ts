import { AppointmentStatus, OrganizationType, PatientRegistrationSource, Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface AppointmentListFilters {
  search?: string;
  status?: string;
  paymentStatus?: string;
  organizationId?: string;
  organizationType?: OrganizationType;
  branchId?: string;
  doctorId?: string;
  patientId?: string;
  departmentId?: string;
  referralSource?: string;
  isOnline?: boolean;
  isEmergency?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function generateAppointmentNumber(): Promise<string> {
  const latest = await prisma.appointment.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { appointmentNumber: true },
  });
  const lastNum = latest?.appointmentNumber
    ? parseInt(latest.appointmentNumber.replace(/\D/g, ''), 10) || 0
    : 0;
  return `APT-${String(lastNum + 1).padStart(5, '0')}`;
}

export async function detectAppointmentConflict(params: {
  doctorId: string;
  patientId: string;
  appointmentDate: Date;
  startTime: string;
  excludeAppointmentId?: string;
}) {
  const conflicts: string[] = [];
  const { doctorId, patientId, appointmentDate, startTime, excludeAppointmentId } = params;
  const activeStatuses: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_CONSULTATION'];

  const doctorConflict = await prisma.appointment.findFirst({
    where: {
      doctorId,
      appointmentDate,
      startTime,
      status: { in: activeStatuses },
      ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
    },
  });
  if (doctorConflict) conflicts.push('Doctor already has an appointment at this time');

  const patientConflict = await prisma.appointment.findFirst({
    where: {
      patientId,
      appointmentDate,
      startTime,
      status: { in: activeStatuses },
      ...(excludeAppointmentId && { id: { not: excludeAppointmentId } }),
    },
  });
  if (patientConflict) conflicts.push('Patient already has an appointment at this time');

  return conflicts;
}

export async function getAppointmentManagementDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const activeWhere = { status: { notIn: ['CANCELLED', 'REJECTED'] as AppointmentStatus[] } };

  const [
    totalAppointments,
    todayAppointments,
    upcomingAppointments,
    completed,
    cancelled,
    rescheduled,
    noShow,
    pendingConfirmation,
    onlineConsultations,
    emergencyAppointments,
    referralAppointments,
    todayConfirmed,
    todayPending,
    todayCompleted,
    todayCancelled,
    todayNoShow,
    adAppointments,
  ] = await Promise.all([
    prisma.appointment.count(),
    prisma.appointment.count({ where: { appointmentDate: { gte: today, lt: tomorrow } } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: tomorrow }, ...activeWhere } }),
    prisma.appointment.count({ where: { status: 'COMPLETED' } }),
    prisma.appointment.count({ where: { status: 'CANCELLED' } }),
    prisma.appointment.count({ where: { status: 'RESCHEDULED' } }),
    prisma.appointment.count({ where: { status: 'NO_SHOW' } }),
    prisma.appointment.count({ where: { status: 'PENDING' } }),
    prisma.appointment.count({ where: { isOnline: true } }),
    prisma.appointment.count({ where: { isEmergency: true } }),
    prisma.appointment.count({ where: { referralSource: { in: ['REFERRAL', 'AASHA'] } } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: today, lt: tomorrow }, status: 'CONFIRMED' } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: today, lt: tomorrow }, status: 'PENDING' } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: today, lt: tomorrow }, status: 'COMPLETED' } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: today, lt: tomorrow }, status: 'CANCELLED' } }),
    prisma.appointment.count({ where: { appointmentDate: { gte: today, lt: tomorrow }, status: 'NO_SHOW' } }),
    prisma.appointment.count({ where: { advertisementId: { not: null } } }),
  ]);

  const bySource = await prisma.appointment.groupBy({
    by: ['referralSource'],
    _count: true,
    where: { referralSource: { not: null } },
  });

  const byOrgType = await Promise.all([
    prisma.appointment.count({ where: { organization: { type: 'HOSPITAL' } } }),
    prisma.appointment.count({ where: { organization: { type: 'CLINIC' } } }),
  ]);

  return {
    totalAppointments,
    todayAppointments,
    upcomingAppointments,
    completed,
    cancelled,
    rescheduled,
    noShow,
    pendingConfirmation,
    onlineConsultations,
    emergencyAppointments,
    referralAppointments,
    advertisementAppointments: adAppointments,
    todayStats: {
      total: todayAppointments,
      confirmed: todayConfirmed,
      pending: todayPending,
      completed: todayCompleted,
      cancelled: todayCancelled,
      noShow: todayNoShow,
    },
    bySource: bySource.map((s) => ({ source: s.referralSource || 'DIRECT', count: s._count })),
    byHospital: byOrgType[0],
    byClinic: byOrgType[1],
  };
}

export async function listAppointments(filters: AppointmentListFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.AppointmentWhereInput = {
    ...(filters.status && { status: filters.status as AppointmentStatus }),
    ...(filters.paymentStatus && { paymentStatus: filters.paymentStatus as never }),
    ...(filters.organizationId && { organizationId: filters.organizationId }),
    ...(filters.organizationType && { organization: { type: filters.organizationType } }),
    ...(filters.branchId && { branchId: filters.branchId }),
    ...(filters.doctorId && { doctorId: filters.doctorId }),
    ...(filters.patientId && { patientId: filters.patientId }),
    ...(filters.departmentId && { departmentId: filters.departmentId }),
    ...(filters.referralSource && { referralSource: filters.referralSource as PatientRegistrationSource }),
    ...(filters.isOnline !== undefined && { isOnline: filters.isOnline }),
    ...(filters.isEmergency !== undefined && { isEmergency: filters.isEmergency }),
    ...(filters.dateFrom || filters.dateTo) && {
      appointmentDate: {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
      },
    },
    ...(filters.search && {
      OR: [
        { appointmentNumber: { contains: filters.search, mode: 'insensitive' } },
        { patient: { fullName: { contains: filters.search, mode: 'insensitive' } } },
        { patient: { globalPatientId: { contains: filters.search, mode: 'insensitive' } } },
        { doctor: { fullName: { contains: filters.search, mode: 'insensitive' } } },
        { organization: { name: { contains: filters.search, mode: 'insensitive' } } },
      ],
    }),
  };

  const [appointments, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ appointmentDate: 'desc' }, { startTime: 'desc' }],
      include: {
        patient: { select: { id: true, fullName: true, globalPatientId: true, city: true } },
        doctor: { select: { id: true, fullName: true, specialization: true } },
        organization: { select: { id: true, name: true, type: true, city: true, logoUrl: true } },
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        bills: { include: { payments: { take: 1, orderBy: { createdAt: 'desc' } } }, take: 1 },
      },
    }),
    prisma.appointment.count({ where }),
  ]);

  return { appointments, page, limit, total };
}

export async function getAppointmentOverview(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: {
        include: { user: { select: { email: true, phone: true } } },
      },
      doctor: { include: { department: true, branch: true } },
      organization: true,
      branch: true,
      department: true,
      slot: true,
      bills: { include: { payments: true, items: true } },
    },
  });
  if (!appointment) return null;

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: 'Appointment', entityId: appointmentId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { user: { select: { email: true } } },
  });

  return { appointment, auditLogs };
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
  actorUserId: string,
  reason?: string,
) {
  const existing = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!existing) throw new Error('Appointment not found');

  const data: Prisma.AppointmentUpdateInput = {
    status,
    ...(status === 'CHECKED_IN' && { checkedInAt: new Date() }),
    ...(status === 'CANCELLED' && reason && { cancellationReason: reason }),
  };

  if (status === 'CANCELLED' && existing.slotId) {
    await prisma.appointmentSlot.update({ where: { id: existing.slotId }, data: { isBooked: false } });
  }

  const appointment = await prisma.appointment.update({ where: { id: appointmentId }, data });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: 'APPOINTMENT_STATUS_CHANGE',
      entityType: 'Appointment',
      entityId: appointmentId,
      details: { from: existing.status, to: status, reason } as Prisma.InputJsonValue,
    },
  });

  return appointment;
}

export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string | undefined,
  actorUserId: string,
) {
  const existing = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!existing) throw new Error('Appointment not found');

  const conflicts = await detectAppointmentConflict({
    doctorId: existing.doctorId,
    patientId: existing.patientId,
    appointmentDate: new Date(newDate),
    startTime: newStartTime,
    excludeAppointmentId: appointmentId,
  });
  if (conflicts.length) throw new Error(conflicts.join('; '));

  if (existing.slotId) {
    await prisma.appointmentSlot.update({ where: { id: existing.slotId }, data: { isBooked: false } });
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'RESCHEDULED' },
  });

  const appointmentNumber = await generateAppointmentNumber();
  const newAppointment = await prisma.appointment.create({
    data: {
      appointmentNumber,
      organizationId: existing.organizationId,
      branchId: existing.branchId,
      patientId: existing.patientId,
      doctorId: existing.doctorId,
      departmentId: existing.departmentId,
      appointmentDate: new Date(newDate),
      startTime: newStartTime,
      endTime: newEndTime,
      type: existing.type,
      status: 'CONFIRMED',
      paymentStatus: existing.paymentStatus,
      referralSource: existing.referralSource,
      referralId: existing.referralId,
      referralName: existing.referralName,
      isOnline: existing.isOnline,
      isEmergency: existing.isEmergency,
      rescheduledFromId: appointmentId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: 'APPOINTMENT_RESCHEDULED',
      entityType: 'Appointment',
      entityId: newAppointment.id,
      details: { fromAppointmentId: appointmentId, newDate, newStartTime } as Prisma.InputJsonValue,
    },
  });

  return newAppointment;
}

export async function checkInAppointment(appointmentId: string, actorUserId: string, tokenNumber?: string) {
  const existing = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!existing) throw new Error('Appointment not found');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const count = await prisma.appointment.count({
    where: {
      organizationId: existing.organizationId,
      appointmentDate: existing.appointmentDate,
      status: { in: ['CHECKED_IN', 'IN_CONSULTATION'] },
    },
  });
  const token = tokenNumber || `A-${count + 1}`;

  const appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CHECKED_IN', checkedInAt: new Date(), tokenNumber: token },
  });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: 'APPOINTMENT_CHECK_IN',
      entityType: 'Appointment',
      entityId: appointmentId,
      details: { tokenNumber: token } as Prisma.InputJsonValue,
    },
  });

  return appointment;
}

export function appointmentsToCsv(appointments: Record<string, unknown>[]): string {
  const headers = ['APT ID', 'Patient', 'Doctor', 'Organization', 'Date', 'Time', 'Type', 'Status', 'Payment', 'Source'];
  const rows = appointments.map((a) => {
    const patient = a.patient as { fullName?: string } | undefined;
    const doctor = a.doctor as { fullName?: string } | undefined;
    const org = a.organization as { name?: string } | undefined;
    return [
      a.appointmentNumber,
      patient?.fullName,
      doctor?.fullName,
      org?.name,
      a.appointmentDate ? new Date(String(a.appointmentDate)).toISOString().slice(0, 10) : '',
      a.startTime,
      a.type,
      a.status,
      a.paymentStatus,
      a.referralSource || 'DIRECT',
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
