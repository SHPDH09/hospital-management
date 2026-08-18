interface HospitalLogoProps {
  organization?: {
    name?: string;
    logoUrl?: string | null;
    branding?: { logoUrl?: string | null };
  };
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showName?: boolean;
  className?: string;
}

const sizeMap = { xs: 'w-6 h-6', sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14' };

export function HospitalLogo({ organization, size = 'sm', showName, className = '' }: HospitalLogoProps) {
  const logoUrl = organization?.branding?.logoUrl || organization?.logoUrl;
  const name = organization?.name || 'Org';
  const sizeClass = sizeMap[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {logoUrl ? (
        <img src={logoUrl} alt="" className={`${sizeClass} rounded object-cover`} />
      ) : (
        <div className={`${sizeClass} rounded bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-xs`}>
          {name.charAt(0)}
        </div>
      )}
      {showName && <span className="font-medium">{name}</span>}
    </div>
  );
}
