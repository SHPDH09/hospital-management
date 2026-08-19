import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { AuthRequest } from '../middleware/auth';
import {
  mergeWithDefaults,
  settingsKey,
} from './settings';

export type SystemStatusLevel = 'normal' | 'partial' | 'emergency' | 'maintenance';

export async function getEmergencyState(): Promise<Record<string, unknown>> {
  const row = await prisma.platformSetting.findUnique({ where: { key: settingsKey('emergency') } });
  return mergeWithDefaults('emergency', row?.value as Record<string, unknown> | null);
}

export async function saveEmergencyState(state: Record<string, unknown>) {
  await prisma.platformSetting.upsert({
    where: { key: settingsKey('emergency') },
    update: { value: state as Prisma.InputJsonValue, category: 'settings' },
    create: { key: settingsKey('emergency'), value: state as Prisma.InputJsonValue, category: 'settings' },
  });
}

export function computeSystemStatus(state: Record<string, unknown>): SystemStatusLevel {
  const maintenanceMode = Boolean(state.maintenanceMode);
  const maintenanceType = String(state.maintenanceType || 'full');
  if (maintenanceMode && maintenanceType === 'full') return 'maintenance';
  if (Boolean(state.emergencyModeActive)) return 'emergency';

  const modules = (state.modules || {}) as Record<string, boolean>;
  const payment = (state.payment || {}) as Record<string, boolean>;
  const appointment = (state.appointment || {}) as Record<string, unknown>;
  const api = (state.api || {}) as Record<string, boolean>;
  const communication = (state.communication || {}) as Record<string, boolean>;

  const moduleDisabled = Object.values(modules).some((v) => v === false);
  const paymentIssue = Object.entries(payment).some(([k, v]) => k.endsWith('Disabled') && v === true);
  const apiIssue = Boolean(api.globallyDisabled) || ['appointmentApi', 'paymentApi', 'searchApi'].some((k) => api[k] === false);
  const commIssue = ['email', 'sms', 'whatsapp', 'push'].some((k) => communication[k] === false);
  const partialMaintenance = maintenanceMode && maintenanceType === 'partial';
  const appointmentIssue = Boolean(appointment.newAppointmentsDisabled) || Boolean(state.disableAppointmentBooking);

  if (moduleDisabled || paymentIssue || apiIssue || commIssue || partialMaintenance || appointmentIssue || Boolean(state.readOnlyMode)) {
    return 'partial';
  }
  return 'normal';
}

export function getActiveControls(state: Record<string, unknown>): string[] {
  const active: string[] = [];
  if (Boolean(state.emergencyModeActive)) active.push('Emergency Mode');
  if (Boolean(state.maintenanceMode)) active.push(`Maintenance (${state.maintenanceType || 'full'})`);
  if (Boolean(state.readOnlyMode)) active.push('Read-Only Mode');

  const modules = (state.modules || {}) as Record<string, boolean>;
  for (const [key, enabled] of Object.entries(modules)) {
    if (!enabled) active.push(`${formatLabel(key)} OFF`);
  }

  const payment = (state.payment || {}) as Record<string, boolean>;
  if (payment.onlinePaymentDisabled) active.push('Online Payment OFF');
  if (payment.razorpayDisabled) active.push('Razorpay OFF');
  if (payment.stripeDisabled) active.push('Stripe OFF');

  const comm = (state.communication || {}) as Record<string, boolean>;
  if (!comm.email) active.push('Email OFF');
  if (!comm.sms) active.push('SMS OFF');
  if (!comm.whatsapp) active.push('WhatsApp OFF');
  if (!comm.push) active.push('Push OFF');

  return active;
}

function formatLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

export function getAffectedModules(state: Record<string, unknown>): string[] {
  const affected: string[] = [];
  const modules = (state.modules || {}) as Record<string, boolean>;
  for (const [key, enabled] of Object.entries(modules)) {
    if (!enabled) affected.push(formatLabel(key));
  }
  const maintenanceModules = (state.maintenanceModules || []) as string[];
  for (const m of maintenanceModules) affected.push(m);
  return [...new Set(affected)];
}

export async function logEmergencyAction(
  req: AuthRequest,
  action: string,
  reason: string,
  options?: { details?: Prisma.InputJsonValue; affectedScope?: string }
) {
  await prisma.emergencyActionLog.create({
    data: {
      action,
      reason,
      performedById: req.user?.userId,
      performedByEmail: req.user?.email,
      details: options?.details,
      affectedScope: options?.affectedScope,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip,
    },
  });
}

export function syncLegacyFlags(state: Record<string, unknown>): Record<string, unknown> {
  const modules = (state.modules || {}) as Record<string, boolean>;
  const payment = (state.payment || {}) as Record<string, boolean>;
  const comm = (state.communication || {}) as Record<string, boolean>;

  return {
    ...state,
    disableRegistration: !modules.patientRegistration && !modules.hospitalRegistration && !modules.clinicRegistration && !modules.doctorRegistration,
    disableAppointmentBooking: !modules.appointmentBooking || Boolean((state.appointment as Record<string, unknown>)?.newAppointmentsDisabled),
    disablePayments: payment.onlinePaymentDisabled || !modules.onlinePayment,
    disableAdvertisements: !modules.advertisement,
    disableCommunication: !comm.email && !comm.sms && !comm.whatsapp && !comm.push,
    systemStatus: computeSystemStatus(state),
  };
}

export const MODULE_KEYS = [
  'patientRegistration',
  'hospitalRegistration',
  'clinicRegistration',
  'doctorRegistration',
  'appointmentBooking',
  'onlinePayment',
  'advertisement',
  'messaging',
  'fileUpload',
  'publicSearch',
] as const;

export const STATUS_LABELS: Record<SystemStatusLevel, { label: string; color: string; icon: string }> = {
  normal: { label: 'System Normal', color: 'green', icon: '🟢' },
  partial: { label: 'Partial Restriction', color: 'yellow', icon: '🟡' },
  emergency: { label: 'Emergency Mode Active', color: 'red', icon: '🔴' },
  maintenance: { label: 'Full Maintenance Mode', color: 'gray', icon: '⚫' },
};
