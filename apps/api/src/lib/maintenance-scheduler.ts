import { ScheduledMaintenance } from '@prisma/client';
import { prisma } from './prisma';
import { getEmergencyState, saveEmergencyState, syncLegacyFlags } from './emergency';

export interface MaintenancePublicInfo {
  status: 'none' | 'upcoming' | 'active';
  title?: string;
  message?: string;
  maintenanceType?: string;
  startAt?: string;
  endAt?: string;
  hoursUntilStart?: number;
  hoursRemaining?: number;
  scheduledId?: string;
}

function hoursBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 3_600_000));
}

export async function getActiveScheduledMaintenance(now = new Date()): Promise<ScheduledMaintenance | null> {
  return prisma.scheduledMaintenance.findFirst({
    where: {
      isActive: true,
      autoActivate: true,
      startAt: { lte: now },
      endAt: { gte: now },
    },
    orderBy: { startAt: 'desc' },
  });
}

export async function getUpcomingScheduledMaintenance(now = new Date()): Promise<ScheduledMaintenance | null> {
  return prisma.scheduledMaintenance.findFirst({
    where: { isActive: true, startAt: { gt: now } },
    orderBy: { startAt: 'asc' },
  });
}

/** Auto-enable/disable maintenance from scheduled windows and return public-facing info. */
export async function processScheduledMaintenances(): Promise<MaintenancePublicInfo> {
  const now = new Date();
  const active = await getActiveScheduledMaintenance(now);
  const upcoming = active ? null : await getUpcomingScheduledMaintenance(now);
  const state = await getEmergencyState();
  const scheduledId = state.scheduledMaintenanceId as string | undefined;

  if (active) {
    const message = active.description || active.title;
    const shouldUpdate = !state.maintenanceMode
      || state.scheduledMaintenanceId !== active.id
      || state.maintenanceMessage !== message;

    if (shouldUpdate) {
      await saveEmergencyState(syncLegacyFlags({
        ...state,
        maintenanceMode: true,
        maintenanceType: active.maintenanceType,
        maintenanceMessage: message,
        maintenanceModules: active.affectedModules,
        scheduledMaintenanceId: active.id,
      }));
      await notifyMaintenanceActive(active);
    }

    return {
      status: 'active',
      title: active.title,
      message,
      maintenanceType: active.maintenanceType,
      startAt: active.startAt.toISOString(),
      endAt: active.endAt.toISOString(),
      hoursRemaining: hoursBetween(now, active.endAt),
      scheduledId: active.id,
    };
  }

  if (scheduledId) {
    const ended = await prisma.scheduledMaintenance.findFirst({
      where: { id: scheduledId, OR: [{ isActive: false }, { endAt: { lt: now } }] },
    });
    if (ended && state.maintenanceMode) {
      await saveEmergencyState(syncLegacyFlags({
        ...state,
        maintenanceMode: false,
        maintenanceType: 'full',
        maintenanceModules: [],
        scheduledMaintenanceId: null,
        maintenanceMessage: 'We are currently performing scheduled maintenance.',
      }));
    }
  }

  if (upcoming) {
    return {
      status: 'upcoming',
      title: upcoming.title,
      message: upcoming.description || `Scheduled maintenance begins ${upcoming.startAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.`,
      maintenanceType: upcoming.maintenanceType,
      startAt: upcoming.startAt.toISOString(),
      endAt: upcoming.endAt.toISOString(),
      hoursUntilStart: hoursBetween(now, upcoming.startAt),
      scheduledId: upcoming.id,
    };
  }

  return { status: 'none' };
}

export async function notifyMaintenanceScheduled(item: ScheduledMaintenance) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const start = item.startAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
  const end = item.endAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

  for (const { id: userId } of users) {
    const exists = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'MAINTENANCE_SCHEDULED',
        AND: [{ data: { path: ['maintenanceId'], equals: item.id } }],
      },
    });
    if (exists) continue;

    await prisma.notification.create({
      data: {
        userId,
        type: 'MAINTENANCE_SCHEDULED',
        title: 'Scheduled Maintenance',
        message: `${item.title} is planned from ${start} to ${end}. Some services may be unavailable.`,
        data: {
          maintenanceId: item.id,
          title: item.title,
          startAt: item.startAt.toISOString(),
          endAt: item.endAt.toISOString(),
          maintenanceType: item.maintenanceType,
        },
      },
    });
  }
}

async function notifyMaintenanceActive(item: ScheduledMaintenance) {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  const end = item.endAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

  for (const { id: userId } of users) {
    const exists = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'MAINTENANCE_ACTIVE',
        AND: [{ data: { path: ['maintenanceId'], equals: item.id } }],
      },
    });
    if (exists) continue;

    await prisma.notification.create({
      data: {
        userId,
        type: 'MAINTENANCE_ACTIVE',
        title: 'Maintenance In Progress',
        message: `${item.title} is now active. Expected completion by ${end}.`,
        data: { maintenanceId: item.id, endAt: item.endAt.toISOString() },
      },
    });
  }
}
