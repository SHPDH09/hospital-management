import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { attachBrandingToOrganization, ORG_BRANDING_SELECT } from './hospital-branding';

export interface HospitalListFilters {
  search?: string;
  state?: string;
  city?: string;
  verificationStatus?: string;
  subscriptionStatus?: string;
  isActive?: boolean;
  accountActivated?: boolean;
  page?: number;
  limit?: number;
}

export async function getHospitalManagementDashboard() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const soon = new Date();
  soon.setDate(soon.getDate() + 90);

  const hospitalWhere = { type: 'HOSPITAL' as const };

  const [
    totalHospitals,
    pendingVerification,
    underReview,
    verifiedHospitals,
    rejectedHospitals,
    suspendedHospitals,
    inactiveHospitals,
    reVerificationRequired,
    newThisMonth,
    activeSubscriptions,
    expiredSubscriptions,
    totalBranches,
    totalDoctors,
    totalStaff,
    totalPatients,
    totalAppointments,
    referralPatients,
    adCampaigns,
    expiringDocuments,
  ] = await Promise.all([
    prisma.organization.count({ where: hospitalWhere }),
    prisma.verificationApplication.count({ where: { type: 'HOSPITAL', status: { in: ['SUBMITTED', 'DRAFT'] } } }),
    prisma.verificationApplication.count({ where: { type: 'HOSPITAL', status: 'UNDER_REVIEW' } }),
    prisma.organization.count({ where: { ...hospitalWhere, verificationStatus: 'APPROVED', accountActivated: true } }),
    prisma.organization.count({ where: { ...hospitalWhere, verificationStatus: 'REJECTED' } }),
    prisma.organization.count({ where: { ...hospitalWhere, verificationStatus: 'SUSPENDED' } }),
    prisma.organization.count({ where: { ...hospitalWhere, isActive: false } }),
    prisma.verificationApplication.count({ where: { type: 'HOSPITAL', status: 'RE_VERIFICATION_REQUIRED' } }),
    prisma.organization.count({ where: { ...hospitalWhere, createdAt: { gte: monthStart } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', organization: hospitalWhere } }),
    prisma.subscription.count({ where: { status: 'EXPIRED', organization: hospitalWhere } }),
    prisma.branch.count({ where: { organization: hospitalWhere } }),
    prisma.doctor.count({ where: { organization: hospitalWhere, isActive: true } }),
    prisma.staff.count({ where: { organization: hospitalWhere, isActive: true } }),
    prisma.patientOrganization.count({ where: { organization: hospitalWhere } }),
    prisma.appointment.count({ where: { organization: hospitalWhere } }),
    prisma.patientReferralAttribution.count({ where: { organization: hospitalWhere } }),
    prisma.advertisement.count({ where: { organization: hospitalWhere } }),
    prisma.verificationDocument.count({
      where: {
        expiryDate: { lte: soon, gte: new Date() },
        application: { organization: hospitalWhere },
      },
    }),
  ]);

  return {
    totalHospitals,
    pendingVerification,
    underReview,
    verifiedHospitals,
    rejectedHospitals,
    suspendedHospitals,
    inactiveHospitals,
    reVerificationRequired,
    expiringDocuments,
    newThisMonth,
    activeSubscriptions,
    expiredSubscriptions,
    totalBranches,
    totalDoctors,
    totalStaff,
    totalPatients,
    totalAppointments,
    referralPatients,
    adCampaigns,
  };
}

export async function listHospitals(filters: HospitalListFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.OrganizationWhereInput = {
    type: 'HOSPITAL',
    ...(filters.verificationStatus && { verificationStatus: filters.verificationStatus as never }),
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    ...(filters.accountActivated !== undefined && { accountActivated: filters.accountActivated }),
    ...(filters.state && { state: { contains: filters.state, mode: 'insensitive' } }),
    ...(filters.city && { city: { contains: filters.city, mode: 'insensitive' } }),
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { registrationNumber: { contains: filters.search, mode: 'insensitive' } },
        { id: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [hospitals, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        ...ORG_BRANDING_SELECT,
        type: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        address: true,
        verificationStatus: true,
        accountActivated: true,
        isActive: true,
        isPubliclyListed: true,
        registrationNumber: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { doctors: true, staff: true, branches: true, patientOrgs: true, appointments: true } },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: { select: { name: true, code: true } } } },
        verificationApplication: { select: { id: true, applicationNumber: true, status: true, riskLevel: true } },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  const rows = hospitals.map(({ subscriptions, verificationApplication, ...h }) => ({
    ...attachBrandingToOrganization(h),
    subscription: subscriptions[0] || null,
    verification: verificationApplication,
  }));

  return { hospitals: rows, page, limit, total };
}

export async function getHospitalOverview(organizationId: string) {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, type: 'HOSPITAL' },
    include: {
      branches: { include: { _count: { select: { doctors: true, staff: true, departments: true } } } },
      departments: { where: { isActive: true } },
      subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      verificationApplication: {
        include: {
          documents: { orderBy: { createdAt: 'desc' } },
          assignedVerifier: { select: { id: true, email: true } },
        },
      },
      _count: {
        select: {
          doctors: true,
          staff: true,
          branches: true,
          departments: true,
          patientOrgs: true,
          appointments: true,
          bills: true,
          reviews: true,
          advertisements: true,
          leads: true,
        },
      },
    },
  });
  if (!org) return null;

  const [
    referralStats,
    appointmentStats,
    revenueAgg,
    recentAudit,
    complianceAlerts,
  ] = await Promise.all([
    prisma.referralHospitalConnection.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: true,
    }),
    prisma.appointment.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', bill: { organizationId } },
      _sum: { amount: true },
    }),
    prisma.organizationAuditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    getComplianceAlerts(organizationId),
  ]);

  const ashaCount = await prisma.referralHospitalConnection.count({
    where: { organizationId, ashaProfileId: { not: null }, status: 'ACTIVE' },
  });
  const partnerCount = await prisma.referralHospitalConnection.count({
    where: { organizationId, referralPartnerId: { not: null }, status: 'ACTIVE' },
  });
  const referralCommissions = await prisma.referralCommission.aggregate({
    where: { organizationId, status: 'PAID' },
    _sum: { commissionAmount: true },
  });

  return {
    hospital: attachBrandingToOrganization(org),
    stats: {
      ...org._count,
      revenue: revenueAgg._sum.amount || 0,
      appointmentByStatus: Object.fromEntries(appointmentStats.map((a) => [a.status, a._count])),
      referralConnections: { asha: ashaCount, partners: partnerCount },
      referralCommissionPaid: referralCommissions._sum.commissionAmount || 0,
    },
    referral: referralStats,
    recentAudit,
    compliance: complianceAlerts,
  };
}

async function getComplianceAlerts(organizationId: string) {
  const app = await prisma.verificationApplication.findUnique({
    where: { organizationId },
    include: { documents: true },
  });
  const now = new Date();
  const alerts: { level: string; message: string }[] = [];

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { verificationStatus: true, accountActivated: true, isActive: true },
  });

  if (org?.verificationStatus === 'SUSPENDED') {
    alerts.push({ level: 'red', message: 'Hospital is suspended' });
  }
  if (org && !org.accountActivated) {
    alerts.push({ level: 'orange', message: 'CRM not activated — pending verification' });
  }

  for (const doc of app?.documents || []) {
    if (!doc.expiryDate) continue;
    const days = Math.ceil((doc.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) alerts.push({ level: 'red', message: `${doc.documentType} expired` });
    else if (days <= 30) alerts.push({ level: 'yellow', message: `${doc.documentType} expiring in ${days} days` });
  }

  return alerts;
}

export interface SuspensionOptions {
  reason: string;
  suspendLogin?: boolean;
  hideFromSearch?: boolean;
  stopNewAppointments?: boolean;
  stopAdvertisements?: boolean;
  stopNewRegistrations?: boolean;
  suspendCrmAccess?: boolean;
  fullSuspension?: boolean;
}

export async function suspendHospital(organizationId: string, options: SuspensionOptions, actorUserId: string) {
  const full = options.fullSuspension ?? true;
  const existing = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!existing) throw new Error('Hospital not found');

  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      verificationStatus: 'SUSPENDED',
      isActive: false,
      accountActivated: full || options.suspendCrmAccess ? false : existing.accountActivated,
      isPubliclyListed: options.hideFromSearch || full ? false : existing.isPubliclyListed,
    },
  });

  if (options.stopAdvertisements || full) {
    await prisma.advertisement.updateMany({
      where: { organizationId, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    });
  }

  await prisma.organizationAuditLog.create({
    data: {
      organizationId,
      userId: actorUserId,
      action: 'HOSPITAL_SUSPENDED',
      entityType: 'Organization',
      entityId: organizationId,
      details: options as unknown as Prisma.InputJsonValue,
    },
  });

  return org;
}

export async function activateHospital(organizationId: string, actorUserId: string) {
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      verificationStatus: 'APPROVED',
      isActive: true,
      accountActivated: true,
      isPubliclyListed: true,
    },
  });

  await prisma.organizationAuditLog.create({
    data: {
      organizationId,
      userId: actorUserId,
      action: 'HOSPITAL_ACTIVATED',
      entityType: 'Organization',
      entityId: organizationId,
    },
  });

  return org;
}

export function hospitalsToCsv(hospitals: Record<string, unknown>[]): string {
  const headers = ['ID', 'Name', 'City', 'State', 'Verification', 'Active', 'Doctors', 'Patients', 'Branches', 'Registered'];
  const rows = hospitals.map((h) => {
    const count = h._count as { doctors?: number; patientOrgs?: number; branches?: number } | undefined;
    return [
      h.id,
      h.name,
      h.city,
      h.state,
      h.verificationStatus,
      h.isActive ? 'Yes' : 'No',
      count?.doctors ?? 0,
      count?.patientOrgs ?? 0,
      count?.branches ?? 0,
      h.createdAt ? new Date(String(h.createdAt)).toISOString().slice(0, 10) : '',
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}
