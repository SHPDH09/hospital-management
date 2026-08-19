import { prisma } from '../../lib/prisma';
import { calculateNoShowRisk } from './no-show-risk';
import { notifyPlatformAdmins } from '../notifications/notification-service';

export async function scanUpcomingNoShowRisk() {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600000);

  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ['PENDING', 'CONFIRMED'] },
      appointmentDate: { gte: now, lte: in48h },
    },
    include: {
      patient: { select: { fullName: true } },
      doctor: { select: { fullName: true } },
      organization: { select: { name: true } },
    },
    take: 100,
  });

  const results = [];
  let highRiskCount = 0;

  for (const appt of appointments) {
    const risk = await calculateNoShowRisk(appt.id);
    if (risk === 'HIGH') {
      highRiskCount += 1;
      results.push({
        appointmentId: appt.id,
        date: appt.appointmentDate,
        startTime: appt.startTime,
        patient: appt.patient.fullName,
        doctor: appt.doctor.fullName,
        organization: appt.organization.name,
        noShowRisk: risk,
        confirmationStatus: appt.confirmationStatus,
      });
    }
  }

  if (highRiskCount >= 5) {
    await notifyPlatformAdmins(
      'High no-show risk appointments',
      `${highRiskCount} upcoming appointments in the next 48 hours are high no-show risk.`,
      'appointment_risk'
    );
  }

  return { scanned: appointments.length, highRiskCount, highRiskAppointments: results };
}

export async function getNoShowRiskDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 2);

  const [high, medium, low, upcoming] = await Promise.all([
    prisma.appointment.count({ where: { noShowRisk: 'HIGH', appointmentDate: { gte: today, lte: tomorrow }, status: { in: ['PENDING', 'CONFIRMED'] } } }),
    prisma.appointment.count({ where: { noShowRisk: 'MEDIUM', appointmentDate: { gte: today, lte: tomorrow }, status: { in: ['PENDING', 'CONFIRMED'] } } }),
    prisma.appointment.count({ where: { noShowRisk: 'LOW', appointmentDate: { gte: today, lte: tomorrow }, status: { in: ['PENDING', 'CONFIRMED'] } } }),
    prisma.appointment.findMany({
      where: { noShowRisk: 'HIGH', appointmentDate: { gte: today, lte: tomorrow }, status: { in: ['PENDING', 'CONFIRMED'] } },
      include: { patient: { select: { fullName: true } }, doctor: { select: { fullName: true } }, organization: { select: { name: true } } },
      take: 20,
      orderBy: { appointmentDate: 'asc' },
    }),
  ]);

  return { high, medium, low, highRiskAppointments: upcoming };
}
