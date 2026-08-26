import { prisma } from '../../lib/prisma';

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface SlotRecommendation {
  slotId: string;
  date: Date;
  startTime: string;
  endTime: string;
  score: number;
  reason: string;
}

export async function recommendSlots(input: {
  doctorId: string;
  date?: string;
  preferredTime?: string;
  limit?: number;
}): Promise<SlotRecommendation[]> {
  const { doctorId, preferredTime, limit = 5 } = input;
  const targetDate = input.date ? new Date(input.date) : new Date();
  targetDate.setHours(0, 0, 0, 0);

  const endDate = new Date(targetDate);
  endDate.setDate(endDate.getDate() + 7);

  const preferredMins = preferredTime ? timeToMinutes(preferredTime) : 14 * 60; // default 2pm

  const slots = await prisma.appointmentSlot.findMany({
    where: {
      doctorId,
      isBooked: false,
      date: { gte: targetDate, lte: endDate },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    take: 100,
  });

  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { fullName: true, organizationId: true },
  });
  if (!doctor) return [];

  const dayLoad = await prisma.appointment.groupBy({
    by: ['appointmentDate'],
    where: {
      doctorId,
      appointmentDate: { gte: targetDate, lte: endDate },
      status: { notIn: ['CANCELLED'] },
    },
    _count: { id: true },
  });
  const loadMap = Object.fromEntries(
    dayLoad.map((d) => [d.appointmentDate.toISOString().slice(0, 10), d._count.id])
  );

  const scored: SlotRecommendation[] = slots.map((slot) => {
    let score = 100;
    const slotMins = timeToMinutes(slot.startTime);
    const timeDiff = Math.abs(slotMins - preferredMins);
    score -= Math.min(40, Math.floor(timeDiff / 15) * 5);

    const dayKey = slot.date.toISOString().slice(0, 10);
    const load = loadMap[dayKey] || 0;
    score -= Math.min(30, load * 3);

    if (slotMins >= 9 * 60 && slotMins <= 17 * 60) score += 10;

    let reason = 'Available slot';
    if (timeDiff <= 30) reason = 'Matches preferred time';
    else if (timeDiff <= 60) reason = 'Close to preferred time';
    if (load >= 8) reason += '; doctor has high load that day';

    return {
      slotId: slot.id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      score: Math.max(0, score),
      reason,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
