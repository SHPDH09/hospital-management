import { prisma } from './prisma';
import { mergeWithDefaults, settingsKey } from './settings';
import { AppError } from './response';

export const ORG_BRANDING_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  logoLightUrl: true,
  logoDarkUrl: true,
  faviconUrl: true,
  coverImageUrl: true,
  brandColor: true,
  galleryUrls: true,
  brandingLocked: true,
  logoApproved: true,
  previousLogoUrl: true,
} as const;

export type OrgBrandingRecord = {
  id: string;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  faviconUrl?: string | null;
  coverImageUrl?: string | null;
  brandColor?: string | null;
  galleryUrls?: string[];
  brandingLocked?: boolean;
  logoApproved?: boolean;
  previousLogoUrl?: string | null;
};

export type BranchBrandingRecord = {
  id: string;
  name: string;
  logoUrl?: string | null;
} | null;

export interface HospitalBranding {
  organizationId: string;
  name: string;
  slug?: string;
  logoUrl: string | null;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  coverImageUrl: string | null;
  brandColor: string | null;
  branchId?: string | null;
  branchName?: string | null;
  branchLogoUrl?: string | null;
  displayLogoUrl: string | null;
}

export type LogoVariant = 'default' | 'light' | 'dark';

export function resolveDisplayLogo(
  org: Pick<OrgBrandingRecord, 'logoUrl' | 'logoLightUrl' | 'logoDarkUrl'>,
  branch?: Pick<NonNullable<BranchBrandingRecord>, 'logoUrl'> | null,
  variant: LogoVariant = 'default',
): string | null {
  if (branch?.logoUrl) return branch.logoUrl;
  if (variant === 'light' && org.logoLightUrl) return org.logoLightUrl;
  if (variant === 'dark' && org.logoDarkUrl) return org.logoDarkUrl;
  return org.logoUrl ?? org.logoLightUrl ?? org.logoDarkUrl ?? null;
}

export function formatHospitalBranding(
  org: OrgBrandingRecord,
  branch?: BranchBrandingRecord,
  variant: LogoVariant = 'default',
): HospitalBranding {
  return {
    organizationId: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logoUrl ?? null,
    logoLightUrl: org.logoLightUrl ?? null,
    logoDarkUrl: org.logoDarkUrl ?? null,
    faviconUrl: org.faviconUrl ?? null,
    coverImageUrl: org.coverImageUrl ?? null,
    brandColor: org.brandColor ?? null,
    branchId: branch?.id ?? null,
    branchName: branch?.name ?? null,
    branchLogoUrl: branch?.logoUrl ?? null,
    displayLogoUrl: resolveDisplayLogo(org, branch, variant),
  };
}

export async function getHospitalBranding(
  organizationId: string,
  branchId?: string | null,
  variant: LogoVariant = 'default',
): Promise<HospitalBranding | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: ORG_BRANDING_SELECT,
  });
  if (!org) return null;

  let branch: BranchBrandingRecord = null;
  if (branchId) {
    branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId },
      select: { id: true, name: true, logoUrl: true },
    });
  }

  return formatHospitalBranding(org, branch, variant);
}

export async function getBrandingRequirements() {
  const row = await prisma.platformSetting.findUnique({ where: { key: settingsKey('storage') } });
  const storage = mergeWithDefaults('storage', row?.value as Record<string, unknown> | null);
  const allowed = [...new Set([...(storage.allowedImageTypes as string[]), 'svg', 'png', 'webp'])];
  return {
    allowedFormats: allowed,
    maxFileSizeMb: storage.maxFileSizeMb as number,
    imageCompression: storage.imageCompression as boolean,
    recommendedFormats: ['PNG', 'SVG', 'WebP'],
    transparentBackgroundSupported: true,
    minWidth: 200,
    minHeight: 200,
  };
}

export async function validateImageUrl(url: string, field = 'Image'): Promise<void> {
  if (!url) return;
  const row = await prisma.platformSetting.findUnique({ where: { key: settingsKey('storage') } });
  const storage = mergeWithDefaults('storage', row?.value as Record<string, unknown> | null);
  const allowed = [...new Set([...(storage.allowedImageTypes as string[]), 'svg', 'png', 'webp'])];
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (!ext || !allowed.includes(ext)) {
    throw new AppError(`${field}: allowed formats are ${allowed.join(', ')}`, 400);
  }
}

export async function recordLogoHistory(
  organizationId: string,
  logoUrl: string,
  action: string,
  uploadedById?: string,
  uploadedByName?: string,
) {
  return prisma.organizationLogoHistory.create({
    data: { organizationId, logoUrl, action, uploadedById, uploadedByName },
  });
}

export function attachBrandingToOrganization<T extends OrgBrandingRecord>(
  org: T,
  branch?: BranchBrandingRecord,
  variant: LogoVariant = 'default',
): T & { branding: HospitalBranding } {
  return { ...org, branding: formatHospitalBranding(org, branch, variant) };
}

/** HTML snippet for email/invoice templates — logo fetched centrally by organizationId */
export function buildBrandingEmailHeader(branding: HospitalBranding): string {
  const logo = branding.displayLogoUrl
    ? `<img src="${branding.displayLogoUrl}" alt="${branding.name}" style="max-height:64px;margin-bottom:12px;" />`
    : '';
  return `${logo}<h2 style="margin:0;font-size:20px;">${branding.name}</h2>`;
}
