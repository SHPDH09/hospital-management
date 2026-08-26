import { cn } from '@/lib/utils';

export interface HospitalBrandingLike {
  name?: string;
  logoUrl?: string | null;
  logoLightUrl?: string | null;
  logoDarkUrl?: string | null;
  displayLogoUrl?: string | null;
  brandColor?: string | null;
  branding?: {
    name?: string;
    displayLogoUrl?: string | null;
    logoUrl?: string | null;
    logoLightUrl?: string | null;
    logoDarkUrl?: string | null;
    brandColor?: string | null;
    branchName?: string | null;
  };
}

type Variant = 'default' | 'light' | 'dark';

function resolveLogo(org: HospitalBrandingLike, variant: Variant): string | null {
  const b = org.branding;
  if (variant === 'light') return b?.logoLightUrl ?? org.logoLightUrl ?? b?.displayLogoUrl ?? org.displayLogoUrl ?? b?.logoUrl ?? org.logoUrl ?? null;
  if (variant === 'dark') return b?.logoDarkUrl ?? org.logoDarkUrl ?? b?.displayLogoUrl ?? org.displayLogoUrl ?? b?.logoUrl ?? org.logoUrl ?? null;
  return b?.displayLogoUrl ?? org.displayLogoUrl ?? b?.logoUrl ?? org.logoUrl ?? null;
}

function resolveName(org: HospitalBrandingLike): string {
  return org.branding?.name ?? org.name ?? 'Hospital';
}

interface HospitalLogoProps {
  organization: HospitalBrandingLike;
  variant?: Variant;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showName?: boolean;
  nameClassName?: string;
  darkBackground?: boolean;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
};

export function HospitalLogo({
  organization,
  variant = 'default',
  size = 'md',
  className,
  showName = false,
  nameClassName,
  darkBackground = false,
}: HospitalLogoProps) {
  const logo = resolveLogo(organization, darkBackground ? 'dark' : variant);
  const name = resolveName(organization);
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const brandColor = organization.branding?.brandColor ?? organization.brandColor;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {logo ? (
        <img
          src={logo}
          alt={`${name} logo`}
          className={cn('object-contain shrink-0', sizeClasses[size], size === 'xl' ? 'max-w-[96px]' : 'rounded-lg')}
        />
      ) : (
        <div
          className={cn(
            'rounded-lg flex items-center justify-center font-bold shrink-0 bg-primary-100 text-primary-700',
            sizeClasses[size],
          )}
          style={brandColor ? { backgroundColor: `${brandColor}20`, color: brandColor } : undefined}
        >
          {initials || 'H'}
        </div>
      )}
      {showName && <span className={cn('font-semibold text-gray-900', nameClassName)}>{name}</span>}
    </div>
  );
}

export function HospitalLogoFromBranding({
  branding,
  ...props
}: Omit<HospitalLogoProps, 'organization'> & { branding: NonNullable<HospitalBrandingLike['branding']> }) {
  return <HospitalLogo organization={{ branding }} {...props} />;
}
