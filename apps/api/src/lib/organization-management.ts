import { OrganizationType, Prisma, VerificationApplicationType } from '@prisma/client';
import { prisma } from './prisma';
import { attachBrandingToOrganization, ORG_BRANDING_SELECT } from './hospital-branding';

export type ManagedOrgType = 'HOSPITAL' | 'CLINIC';

const APP_TYPE_MAP: Record<ManagedOrgType, VerificationApplicationType> = {
  HOSPITAL: 'HOSPITAL',
  CLINIC: 'CLINIC',
};

export interface OrgListFilters {
  search?: string;
  state?: string;
  city?: string;
  pinCode?: string;
  verificationStatus?: string;
  subscriptionStatus?: string;
  isActive?: boolean;
  accountActivated?: boolean;
  page?: number;
  limit?: number;
}

export async function getOrganizationManagementDashboard(orgType: ManagedOrgType) {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const soon = new Date();
  soon.setDate(soon.getDate() + 90);
  const orgWhere = { type: orgType };
  const appType = APP_TYPE_MAP[orgType];

  const [
    totalOrganizations,
    pendingVerification,
    underReview,
    verifiedOrganizations,
    rejectedOrganizations,
    suspendedOrganizations,
    inactiveOrganizations,
    activeOrganizations,
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
    totalRevenue,
  ] = await Promise.all([
    prisma.organization.count({ where: orgWhere }),
    prisma.verificationApplication.count({ where: { type: appType, status: { in: ['SUBMITTED', 'DRAFT'] } } }),
    prisma.verificationApplication.count({ where: { type: appType, status: 'UNDER_REVIEW' } }),
    prisma.organization.count({ where: { ...orgWhere, verificationStatus: 'APPROVED', accountActivated: true } }),
    prisma.organization.count({ where: { ...orgWhere, verificationStatus: 'REJECTED' } }),
    prisma.organization.count({ where: { ...orgWhere, verificationStatus: 'SUSPENDED' } }),
    prisma.organization.count({ where: { ...orgWhere, isActive: false } }),
    prisma.organization.count({ where: { ...orgWhere, verificationStatus: 'APPROVED', accountActivated: true, isActive: true } }),
    prisma.verificationApplication.count({ where: { type: appType, status: 'RE_VERIFICATION_REQUIRED' } }),
    prisma.organization.count({ where: { ...orgWhere, createdAt: { gte: monthStart } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE', organization: orgWhere } }),
    prisma.subscription.count({ where: { status: 'EXPIRED', organization: orgWhere } }),
    prisma.branch.count({ where: { organization: orgWhere } }),
    prisma.doctor.count({ where: { organization: orgWhere, isActive: true } }),
    prisma.staff.count({ where: { organization: orgWhere, isActive: true } }),
    prisma.patientOrganization.count({ where: { organization: orgWhere } }),
    prisma.appointment.count({ where: { organization: orgWhere } }),
    prisma.patientReferralAttribution.count({ where: { organization: orgWhere } }),
    prisma.advertisement.count({ where: { organization: orgWhere } }),
    prisma.verificationDocument.count({
      where: {
        expiryDate: { lte: soon, gte: new Date() },
        application: { organization: orgWhere },
      },
    }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', bill: { organization: orgWhere } },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalOrganizations,
    pendingVerification,
    underReview,
    verifiedOrganizations,
    rejectedOrganizations,
    suspendedOrganizations,
    inactiveOrganizations,
    activeOrganizations,
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
    totalRevenue: totalRevenue._sum.amount || 0,
  };
}

export async function listOrganizations(orgType: ManagedOrgType, filters: OrgListFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.OrganizationWhereInput = {
    type: orgType,
    ...(filters.verificationStatus && { verificationStatus: filters.verificationStatus as never }),
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    ...(filters.accountActivated !== undefined && { accountActivated: filters.accountActivated }),
    ...(filters.state && { state: { contains: filters.state, mode: 'insensitive' } }),
    ...(filters.city && { city: { contains: filters.city, mode: 'insensitive' } }),
    ...(filters.pinCode && { pinCode: { contains: filters.pinCode } }),
    ...(filters.search && {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { city: { contains: filters.search, mode: 'insensitive' } },
        { registrationNumber: { contains: filters.search, mode: 'insensitive' } },
        { id: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [organizations, total] = await Promise.all([
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
        pinCode: true,
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
        verificationApplication: { select: { id: true, applicationNumber: true, status: true, riskLevel: true, approvedAt: true } },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  const rows = organizations.map(({ subscriptions, verificationApplication, ...h }) => ({
    ...attachBrandingToOrganization(h),
    subscription: subscriptions[0] || null,
    verification: verificationApplication,
  }));

  return { organizations: rows, page, limit, total };
}

export async function getOrganizationOverview(organizationId: string, orgType: ManagedOrgType) {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, type: orgType },
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
          healthPackages: true,
          services: true,
        },
      },
    },
  });
  if (!org) return null;

  const label = orgType === 'CLINIC' ? 'Clinic' : 'Hospital';

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
    getComplianceAlerts(organizationId, label),
  ]);

  const ashaCount = await prisma.referralHospitalConnection.count({
    where: { organizationId, ashaProfileId: { not: null }, status: 'ACTIVE' },
  });
  const partnerCount = await prisma.referralHospitalConnection.count({
    where: { organizationId, referralPartnerId: { not: null }, status: 'ACTIVE' },
  });
  const referralCommissions = await prisma.referralCommission.aggregate({
    where: { organizationId },
    _sum: { commissionAmount: true },
    _count: true,
  });

  return {
    organization: attachBrandingToOrganization(org),
    stats: {
      ...org._count,
      revenue: revenueAgg._sum.amount || 0,
      appointmentByStatus: Object.fromEntries(appointmentStats.map((a) => [a.status, a._count])),
      referralConnections: { asha: ashaCount, partners: partnerCount },
      referralCommissionTotal: referralCommissions._sum.commissionAmount || 0,
      referralCommissionCount: referralCommissions._count,
    },
    referral: referralStats,
    recentAudit,
    compliance: complianceAlerts,
  };
}

async function getComplianceAlerts(organizationId: string, orgLabel: string) {
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
    alerts.push({ level: 'red', message: `${orgLabel} is suspended` });
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

export async function suspendOrganization(
  organizationId: string,
  orgType: ManagedOrgType,
  options: SuspensionOptions,
  actorUserId: string,
) {
  const full = options.fullSuspension ?? true;
  const existing = await prisma.organization.findFirst({ where: { id: organizationId, type: orgType } });
  if (!existing) throw new Error(`${orgType === 'CLINIC' ? 'Clinic' : 'Hospital'} not found`);

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
      action: orgType === 'CLINIC' ? 'CLINIC_SUSPENDED' : 'HOSPITAL_SUSPENDED',
      entityType: 'Organization',
      entityId: organizationId,
      details: options as unknown as Prisma.InputJsonValue,
    },
  });

  return org;
}

export async function activateOrganization(organizationId: string, orgType: ManagedOrgType, actorUserId: string) {
  const existing = await prisma.organization.findFirst({ where: { id: organizationId, type: orgType } });
  if (!existing) throw new Error(`${orgType === 'CLINIC' ? 'Clinic' : 'Hospital'} not found`);

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
      action: orgType === 'CLINIC' ? 'CLINIC_ACTIVATED' : 'HOSPITAL_ACTIVATED',
      entityType: 'Organization',
      entityId: organizationId,
    },
  });

  return org;
}

export function organizationsToCsv(organizations: Record<string, unknown>[], orgLabel: string): string {
  const headers = ['ID', 'Name', 'City', 'State', 'PIN', 'Verification', 'Active', 'Doctors', 'Patients', 'Branches', 'Registered'];
  const rows = organizations.map((h) => {
    const count = h._count as { doctors?: number; patientOrgs?: number; branches?: number } | undefined;
    return [
      h.id,
      h.name,
      h.city,
      h.state,
      h.pinCode,
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

// Backward-compatible hospital aliases
export type HospitalListFilters = OrgListFilters;
export const getHospitalManagementDashboard = () => getOrganizationManagementDashboard('HOSPITAL').then(mapHospitalDashboard);
export const listHospitals = (f: OrgListFilters) => listOrganizations('HOSPITAL', f).then((r) => ({ hospitals: r.organizations, ...r }));
export const getHospitalOverview = (id: string) => getOrganizationOverview(id, 'HOSPITAL').then((r) => r && ({ ...r, hospital: r.organization }));
export const suspendHospital = (id: string, o: SuspensionOptions, u: string) => suspendOrganization(id, 'HOSPITAL', o, u);
export const activateHospital = (id: string, u: string) => activateOrganization(id, 'HOSPITAL', u);
export const hospitalsToCsv = (rows: Record<string, unknown>[]) => organizationsToCsv(rows, 'Hospital');

function mapHospitalDashboard(d: Awaited<ReturnType<typeof getOrganizationManagementDashboard>>) {
  return {
    totalHospitals: d.totalOrganizations,
    pendingVerification: d.pendingVerification,
    underReview: d.underReview,
    verifiedHospitals: d.verifiedOrganizations,
    rejectedHospitals: d.rejectedOrganizations,
    suspendedHospitals: d.suspendedOrganizations,
    inactiveHospitals: d.inactiveOrganizations,
    reVerificationRequired: d.reVerificationRequired,
    expiringDocuments: d.expiringDocuments,
    newThisMonth: d.newThisMonth,
    activeSubscriptions: d.activeSubscriptions,
    expiredSubscriptions: d.expiredSubscriptions,
    totalBranches: d.totalBranches,
    totalDoctors: d.totalDoctors,
    totalStaff: d.totalStaff,
    totalPatients: d.totalPatients,
    totalAppointments: d.totalAppointments,
    referralPatients: d.referralPatients,
    adCampaigns: d.adCampaigns,
    totalRevenue: d.totalRevenue,
  };
}

// Clinic aliases
export const getClinicManagementDashboard = () => getOrganizationManagementDashboard('CLINIC').then(mapClinicDashboard);
export const listClinics = (f: OrgListFilters) => listOrganizations('CLINIC', f).then((r) => ({ clinics: r.organizations, ...r }));
export const getClinicOverview = (id: string) => getOrganizationOverview(id, 'CLINIC').then((r) => r && ({ ...r, clinic: r.organization }));
export const suspendClinic = (id: string, o: SuspensionOptions, u: string) => suspendOrganization(id, 'CLINIC', o, u);
export const activateClinic = (id: string, u: string) => activateOrganization(id, 'CLINIC', u);
export const clinicsToCsv = (rows: Record<string, unknown>[]) => organizationsToCsv(rows, 'Clinic');

function mapClinicDashboard(d: Awaited<ReturnType<typeof getOrganizationManagementDashboard>>) {
  return {
    totalClinics: d.totalOrganizations,
    newClinics: d.newThisMonth,
    pendingVerification: d.pendingVerification,
    underReview: d.underReview,
    verifiedClinics: d.verifiedOrganizations,
    activeClinics: d.activeOrganizations,
    rejectedClinics: d.rejectedOrganizations,
    suspendedClinics: d.suspendedOrganizations,
    inactiveClinics: d.inactiveOrganizations,
    reVerificationRequired: d.reVerificationRequired,
    expiringDocuments: d.expiringDocuments,
    activeSubscriptions: d.activeSubscriptions,
    expiredSubscriptions: d.expiredSubscriptions,
    totalDoctors: d.totalDoctors,
    totalStaff: d.totalStaff,
    totalPatients: d.totalPatients,
    totalAppointments: d.totalAppointments,
    referralPatients: d.referralPatients,
    activeAdvertisements: d.adCampaigns,
    totalRevenue: d.totalRevenue,
    totalBranches: d.totalBranches,
  };
}
