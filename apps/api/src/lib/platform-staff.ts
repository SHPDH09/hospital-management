export type ModulePermission = {
  view?: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
  approve?: boolean;
  export?: boolean;
};

export type StaffPermissions = Record<string, ModulePermission>;

export const PLATFORM_MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'hospitals', label: 'Hospitals' },
  { key: 'clinics', label: 'Clinics' },
  { key: 'doctors', label: 'Doctors' },
  { key: 'patients', label: 'Patients' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'medical_records', label: 'Medical Records' },
  { key: 'support', label: 'Support' },
  { key: 'communication', label: 'Communication' },
  { key: 'payments', label: 'Payments' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'advertisement', label: 'Advertisement' },
  { key: 'leads', label: 'Leads' },
  { key: 'cms', label: 'CMS' },
  { key: 'master_data', label: 'Master Data' },
  { key: 'locations', label: 'Locations' },
  { key: 'analytics', label: 'Analytics' },
] as const;

export const RESTRICTED_MODULES = ['global_settings', 'emergency', 'security', 'super_admin', 'platform_staff'];

export const DEFAULT_DEPARTMENTS = [
  'Operations', 'Hospital Onboarding', 'Doctor Verification', 'Customer Support',
  'Sales', 'Marketing', 'Advertisement', 'Finance', 'Subscription',
  'Technical Support', 'Content/CMS', 'Compliance',
];

export function emptyPermissions(): StaffPermissions {
  const perms: StaffPermissions = {};
  for (const m of PLATFORM_MODULES) {
    perms[m.key] = { view: false, create: false, edit: false, delete: false, approve: false, export: false };
  }
  return perms;
}

export function verificationStaffPermissions(): StaffPermissions {
  const p = emptyPermissions();
  p.dashboard = { view: true };
  p.hospitals = { view: true, approve: true };
  p.clinics = { view: true, approve: true };
  p.doctors = { view: true, approve: true };
  p.support = { view: true };
  return p;
}

export function financeStaffPermissions(): StaffPermissions {
  const p = emptyPermissions();
  p.dashboard = { view: true };
  p.payments = { view: true };
  p.subscriptions = { view: true };
  p.analytics = { view: true, export: true };
  return p;
}

export function supportStaffPermissions(): StaffPermissions {
  const p = emptyPermissions();
  p.dashboard = { view: true };
  p.patients = { view: true, edit: true };
  p.support = { view: true, create: true, edit: true };
  p.appointments = { view: true };
  p.payments = { view: true };
  return p;
}

export function marketingStaffPermissions(): StaffPermissions {
  const p = emptyPermissions();
  p.dashboard = { view: true };
  p.advertisement = { view: true, create: true, edit: true };
  p.leads = { view: true, export: true };
  p.cms = { view: true, edit: true };
  p.analytics = { view: true };
  return p;
}

export const DEFAULT_ROLE_TEMPLATES = [
  { name: 'Verification Staff', code: 'VERIFICATION', level: 3, description: 'Hospital/clinic/doctor verification', permissions: verificationStaffPermissions() },
  { name: 'Finance Staff', code: 'FINANCE', level: 3, description: 'Payments and subscriptions view', permissions: financeStaffPermissions() },
  { name: 'Support Staff', code: 'SUPPORT', level: 3, description: 'Customer support and tickets', permissions: supportStaffPermissions() },
  { name: 'Marketing Staff', code: 'MARKETING', level: 3, description: 'Ads and leads — no approve/delete', permissions: marketingStaffPermissions() },
  { name: 'Department Manager', code: 'MANAGER', level: 1, description: 'Department-level management', permissions: { ...emptyPermissions(), dashboard: { view: true }, hospitals: { view: true, edit: true, approve: true }, clinics: { view: true, edit: true, approve: true }, doctors: { view: true, approve: true }, support: { view: true, edit: true }, analytics: { view: true, export: true } } },
  { name: 'Team Lead', code: 'TEAM_LEAD', level: 2, description: 'Team supervision', permissions: { ...emptyPermissions(), dashboard: { view: true }, hospitals: { view: true, approve: true }, support: { view: true, edit: true }, appointments: { view: true } } },
];

export function mergePermissions(rolePerms?: StaffPermissions | null, customPerms?: StaffPermissions | null): StaffPermissions {
  const base = emptyPermissions();
  const merged = { ...base };
  for (const key of Object.keys(base)) {
    merged[key] = {
      ...base[key],
      ...(rolePerms?.[key] || {}),
      ...(customPerms?.[key] || {}),
    };
  }
  for (const restricted of RESTRICTED_MODULES) {
    merged[restricted] = { view: false, create: false, edit: false, delete: false, approve: false, export: false };
  }
  return merged;
}

export function hasPermission(perms: StaffPermissions, module: string, action: keyof ModulePermission): boolean {
  if (RESTRICTED_MODULES.includes(module)) return false;
  return Boolean(perms[module]?.[action]);
}
