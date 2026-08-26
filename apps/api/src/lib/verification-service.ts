import { ApplicationStatus, VerificationApplicationType, VerificationRiskLevel, Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { AppError } from './response';
import { mergeWithDefaults, settingsKey } from './settings';

export const DOCUMENT_TYPES = [
  'REGISTRATION_CERTIFICATE',
  'LICENSE',
  'GOVERNMENT_REGISTRATION',
  'ACCREDITATION',
  'TAX_DOCUMENT',
  'ADDRESS_PROOF',
  'AUTHORIZED_PERSON_ID',
  'MEDICAL_REGISTRATION',
  'QUALIFICATION',
  'ID_PROOF',
  'OTHER',
] as const;

export const DEFAULT_CHECKLIST = {
  organizationIdentity: false,
  registrationVerified: false,
  licenseVerified: false,
  addressVerified: false,
  authorizedPersonVerified: false,
  contactVerified: false,
  documentsValid: false,
  noDuplicate: false,
  informationComplete: false,
};

export type Checklist = typeof DEFAULT_CHECKLIST;

export async function getVerificationSettings() {
  const row = await prisma.platformSetting.findUnique({ where: { key: settingsKey('hospital-clinic') } });
  const hc = mergeWithDefaults('hospital-clinic', row?.value as Record<string, unknown> | null);
  return {
    normalSlaHours: Number(hc.verificationSlaHours ?? 48),
    highPrioritySlaHours: Number(hc.highPrioritySlaHours ?? 24),
    reVerificationSlaHours: Number(hc.reVerificationSlaHours ?? 24),
    autoAssignVerifier: Boolean(hc.autoAssignVerifier ?? false),
    requireManagerApproval: Boolean(hc.requireManagerApproval ?? false),
    highRiskThreshold: Number(hc.highRiskThreshold ?? 70),
  };
}

export function generateApplicationNumber(): string {
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `APP-${suffix}${rand}`;
}

export async function logVerificationAudit(
  applicationId: string,
  action: string,
  actorUserId?: string,
  actorName?: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
) {
  return prisma.verificationAuditLog.create({
    data: { applicationId, action, actorUserId, actorName, details: details as Prisma.InputJsonValue, ipAddress },
  });
}

async function notifyUser(userId: string, title: string, message: string, type: string, data?: Record<string, unknown>) {
  await prisma.notification.create({
    data: { userId, title, message, type, data: data as Prisma.InputJsonValue },
  }).catch(() => undefined);
}

export async function detectDuplicates(
  type: VerificationApplicationType,
  data: Record<string, unknown>,
  excludeOrgId?: string,
) {
  const flags: { field: string; message: string; matchId?: string }[] = [];
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim();
  const phone = String(data.phone || '').trim();
  const registrationNumber = String(data.registrationNumber || '').trim();
  const address = String(data.address || '').trim();

  if (type === 'HOSPITAL' || type === 'CLINIC') {
    const whereBase = excludeOrgId ? { id: { not: excludeOrgId } } : {};
    if (name) {
      const match = await prisma.organization.findFirst({
        where: { ...whereBase, name: { equals: name, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (match) flags.push({ field: 'name', message: `Possible duplicate: ${match.name}`, matchId: match.id });
    }
    if (registrationNumber) {
      const match = await prisma.organization.findFirst({
        where: { ...whereBase, registrationNumber },
        select: { id: true, name: true },
      });
      if (match) flags.push({ field: 'registrationNumber', message: `Registration number already exists: ${match.name}`, matchId: match.id });
    }
    if (email) {
      const match = await prisma.organization.findFirst({
        where: { ...whereBase, email: { equals: email, mode: 'insensitive' } },
        select: { id: true, name: true },
      });
      if (match) flags.push({ field: 'email', message: `Email already registered`, matchId: match.id });
    }
    if (phone) {
      const match = await prisma.organization.findFirst({
        where: { ...whereBase, phone },
        select: { id: true, name: true },
      });
      if (match) flags.push({ field: 'phone', message: `Mobile already registered`, matchId: match.id });
    }
    if (address && name) {
      const match = await prisma.organization.findFirst({
        where: {
          ...whereBase,
          address: { equals: address, mode: 'insensitive' },
          city: data.city ? { equals: String(data.city), mode: 'insensitive' } : undefined,
        },
        select: { id: true, name: true },
      });
      if (match) flags.push({ field: 'address', message: `Similar address found: ${match.name}`, matchId: match.id });
    }
  }

  return flags;
}

export function calculateRiskScore(
  profileData: Record<string, unknown>,
  duplicateFlags: { field: string }[],
  documentCount: number,
  requiredDocCount: number,
): { score: number; level: VerificationRiskLevel } {
  let score = 100;
  if (duplicateFlags.length) score -= duplicateFlags.length * 15;
  if (!profileData.email) score -= 10;
  if (!profileData.phone) score -= 10;
  if (!profileData.registrationNumber) score -= 5;
  if (documentCount < requiredDocCount) score -= 20;
  score = Math.max(0, Math.min(100, score));
  const level: VerificationRiskLevel = score >= 80 ? 'LOW' : score >= 50 ? 'MEDIUM' : 'HIGH';
  return { score, level };
}

function orgTypeToApplicationType(type: string): VerificationApplicationType {
  return type === 'CLINIC' ? 'CLINIC' : 'HOSPITAL';
}

export async function createOrganizationApplication(
  organizationId: string,
  submittedByUserId: string,
  profileData: Record<string, unknown>,
) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new AppError('Organization not found', 404);

  const existing = await prisma.verificationApplication.findUnique({ where: { organizationId } });
  if (existing) return existing;

  const type = orgTypeToApplicationType(org.type);
  const duplicates = await detectDuplicates(type, { ...profileData, name: org.name, email: org.email, phone: org.phone, registrationNumber: org.registrationNumber, address: org.address, city: org.city }, organizationId);
  const settings = await getVerificationSettings();
  const { score, level } = calculateRiskScore(profileData, duplicates, 0, 3);
  const slaHours = level === 'HIGH' ? settings.highPrioritySlaHours : settings.normalSlaHours;
  const slaDueAt = new Date();
  slaDueAt.setHours(slaDueAt.getHours() + slaHours);

  const app = await prisma.verificationApplication.create({
    data: {
      applicationNumber: generateApplicationNumber(),
      type,
      status: 'SUBMITTED',
      organizationId,
      submittedByUserId,
      submittedAt: new Date(),
      profileData: profileData as Prisma.InputJsonValue,
      checklist: DEFAULT_CHECKLIST as Prisma.InputJsonValue,
      duplicateFlags: duplicates as unknown as Prisma.InputJsonValue,
      riskScore: score,
      riskLevel: level,
      slaDueAt,
      accountActivated: false,
    },
  });

  await logVerificationAudit(app.id, 'APPLICATION_SUBMITTED', submittedByUserId, undefined, { type, riskScore: score });
  const staff = await prisma.staff.findFirst({ where: { organizationId }, select: { userId: true } });
  if (staff?.userId) {
    await notifyUser(staff.userId, 'Application Submitted', `Your verification application ${app.applicationNumber} has been submitted.`, 'VERIFICATION_SUBMITTED', { applicationId: app.id });
  }

  return app;
}

export async function addApplicationDocument(
  applicationId: string,
  data: { documentType: string; fileName: string; fileUrl: string; mimeType?: string; fileSize?: number; expiryDate?: Date },
  uploadedById?: string,
) {
  const app = await prisma.verificationApplication.findUnique({ where: { id: applicationId } });
  if (!app) throw new AppError('Application not found', 404);
  if (['APPROVED', 'SUSPENDED'].includes(app.status)) {
    throw new AppError('Cannot upload documents for this application status', 400);
  }

  const doc = await prisma.verificationDocument.create({
    data: {
      applicationId,
      documentType: data.documentType,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      expiryDate: data.expiryDate,
      uploadedById,
      status: 'PENDING',
    },
  });

  await logVerificationAudit(applicationId, 'DOCUMENT_UPLOADED', uploadedById, undefined, { documentType: data.documentType, documentId: doc.id });
  return doc;
}

export async function reuploadDocument(
  applicationId: string,
  documentId: string,
  data: { fileName: string; fileUrl: string; mimeType?: string; fileSize?: number },
  uploadedById?: string,
) {
  const old = await prisma.verificationDocument.findFirst({
    where: { id: documentId, applicationId },
  });
  if (!old) throw new AppError('Document not found', 404);
  if (!['REJECTED', 'REUPLOAD_REQUIRED'].includes(old.status)) {
    throw new AppError('Only rejected documents can be re-uploaded', 400);
  }

  const doc = await prisma.verificationDocument.create({
    data: {
      applicationId,
      documentType: old.documentType,
      fileName: data.fileName,
      fileUrl: data.fileUrl,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      expiryDate: old.expiryDate,
      version: old.version + 1,
      previousDocumentId: old.id,
      uploadedById,
      status: 'PENDING',
    },
  });

  await prisma.verificationApplication.update({
    where: { id: applicationId },
    data: { status: appStatusAfterReupload(await prisma.verificationApplication.findUnique({ where: { id: applicationId } })) },
  });

  await logVerificationAudit(applicationId, 'DOCUMENT_REUPLOADED', uploadedById, undefined, { documentId: doc.id, previousDocumentId: old.id });
  return doc;
}

function appStatusAfterReupload(app: { status: ApplicationStatus } | null): ApplicationStatus {
  if (!app) return 'UNDER_REVIEW';
  if (app.status === 'DOCUMENTS_REQUIRED' || app.status === 'REJECTED') return 'UNDER_REVIEW';
  return app.status;
}

export async function assignVerifier(applicationId: string, verifierId: string, actorUserId: string, actorName?: string) {
  const app = await prisma.verificationApplication.update({
    where: { id: applicationId },
    data: {
      assignedVerifierId: verifierId,
      assignedAt: new Date(),
      status: 'UNDER_REVIEW',
      reviewedAt: new Date(),
    },
  });
  await logVerificationAudit(applicationId, 'VERIFIER_ASSIGNED', actorUserId, actorName, { verifierId });
  return app;
}

export async function verifyDocument(documentId: string, verifierId: string, actorName?: string) {
  const doc = await prisma.verificationDocument.update({
    where: { id: documentId },
    data: { status: 'VERIFIED', verifiedById: verifierId, verifiedAt: new Date() },
    include: { application: true },
  });
  await logVerificationAudit(doc.applicationId, 'DOCUMENT_VERIFIED', verifierId, actorName, { documentType: doc.documentType, documentId });
  return doc;
}

export async function rejectDocument(documentId: string, reason: string, verifierId: string, actorName?: string) {
  if (!reason?.trim()) throw new AppError('Rejection reason is required', 400);
  const doc = await prisma.verificationDocument.update({
    where: { id: documentId },
    data: { status: 'REJECTED', rejectionReason: reason, verifiedById: verifierId, verifiedAt: new Date() },
    include: { application: { include: { organization: true, submittedBy: true } } },
  });

  await prisma.verificationApplication.update({
    where: { id: doc.applicationId },
    data: { status: 'DOCUMENTS_REQUIRED' },
  });

  await logVerificationAudit(doc.applicationId, 'DOCUMENT_REJECTED', verifierId, actorName, { documentType: doc.documentType, reason });

  const userId = doc.application.submittedByUserId
    || (doc.application.organizationId
      ? (await prisma.staff.findFirst({ where: { organizationId: doc.application.organizationId, role: 'HOSPITAL_ADMIN' }, select: { userId: true } }))?.userId
      : undefined);
  if (userId) {
    await notifyUser(userId, 'Document Rejected', reason, 'VERIFICATION_DOC_REJECTED', { applicationId: doc.applicationId, documentId });
  }

  return doc;
}

export async function approveApplication(
  applicationId: string,
  actorUserId: string,
  checklist: Checklist,
  actorName?: string,
  isSuperAdmin = false,
) {
  const app = await prisma.verificationApplication.findUnique({
    where: { id: applicationId },
    include: { documents: true, organization: true, doctor: true, ashaProfile: true, referralPartner: true },
  });
  if (!app) throw new AppError('Application not found', 404);

  const settings = await getVerificationSettings();
  if (app.riskLevel === 'HIGH' && !isSuperAdmin && settings.requireManagerApproval) {
    throw new AppError('High-risk application requires Super Admin approval', 403);
  }

  const rejectedDocs = app.documents.filter((d) => d.status === 'REJECTED' || d.status === 'REUPLOAD_REQUIRED');
  if (rejectedDocs.length) throw new AppError('All documents must be verified before approval', 400);

  const updated = await prisma.verificationApplication.update({
    where: { id: applicationId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      accountActivated: true,
      checklist: checklist as Prisma.InputJsonValue,
    },
  });

  if (app.organizationId) {
    await prisma.organization.update({
      where: { id: app.organizationId },
      data: { verificationStatus: 'APPROVED', accountActivated: true, isPubliclyListed: true },
    });
  }
  if (app.doctorId) {
    await prisma.doctor.update({
      where: { id: app.doctorId },
      data: { verificationStatus: 'APPROVED', accountActivated: true, isActive: true },
    });
  }
  if (app.ashaProfileId) {
    await prisma.ashaProfile.update({
      where: { id: app.ashaProfileId },
      data: { verificationStatus: 'APPROVED', status: 'ACTIVE' },
    });
  }
  if (app.referralPartnerId) {
    await prisma.referralPartner.update({
      where: { id: app.referralPartnerId },
      data: { verificationStatus: 'APPROVED', status: 'ACTIVE' },
    });
  }

  await logVerificationAudit(applicationId, 'APPLICATION_APPROVED', actorUserId, actorName, { checklist });

  const userId = app.submittedByUserId
    || (app.organizationId
      ? (await prisma.staff.findFirst({ where: { organizationId: app.organizationId, role: 'HOSPITAL_ADMIN' }, select: { userId: true } }))?.userId
      : undefined);
  if (userId) {
    await notifyUser(userId, 'Application Approved', 'Your account has been verified. Dashboard access is now enabled.', 'VERIFICATION_APPROVED', { applicationId });
  }

  return updated;
}

export async function rejectApplication(applicationId: string, reason: string, actorUserId: string, actorName?: string) {
  if (!reason?.trim()) throw new AppError('Rejection reason is required', 400);
  const app = await prisma.verificationApplication.findUnique({ where: { id: applicationId } });
  if (!app) throw new AppError('Application not found', 404);

  const updated = await prisma.verificationApplication.update({
    where: { id: applicationId },
    data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: reason, accountActivated: false },
  });

  if (app.organizationId) {
    await prisma.organization.update({
      where: { id: app.organizationId },
      data: { verificationStatus: 'REJECTED', accountActivated: false },
    });
  }

  await logVerificationAudit(applicationId, 'APPLICATION_REJECTED', actorUserId, actorName, { reason });

  if (app.submittedByUserId) {
    await notifyUser(app.submittedByUserId, 'Application Rejected', reason, 'VERIFICATION_REJECTED', { applicationId });
  }

  return updated;
}

export async function requestReVerification(organizationId: string, reason: string, actorUserId: string) {
  const existing = await prisma.verificationApplication.findUnique({ where: { organizationId } });
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) throw new AppError('Organization not found', 404);

  await prisma.organization.update({
    where: { id: organizationId },
    data: { verificationStatus: 'CORRECTION_REQUESTED', accountActivated: false },
  });

  if (existing) {
    await prisma.verificationApplication.update({
      where: { id: existing.id },
      data: { status: 'RE_VERIFICATION_REQUIRED', isReVerification: true, accountActivated: false },
    });
    await logVerificationAudit(existing.id, 'RE_VERIFICATION_REQUIRED', actorUserId, undefined, { reason });
    return existing;
  }

  return createOrganizationApplication(organizationId, actorUserId, { reason, reVerification: true });
}

export async function isAccountActivated(userId: string, role: string): Promise<boolean> {
  if (['SUPER_ADMIN', 'PLATFORM_STAFF', 'PATIENT'].includes(role)) return true;

  if (role === 'HOSPITAL_ADMIN' || role === 'BRANCH_ADMIN') {
    const staff = await prisma.staff.findUnique({ where: { userId }, include: { organization: true } });
    return staff?.organization?.accountActivated === true && staff.organization.verificationStatus === 'APPROVED';
  }

  if (role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId } });
    return doctor?.accountActivated === true && doctor.verificationStatus === 'APPROVED';
  }

  if (role === 'ASHA') {
    const asha = await prisma.ashaProfile.findUnique({ where: { userId } });
    return asha?.verificationStatus === 'APPROVED' && asha.status === 'ACTIVE';
  }

  if (role === 'REFERRAL_PARTNER') {
    const partner = await prisma.referralPartner.findUnique({ where: { userId } });
    return partner?.verificationStatus === 'APPROVED' && partner.status === 'ACTIVE';
  }

  // Staff roles inherit organization activation
  if (['RECEPTIONIST', 'NURSE', 'ACCOUNTANT', 'PHARMACIST', 'LAB_STAFF', 'MANAGER'].includes(role)) {
    const staff = await prisma.staff.findUnique({ where: { userId }, include: { organization: true } });
    return staff?.organization?.accountActivated === true;
  }

  return false;
}

export async function getApplicationForUser(userId: string, role: string) {
  if (role === 'HOSPITAL_ADMIN' || role === 'BRANCH_ADMIN') {
    const staff = await prisma.staff.findUnique({ where: { userId } });
    if (!staff) return null;
    return prisma.verificationApplication.findUnique({
      where: { organizationId: staff.organizationId },
      include: { documents: { orderBy: { createdAt: 'desc' } }, auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }
  if (role === 'DOCTOR') {
    const doctor = await prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) return null;
    return prisma.verificationApplication.findUnique({
      where: { doctorId: doctor.id },
      include: { documents: { orderBy: { createdAt: 'desc' } }, auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }
  if (role === 'ASHA') {
    const asha = await prisma.ashaProfile.findUnique({ where: { userId } });
    if (!asha) return null;
    return prisma.verificationApplication.findUnique({
      where: { ashaProfileId: asha.id },
      include: { documents: { orderBy: { createdAt: 'desc' } }, auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }
  if (role === 'REFERRAL_PARTNER') {
    const partner = await prisma.referralPartner.findUnique({ where: { userId } });
    if (!partner) return null;
    return prisma.verificationApplication.findUnique({
      where: { referralPartnerId: partner.id },
      include: { documents: { orderBy: { createdAt: 'desc' } }, auditLogs: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }
  return null;
}

export async function getVerificationDashboardStats() {
  const now = new Date();
  const [
    total,
    pending,
    underReview,
    documentsRequired,
    approved,
    rejected,
    reVerification,
    highRisk,
    slaBreached,
    byType,
  ] = await Promise.all([
    prisma.verificationApplication.count(),
    prisma.verificationApplication.count({ where: { status: { in: ['SUBMITTED', 'DRAFT'] } } }),
    prisma.verificationApplication.count({ where: { status: 'UNDER_REVIEW' } }),
    prisma.verificationApplication.count({ where: { status: 'DOCUMENTS_REQUIRED' } }),
    prisma.verificationApplication.count({ where: { status: 'APPROVED' } }),
    prisma.verificationApplication.count({ where: { status: 'REJECTED' } }),
    prisma.verificationApplication.count({ where: { status: 'RE_VERIFICATION_REQUIRED' } }),
    prisma.verificationApplication.count({ where: { riskLevel: 'HIGH', status: { notIn: ['APPROVED', 'REJECTED'] } } }),
    prisma.verificationApplication.count({ where: { slaBreached: true, status: { notIn: ['APPROVED', 'REJECTED'] } } }),
    prisma.verificationApplication.groupBy({ by: ['type'], _count: true }),
  ]);

  return {
    totalApplications: total,
    pending,
    underReview,
    documentsRequired,
    approved,
    rejected,
    reVerification,
    highRisk,
    slaBreached,
    byType: Object.fromEntries(byType.map((b) => [b.type, b._count])),
    asOf: now.toISOString(),
  };
}
