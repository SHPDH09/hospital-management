import { prisma } from './prisma';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseTimeToMinutes(time: string): number {
  if (!TIME_RE.test(time)) throw new Error(`Invalid time format: ${time}`);
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function buildSlotTimes(startTime: string, endTime: string, slotMinutes: number): string[] {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (end <= start) return [];
  const slots: string[] = [];
  for (let t = start; t + slotMinutes <= end; t += slotMinutes) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

export function eachDateInRange(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    dates.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export async function isDoctorOnLeave(doctorId: string, date: Date): Promise<boolean> {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const leave = await prisma.doctorLeave.findFirst({
    where: {
      doctorId,
      status: 'APPROVED',
      startDate: { lte: d },
      endDate: { gte: d },
    },
  });
  return !!leave;
}

export async function generateSlotsFromWeeklySchedule(opts: {
  doctorId: string;
  fromDate: Date;
  toDate: Date;
}): Promise<{ created: number; skipped: number }> {
  const { doctorId, fromDate, toDate } = opts;
  const schedules = await prisma.doctorWeeklySchedule.findMany({
    where: { doctorId, isActive: true },
  });
  if (!schedules.length) return { created: 0, skipped: 0 };

  const scheduleByDay = new Map(schedules.map((s) => [s.dayOfWeek, s]));
  let created = 0;
  let skipped = 0;

  for (const date of eachDateInRange(fromDate, toDate)) {
    const schedule = scheduleByDay.get(date.getDay());
    if (!schedule) continue;
    if (await isDoctorOnLeave(doctorId, date)) {
      skipped += buildSlotTimes(schedule.startTime, schedule.endTime, schedule.slotMinutes).length;
      continue;
    }

    const starts = buildSlotTimes(schedule.startTime, schedule.endTime, schedule.slotMinutes);
    for (const startTime of starts) {
      const endMinutes = parseTimeToMinutes(startTime) + schedule.slotMinutes;
      const endTime = minutesToTime(endMinutes);
      try {
        await prisma.appointmentSlot.create({
          data: { doctorId, date, startTime, endTime },
        });
        created += 1;
      } catch {
        skipped += 1;
      }
    }
  }

  return { created, skipped };
}

export async function countDoctorsOnLeaveToday(orgId?: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const leaves = await prisma.doctorLeave.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: today },
      endDate: { gte: today },
      ...(orgId ? { organizationId: orgId } : {}),
    },
    select: { doctorId: true },
    distinct: ['doctorId'],
  });
  return leaves.length;
}
