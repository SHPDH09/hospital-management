import { prisma } from '../../lib/prisma';
import { emitAutomationEvent } from '../automation/engine';
import { enqueueJob } from '../jobs/queue';
import { sendMultiChannel } from '../notifications/notification-service';
import { calculateNoShowRisk } from './no-show-risk';

export async function scheduleAppointmentReminders(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: { include: { user: true } } },
  });
  if (!appointment) return;

  const apptDateTime = new Date(appointment.appointmentDate);
  const [h, m] = appointment.startTime.split(':').map(Number);
  apptDateTime.setHours(h, m || 0, 0, 0);

  const reminder24h = new Date(apptDateTime.getTime() - 24 * 3600000);
  const reminder2h = new Date(apptDateTime.getTime() - 2 * 3600000);

  if (reminder24h > new Date()) {
    await enqueueJob('appointment_reminder', { appointmentId, reminderType: '24h' }, reminder24h);
  }
  if (reminder2h > new Date()) {
    await enqueueJob('appointment_reminder', { appointmentId, reminderType: '2h' }, reminder2h);
  }

  await enqueueJob('appointment_risk_scan', { appointmentId }, new Date());
  await emitAutomationEvent('appointment.created', 'appointment', appointmentId, {
    organizationId: appointment.organizationId,
    patientId: appointment.patientId,
  });
}

export async function handleAppointmentReminder(appointmentId: string, reminderType: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      patient: { include: { user: true } },
      doctor: { select: { fullName: true } },
      organization: { select: { name: true } },
    },
  });
  if (!appointment || ['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(appointment.status)) return;

  const risk = appointment.noShowRisk || (await calculateNoShowRisk(appointmentId));
  const title = reminderType === '2h' ? 'Appointment in 2 hours' : 'Appointment tomorrow';
  let message = `Reminder: Your appointment with Dr. ${appointment.doctor.fullName} at ${appointment.organization.name} is on ${appointment.appointmentDate.toISOString().slice(0, 10)} at ${appointment.startTime}.`;

  if (risk === 'HIGH') {
    message += ' Please confirm your attendance.';
  }

  if (appointment.patient.user) {
    await sendMultiChannel(
      ['push', 'email'],
      {
        userId: appointment.patient.user.id,
        email: appointment.patient.user.email,
        phone: appointment.patient.user.phone || undefined,
      },
      title,
      message
    );
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { reminderSentAt: new Date() },
  });

  await emitAutomationEvent('appointment.upcoming', 'appointment', appointmentId, {
    hoursBefore: reminderType === '2h' ? 2 : 24,
    noShowRisk: risk,
  });
}

export async function scanUpcomingAppointmentReminders() {
  const now = new Date();
  const in25h = new Date(now.getTime() + 25 * 3600000);
  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      appointmentDate: { gte: now, lte: in25h },
      reminderSentAt: null,
    },
    take: 100,
  });

  for (const appt of appointments) {
    await scheduleAppointmentReminders(appt.id);
  }
  return appointments.length;
}
