import { prisma } from './prisma';
import { ReferralEventType, CommissionStatus, CommissionRuleType } from '@prisma/client';
import { calculateCommission, ensureWallet } from './referral';

export async function trackReferralEvent(data: {
  eventType: ReferralEventType;
  ashaProfileId?: string;
  referralPartnerId?: string;
  organizationId?: string;
  campaignId?: string;
  patientId?: string;
  appointmentId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.referralTrackingEvent.create({ data: { ...data, metadata: data.metadata as object } });

  if (data.campaignId) {
    const updates: Record<string, { increment: number }> = {};
    if (data.eventType === 'LINK_CLICK' || data.eventType === 'LANDING_VISIT') updates.clicks = { increment: 1 };
    if (data.eventType === 'QR_SCAN') updates.qrScans = { increment: 1 };
    if (data.eventType === 'FORM_STARTED') updates.formsStarted = { increment: 1 };
    if (data.eventType === 'FORM_SUBMITTED') updates.formsSubmitted = { increment: 1 };
    if (data.eventType === 'PATIENT_REGISTERED') updates.registrations = { increment: 1 };
    if (data.eventType === 'APPOINTMENT_BOOKED') updates.appointments = { increment: 1 };
    if (data.eventType === 'TREATMENT_COMPLETED') updates.treatments = { increment: 1 };
    if (Object.keys(updates).length) {
      await prisma.referralCampaign.update({ where: { id: data.campaignId }, data: updates });
    }
  }
}

export async function applyPatientReferralAttribution(data: {
  patientId: string;
  organizationId: string;
  ashaProfileId?: string;
  referralPartnerId?: string;
  campaignId?: string;
  sourceType: 'ASHA' | 'REFERRAL_PARTNER' | 'CAMPAIGN';
}) {
  const settings = await prisma.organizationReferralSettings.findUnique({
    where: { organizationId: data.organizationId },
  });

  let ashaName: string | undefined;
  let partnerName: string | undefined;
  let displayId: string | undefined;

  if (data.ashaProfileId) {
    const asha = await prisma.ashaProfile.findUnique({ where: { id: data.ashaProfileId } });
    ashaName = asha?.ashaName;
    displayId = asha?.ashaId;
  }
  if (data.referralPartnerId) {
    const partner = await prisma.referralPartner.findUnique({ where: { id: data.referralPartnerId } });
    partnerName = partner?.referralPartnerName;
    displayId = partner?.referralId;
  }

  const attribution = await prisma.patientReferralAttribution.upsert({
    where: { patientId_organizationId: { patientId: data.patientId, organizationId: data.organizationId } },
    create: {
      patientId: data.patientId,
      organizationId: data.organizationId,
      sourceType: data.sourceType,
      ashaProfileId: data.ashaProfileId,
      referralPartnerId: data.referralPartnerId,
      campaignId: data.campaignId,
      referralDisplayName: ashaName || partnerName,
      referralDisplayId: displayId,
      attributionPolicy: settings?.attributionPolicy || 'REGISTRATION_TIME',
      registrationTouchAt: new Date(),
      firstTouchAt: new Date(),
    },
    update: {
      sourceType: data.sourceType,
      ashaProfileId: data.ashaProfileId,
      referralPartnerId: data.referralPartnerId,
      campaignId: data.campaignId,
      referralDisplayName: ashaName || partnerName,
      referralDisplayId: displayId,
      registrationTouchAt: new Date(),
    },
  });

  await prisma.patientOrganization.updateMany({
    where: { patientId: data.patientId, organizationId: data.organizationId },
    data: { sourceType: data.sourceType },
  });

  if (data.ashaProfileId || data.referralPartnerId) {
    await prisma.referralHospitalConnection.updateMany({
      where: {
        organizationId: data.organizationId,
        ...(data.ashaProfileId ? { ashaProfileId: data.ashaProfileId } : { referralPartnerId: data.referralPartnerId }),
        status: 'ACTIVE',
      },
      data: { totalPatients: { increment: 1 } },
    });
  }

  await trackReferralEvent({
    eventType: 'PATIENT_REGISTERED',
    ashaProfileId: data.ashaProfileId,
    referralPartnerId: data.referralPartnerId,
    organizationId: data.organizationId,
    campaignId: data.campaignId,
    patientId: data.patientId,
  });

  return attribution;
}

export async function processTreatmentCommission(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      bills: { where: { status: { in: ['PAID', 'PARTIALLY_PAID'] } } },
    },
  });
  if (!appointment || appointment.status !== 'COMPLETED') return null;

  const attribution = await prisma.patientReferralAttribution.findUnique({
    where: {
      patientId_organizationId: {
        patientId: appointment.patientId,
        organizationId: appointment.organizationId,
      },
    },
  });
  if (!attribution || (!attribution.ashaProfileId && !attribution.referralPartnerId)) return null;

  const existing = await prisma.referralCommission.findFirst({
    where: { appointmentId, status: { not: 'REJECTED' } },
  });
  if (existing) return existing;

  const connection = await prisma.referralHospitalConnection.findFirst({
    where: {
      organizationId: appointment.organizationId,
      status: 'ACTIVE',
      ...(attribution.ashaProfileId
        ? { ashaProfileId: attribution.ashaProfileId }
        : { referralPartnerId: attribution.referralPartnerId! }),
    },
    include: { commissionPlan: true },
  });

  const rules = (connection?.commissionPlan?.rules || { treatmentCompleted: 500 }) as Record<string, number>;
  const ruleType = connection?.commissionPlan?.ruleType || CommissionRuleType.TREATMENT_BASED;
  const eligibleAmount = appointment.bills.reduce((s, b) => s + b.total, 0) || appointment.doctorId ? 500 : 0;
  const commissionAmount = calculateCommission(rules, ruleType, eligibleAmount, 'treatment');

  const settings = await prisma.organizationReferralSettings.findUnique({
    where: { organizationId: appointment.organizationId },
  });

  const commission = await prisma.referralCommission.create({
    data: {
      organizationId: appointment.organizationId,
      ashaProfileId: attribution.ashaProfileId,
      referralPartnerId: attribution.referralPartnerId,
      patientId: appointment.patientId,
      attributionId: attribution.id,
      appointmentId,
      eligibleAmount,
      commissionAmount,
      status: settings?.requireApproval ? CommissionStatus.UNDER_REVIEW : CommissionStatus.PENDING,
    },
  });

  await prisma.patientReferralAttribution.update({
    where: { id: attribution.id },
    data: { treatmentStatus: 'COMPLETED', commissionStatus: commission.status },
  });

  const wallet = await ensureWallet({
    ashaProfileId: attribution.ashaProfileId || undefined,
    referralPartnerId: attribution.referralPartnerId || undefined,
  });

  await prisma.referralWallet.update({
    where: { id: wallet.id },
    data: {
      pending: { increment: commissionAmount },
      totalEarned: { increment: commissionAmount },
    },
  });

  if (attribution.ashaProfileId || attribution.referralPartnerId) {
    await prisma.referralHospitalConnection.updateMany({
      where: {
        organizationId: appointment.organizationId,
        ...(attribution.ashaProfileId
          ? { ashaProfileId: attribution.ashaProfileId }
          : { referralPartnerId: attribution.referralPartnerId! }),
      },
      data: {
        totalTreatments: { increment: 1 },
        totalCommission: { increment: commissionAmount },
      },
    });
  }

  await trackReferralEvent({
    eventType: 'TREATMENT_COMPLETED',
    ashaProfileId: attribution.ashaProfileId || undefined,
    referralPartnerId: attribution.referralPartnerId || undefined,
    organizationId: appointment.organizationId,
    campaignId: attribution.campaignId || undefined,
    patientId: appointment.patientId,
    appointmentId,
  });

  return commission;
}

export async function detectReferralFraud(patientId: string, mobile?: string, email?: string): Promise<{ suspicious: boolean; reason?: string }> {
  if (mobile) {
    const dup = await prisma.patient.findFirst({
      where: { user: { phone: mobile }, NOT: { id: patientId } },
    });
    if (dup) return { suspicious: true, reason: 'Duplicate mobile - existing patient' };
  }
  if (email) {
    const dup = await prisma.patient.findFirst({
      where: { user: { email }, NOT: { id: patientId } },
    });
    if (dup) return { suspicious: true, reason: 'Duplicate email - existing patient' };
  }
  return { suspicious: false };
}
