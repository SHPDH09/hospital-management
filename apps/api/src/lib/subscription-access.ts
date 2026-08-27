import { Subscription, SubscriptionPlan } from '@prisma/client';
import { prisma } from './prisma';
import { settingsKey, mergeWithDefaults } from './settings';

export type SubscriptionAccessLevel = 'full' | 'basic' | 'blocked';

/** CRM modules that stay available when subscription is expired (basic tier). */
export const BASIC_CRM_MODULES = new Set([
  'dashboard',
  'subscription',
  'support',
  'profile',
  'doctors',
  'notifications',
]);

/** Map CRM API path prefixes to module keys for access checks. */
export function crmPathToModule(path: string): string {
  const segment = path.replace(/^\/+/, '').split('/')[0] || 'dashboard';
  const map: Record<string, string> = {
    profile: 'profile',
    subscription: 'subscription',
    support: 'support',
    doctors: 'doctors',
    notifications: 'notifications',
    analytics: 'analytics',
    branches: 'branches',
    departments: 'departments',
    documents: 'documents',
    staff: 'staff',
    roles: 'roles',
    patients: 'patients',
    appointments: 'appointments',
    schedule: 'schedule',
    services: 'services',
    'health-packages': 'health-packages',
    billing: 'billing',
    leads: 'leads',
    advertisements: 'advertisements',
    reviews: 'reviews',
    communications: 'communications',
    settings: 'settings',
    'audit-logs': 'audit-logs',
  };
  return map[segment] || segment;
}

export function isBasicModule(module: string): boolean {
  return BASIC_CRM_MODULES.has(module);
}

export async function getOrgSubscription(orgId: string) {
  return prisma.subscription.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    include: { plan: true },
  });
}

/** Auto-expire TRIAL/ACTIVE subscriptions past endDate (no cron required). */
export async function refreshSubscriptionStatus(
  sub: (Subscription & { plan: SubscriptionPlan }) | null,
): Promise<(Subscription & { plan: SubscriptionPlan }) | null> {
  if (!sub?.endDate) return sub;
  const pastEnd = sub.endDate.getTime() < Date.now();
  if (pastEnd && (sub.status === 'ACTIVE' || sub.status === 'TRIAL')) {
    return prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'EXPIRED' },
      include: { plan: true },
    });
  }
  return sub;
}

export interface SubscriptionAccessInfo {
  accessLevel: SubscriptionAccessLevel;
  status: string;
  planName: string;
  planId: string;
  daysRemaining: number | null;
  isExpired: boolean;
  isTrial: boolean;
  isRestricted: boolean;
  bannerMessage: string | null;
  bannerType: 'info' | 'warning' | 'error' | null;
  allowedModules: string[];
  lockedModules: string[];
}

export function computeSubscriptionAccess(
  sub: (Subscription & { plan: SubscriptionPlan }) | null,
  trialPeriodDays = 15,
): SubscriptionAccessInfo {
  const allModules = [
    'dashboard', 'analytics', 'notifications', 'profile', 'branches', 'departments', 'documents',
    'doctors', 'staff', 'roles', 'patients', 'appointments', 'schedule', 'services', 'health-packages',
    'billing', 'leads', 'advertisements', 'reviews', 'communications', 'subscription', 'support', 'settings', 'audit-logs',
  ];
  const basicList = [...BASIC_CRM_MODULES];

  if (!sub) {
    return {
      accessLevel: 'blocked',
      status: 'NONE',
      planName: 'None',
      planId: '',
      daysRemaining: null,
      isExpired: true,
      isTrial: false,
      isRestricted: true,
      bannerMessage: 'No subscription found. Please subscribe to a plan to continue.',
      bannerType: 'error',
      allowedModules: ['subscription', 'support'],
      lockedModules: allModules.filter((m) => !['subscription', 'support'].includes(m)),
    };
  }

  const daysRemaining = sub.endDate
    ? Math.ceil((sub.endDate.getTime() - Date.now()) / 86_400_000)
    : null;
  const isPastEnd = sub.endDate ? sub.endDate.getTime() < Date.now() : false;
  const isTrial = sub.status === 'TRIAL';
  const isExpired = sub.status === 'EXPIRED' || sub.status === 'SUSPENDED' || sub.status === 'CANCELLED' || isPastEnd;
  const isRestricted = isExpired;

  if (!isExpired && (sub.status === 'ACTIVE' || sub.status === 'TRIAL')) {
    let bannerMessage: string | null = null;
    let bannerType: 'info' | 'warning' | 'error' | null = null;
    if (isTrial && daysRemaining != null && daysRemaining <= 7 && daysRemaining >= 0) {
      bannerType = 'warning';
      bannerMessage = `Your ${trialPeriodDays}-day free trial ends in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Choose a plan to keep all services unlocked.`;
    } else if (!isTrial && daysRemaining != null && daysRemaining <= 7 && daysRemaining >= 0) {
      bannerType = 'warning';
      bannerMessage = `Your ${sub.plan.name} plan expires in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}. Renew now to avoid interruption.`;
    }
    return {
      accessLevel: 'full',
      status: sub.status,
      planName: sub.plan.name,
      planId: sub.planId,
      daysRemaining,
      isExpired: false,
      isTrial,
      isRestricted: false,
      bannerMessage,
      bannerType,
      allowedModules: allModules,
      lockedModules: [],
    };
  }

  return {
    accessLevel: 'basic',
    status: isPastEnd && sub.status === 'TRIAL' ? 'EXPIRED' : sub.status,
    planName: sub.plan.name,
    planId: sub.planId,
    daysRemaining,
    isExpired: true,
    isTrial: false,
    isRestricted: true,
    bannerMessage: 'Your subscription has expired. Please subscribe to a plan and continue. Only basic services are available until you upgrade.',
    bannerType: 'error',
    allowedModules: basicList,
    lockedModules: allModules.filter((m) => !basicList.includes(m)),
  };
}

export async function getSubscriptionAccessForOrg(orgId: string): Promise<SubscriptionAccessInfo> {
  let sub = await getOrgSubscription(orgId);
  sub = await refreshSubscriptionStatus(sub);
  const settingsRow = await prisma.platformSetting.findUnique({ where: { key: settingsKey('subscriptions') } });
  const settings = mergeWithDefaults('subscriptions', settingsRow?.value as Record<string, unknown> | null);
  const trialPeriodDays = Number(settings.trialPeriodDays) || 15;
  return computeSubscriptionAccess(sub, trialPeriodDays);
}

export function canAccessModule(access: SubscriptionAccessInfo, module: string): boolean {
  if (access.accessLevel === 'full') return true;
  if (access.accessLevel === 'blocked') return module === 'subscription' || module === 'support';
  return isBasicModule(module);
}
