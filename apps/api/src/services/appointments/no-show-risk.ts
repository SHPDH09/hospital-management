import { NoShowRisk } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export async function calculateNoShowRisk(appointmentId: string): Promise<NoShowRisk> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true },
  });
  if (!appointment) throw new Error('Appointment not found');

  const history = await prisma.appointment.findMany({
    where: {
      patientId: appointment.patientId,
      id: { not: appointmentId },
      status: { in: ['NO_SHOW', 'CANCELLED', 'COMPLETED'] },
    },
    take: 20,
    orderBy: { appointmentDate: 'desc' },
  });

  let riskPoints = 0;
  const noShows = history.filter((a) => a.status === 'NO_SHOW').length;
  const cancellations = history.filter((a) => a.status === 'CANCELLED').length;
  riskPoints += noShows * 25;
  riskPoints += cancellations * 10;

  if (appointment.confirmationStatus !== 'CONFIRMED') riskPoints += 15;

  const hour = parseInt(appointment.startTime.split(':')[0], 10);
  if (hour < 9 || hour >= 18) riskPoints += 10;

  let noShowRisk: NoShowRisk = 'LOW';
  if (riskPoints >= 40) noShowRisk = 'HIGH';
  else if (riskPoints >= 20) noShowRisk = 'MEDIUM';

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { noShowRisk },
  });

  return noShowRisk;
}
