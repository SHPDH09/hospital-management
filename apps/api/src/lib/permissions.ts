/**
 * Platform permission engine — Role ≠ Permission ≠ Scope
 * Role: what the staff member does
 * Permission: what actions they can perform
 * Scope: which data they can act on
 */

export type PermissionAction =
  | 'view' | 'create' | 'edit' | 'delete'
  | 'approve' | 'reject' | 'suspend' | 'activate'
  | 'export' | 'import' | 'assign' | 'refund' | 'publish' | 'manage';

export type ModulePermission = Partial<Record<PermissionAction, boolean>> & {
  /** Explicit deny overrides allow */
  _deny?: Partial<Record<PermissionAction, boolean>>;
};

export type StaffPermissions = Record<string, ModulePermission>;

export type OrganizationScopeType =
  | 'ALL_ORGANIZATIONS'
  | 'ASSIGNED_ORGANIZATIONS'
  | 'OWN_DEPARTMENT'
  | 'OWN_RECORDS';

export type LocationScope = {
  states?: string[];
  cities?: string[];
};

export type FieldPermission = 'view' | 'edit' | 'none' | 'limited';

export type FieldPermissions = Record<string, Record<string, FieldPermission>>;

export type PlatformRoleType =
  | 'SUPER_ADMIN'
  | 'PLATFORM_ADMIN'
  | 'DEPARTMENT_MANAGER'
  | 'PLATFORM_STAFF';

export const PERMISSION_ACTIONS: { key: PermissionAction; label: string; group: 'basic' | 'advanced' }[] = [
  { key: 'view', label: 'View', group: 'basic' },
  { key: 'create', label: 'Create', group: 'basic' },
  { key: 'edit', label: 'Edit', group: 'basic' },
  { key: 'delete', label: 'Delete', group: 'basic' },
  { key: 'approve', label: 'Approve', group: 'advanced' },
  { key: 'reject', label: 'Reject', group: 'advanced' },
  { key: 'suspend', label: 'Suspend', group: 'advanced' },
  { key: 'activate', label: 'Activate', group: 'advanced' },
  { key: 'export', label: 'Export', group: 'advanced' },
  { key: 'import', label: 'Import', group: 'advanced' },
  { key: 'assign', label: 'Assign', group: 'advanced' },
  { key: 'refund', label: 'Refund', group: 'advanced' },
  { key: 'publish', label: 'Publish', group: 'advanced' },
  { key: 'manage', label: 'Manage', group: 'advanced' },
];

export const PLATFORM_MODULES = [
  { key: 'dashboard', label: 'Dashboard', sensitive: false },
  { key: 'hospitals', label: 'Hospitals', sensitive: false },
  { key: 'clinics', label: 'Clinics', sensitive: false },
  { key: 'doctors', label: 'Doctors', sensitive: false },
  { key: 'patients', label: 'Patients', sensitive: false },
  { key: 'appointments', label: 'Appointments', sensitive: false },
  { key: 'medical_records', label: 'Medical Records', sensitive: true },
  { key: 'prescriptions', label: 'Prescriptions', sensitive: true },
  { key: 'lab_reports', label: 'Lab Reports', sensitive: true },
  { key: 'pharmacy', label: 'Pharmacy', sensitive: false },
  { key: 'payments', label: 'Payments', sensitive: true },
  { key: 'subscriptions', label: 'Subscriptions', sensitive: true },
  { key: 'advertisement', label: 'Advertisements', sensitive: false },
  { key: 'leads', label: 'Leads', sensitive: false },
  { key: 'reviews', label: 'Reviews', sensitive: false },
  { key: 'communication', label: 'Communication', sensitive: false },
  { key: 'support', label: 'Support', sensitive: false },
  { key: 'cms', label: 'CMS', sensitive: false },
  { key: 'analytics', label: 'Analytics', sensitive: false },
  { key: 'platform_staff', label: 'Platform Staff', sensitive: true },
  { key: 'roles_permissions', label: 'Roles & Permissions', sensitive: true },
  { key: 'global_settings', label: 'Global Settings', sensitive: true },
  { key: 'security', label: 'Security', sensitive: true },
  { key: 'audit_logs', label: 'Audit Logs', sensitive: true },
  { key: 'emergency', label: 'Emergency Control', sensitive: true },
] as const;

export const RESTRICTED_MODULES = [
  'global_settings', 'emergency', 'security', 'roles_permissions',
  'audit_logs', 'medical_records', 'payments', 'subscriptions',
];

export const ORG_ROLES = [
  { role: 'HOSPITAL_ADMIN', label: 'Organization Admin', description: 'Full hospital/clinic CRM access' },
  { role: 'BRANCH_ADMIN', label: 'Branch Manager', description: 'Branch-level management' },
  { role: 'DOCTOR', label: 'Doctor', description: 'Doctor portal & appointments' },
  { role: 'RECEPTIONIST', label: 'Receptionist', description: 'Front desk operations' },
  { role: 'NURSE', label: 'Nurse', description: 'Patient care support' },
  { role: 'ACCOUNTANT', label: 'Accountant', description: 'Billing & payments' },
  { role: 'PHARMACIST', label: 'Pharmacist', description: 'Pharmacy operations' },
  { role: 'LAB_STAFF', label: 'Lab Staff', description: 'Lab reports & diagnostics' },
  { role: 'MANAGER', label: 'Manager', description: 'Department management' },
] as const;

export const ROLE_HIERARCHY: {
  type: PlatformRoleType;
  label: string;
  level: number;
  children?: string[];
}[] = [
  { type: 'SUPER_ADMIN', label: 'Super Admin', level: 0 },
  { type: 'PLATFORM_ADMIN', label: 'Platform Admin', level: 1 },
  {
    type: 'DEPARTMENT_MANAGER', label: 'Department Manager', level: 2,
    children: ['Operations Manager', 'Support Manager', 'Finance Manager', 'Marketing Manager', 'Verification Manager', 'Technical Manager'],
  },
  {
    type: 'PLATFORM_STAFF', label: 'Platform Staff', level: 3,
    children: ['Support Staff', 'Sales Staff', 'Verification Staff', 'Finance Staff', 'Marketing Staff', 'Operations Staff'],
  },
];

export const DEFAULT_FIELD_PERMISSIONS: FieldPermissions = {
  patients: {
    name: 'view', phone: 'view', email: 'view',
    medical_record: 'none', aadhaar: 'none', identity_document: 'none',
    payment_details: 'limited',
  },
};

export function emptyPermissions(): StaffPermissions {
  const perms: StaffPermissions = {};
  for (const m of PLATFORM_MODULES) {
    perms[m.key] = {};
    for (const a of PERMISSION_ACTIONS) perms[m.key][a.key] = false;
  }
  return perms;
}

export function fullPermissions(): StaffPermissions {
  const perms = emptyPermissions();
  for (const m of PLATFORM_MODULES) {
    for (const a of PERMISSION_ACTIONS) perms[m.key][a.key] = true;
  }
  return perms;
}

function setModule(perms: StaffPermissions, mod: string, actions: Partial<Record<PermissionAction, boolean>>) {
  perms[mod] = { ...perms[mod], ...actions };
}

export function superAdminPermissions(): StaffPermissions {
  return fullPermissions();
}

export function platformAdminPermissions(): StaffPermissions {
  const p = emptyPermissions();
  const allowed = ['dashboard', 'hospitals', 'clinics', 'doctors', 'patients', 'appointments',
    'advertisement', 'support', 'analytics', 'cms', 'leads', 'reviews', 'communication', 'pharmacy'];
  for (const mod of allowed) {
    setModule(p, mod, { view: true, create: true, edit: true, approve: true, export: true, manage: true });
  }
  setModule(p, 'payments', { view: true, export: true });
  setModule(p, 'subscriptions', { view: true });
  return p;
}

export function verificationStaffPermissions(): StaffPermissions {
  const p = emptyPermissions();
  setModule(p, 'dashboard', { view: true });
  setModule(p, 'hospitals', { view: true, approve: true, reject: true });
  setModule(p, 'clinics', { view: true, approve: true, reject: true });
  setModule(p, 'doctors', { view: true, approve: true });
  setModule(p, 'support', { view: true });
  return p;
}

export function financeStaffPermissions(): StaffPermissions {
  const p = emptyPermissions();
  setModule(p, 'dashboard', { view: true });
  setModule(p, 'payments', { view: true, refund: true, export: true });
  setModule(p, 'subscriptions', { view: true });
  setModule(p, 'analytics', { view: true, export: true });
  return p;
}

export function supportStaffPermissions(): StaffPermissions {
  const p = emptyPermissions();
  setModule(p, 'dashboard', { view: true });
  setModule(p, 'patients', { view: true, edit: true });
  setModule(p, 'support', { view: true, create: true, edit: true, assign: true });
  setModule(p, 'appointments', { view: true });
  setModule(p, 'payments', { view: true });
  return p;
}

export function marketingStaffPermissions(): StaffPermissions {
  const p = emptyPermissions();
  setModule(p, 'dashboard', { view: true });
  setModule(p, 'advertisement', { view: true, create: true, edit: true, publish: true });
  setModule(p, 'leads', { view: true, export: true });
  setModule(p, 'cms', { view: true, edit: true, publish: true });
  setModule(p, 'analytics', { view: true });
  return p;
}

export function salesStaffPermissions(): StaffPermissions {
  const p = emptyPermissions();
  setModule(p, 'dashboard', { view: true });
  setModule(p, 'hospitals', { view: true, create: true });
  setModule(p, 'clinics', { view: true, create: true });
  setModule(p, 'leads', { view: true, create: true, edit: true, export: true });
  setModule(p, 'analytics', { view: true });
  return p;
}

export function operationsManagerPermissions(): StaffPermissions {
  const p = emptyPermissions();
  const mods = ['dashboard', 'hospitals', 'clinics', 'doctors', 'appointments', 'support', 'analytics'];
  for (const mod of mods) setModule(p, mod, { view: true, edit: true, approve: true, export: true });
  return p;
}

export function contentManagerPermissions(): StaffPermissions {
  const p = emptyPermissions();
  setModule(p, 'dashboard', { view: true });
  setModule(p, 'cms', { view: true, create: true, edit: true, publish: true, manage: true });
  setModule(p, 'advertisement', { view: true, edit: true });
  return p;
}

export const DEFAULT_ROLE_TEMPLATES = [
  { name: 'Super Admin', code: 'SUPER_ADMIN', roleType: 'SUPER_ADMIN' as PlatformRoleType, level: 0, description: 'Full platform control', permissions: superAdminPermissions(), organizationScope: 'ALL_ORGANIZATIONS' as OrganizationScopeType },
  { name: 'Platform Admin', code: 'PLATFORM_ADMIN', roleType: 'PLATFORM_ADMIN' as PlatformRoleType, level: 1, description: 'Powerful administrator under Super Admin', permissions: platformAdminPermissions(), organizationScope: 'ALL_ORGANIZATIONS' as OrganizationScopeType },
  { name: 'Operations Manager', code: 'OPS_MANAGER', roleType: 'DEPARTMENT_MANAGER' as PlatformRoleType, level: 2, description: 'Operations department management', permissions: operationsManagerPermissions(), organizationScope: 'ASSIGNED_ORGANIZATIONS' as OrganizationScopeType },
  { name: 'Support Manager', code: 'SUPPORT_MANAGER', roleType: 'DEPARTMENT_MANAGER' as PlatformRoleType, level: 2, description: 'Support team management', permissions: { ...supportStaffPermissions(), support: { view: true, create: true, edit: true, assign: true, manage: true } }, organizationScope: 'ASSIGNED_ORGANIZATIONS' as OrganizationScopeType },
  { name: 'Finance Manager', code: 'FINANCE_MANAGER', roleType: 'DEPARTMENT_MANAGER' as PlatformRoleType, level: 2, description: 'Finance department management', permissions: { ...financeStaffPermissions(), payments: { view: true, refund: true, export: true, manage: true }, subscriptions: { view: true, edit: true } }, organizationScope: 'ALL_ORGANIZATIONS' as OrganizationScopeType },
  { name: 'Verification Manager', code: 'VERIFICATION_MANAGER', roleType: 'DEPARTMENT_MANAGER' as PlatformRoleType, level: 2, description: 'Verification team management', permissions: { ...verificationStaffPermissions(), hospitals: { view: true, approve: true, reject: true, edit: true }, clinics: { view: true, approve: true, reject: true, edit: true } }, organizationScope: 'ASSIGNED_ORGANIZATIONS' as OrganizationScopeType },
  { name: 'Support Staff', code: 'SUPPORT', roleType: 'PLATFORM_STAFF' as PlatformRoleType, level: 3, description: 'Customer support and tickets', permissions: supportStaffPermissions(), organizationScope: 'ASSIGNED_ORGANIZATIONS' as OrganizationScopeType },
  { name: 'Verification Staff', code: 'VERIFICATION', roleType: 'PLATFORM_STAFF' as PlatformRoleType, level: 3, description: 'Hospital/clinic/doctor verification', permissions: verificationStaffPermissions(), organizationScope: 'ASSIGNED_ORGANIZATIONS' as OrganizationScopeType },
  { name: 'Finance Staff', code: 'FINANCE', roleType: 'PLATFORM_STAFF' as PlatformRoleType, level: 3, description: 'Payments and subscriptions', permissions: financeStaffPermissions(), organizationScope: 'ALL_ORGANIZATIONS' as OrganizationScopeType },
  { name: 'Marketing Staff', code: 'MARKETING', roleType: 'PLATFORM_STAFF' as PlatformRoleType, level: 3, description: 'Ads and leads management', permissions: marketingStaffPermissions(), organizationScope: 'ALL_ORGANIZATIONS' as OrganizationScopeType },
  { name: 'Sales Staff', code: 'SALES', roleType: 'PLATFORM_STAFF' as PlatformRoleType, level: 3, description: 'Sales and lead generation', permissions: salesStaffPermissions(), organizationScope: 'ASSIGNED_ORGANIZATIONS' as OrganizationScopeType },
  { name: 'Content Manager', code: 'CONTENT', roleType: 'PLATFORM_STAFF' as PlatformRoleType, level: 3, description: 'CMS and content management', permissions: contentManagerPermissions(), organizationScope: 'ALL_ORGANIZATIONS' as OrganizationScopeType },
];

/** Merge permissions: role + custom grants, then apply explicit denials (deny > allow) */
export function mergePermissions(
  rolePerms?: StaffPermissions | null,
  customPerms?: StaffPermissions | null,
  denials?: StaffPermissions | null,
  temporaryGrants?: StaffPermissions | null,
): StaffPermissions {
  const merged = emptyPermissions();

  for (const key of Object.keys(merged)) {
    const base = { ...merged[key] };
    const role = rolePerms?.[key] || {};
    const custom = customPerms?.[key] || {};
    const temp = temporaryGrants?.[key] || {};
    const deny = denials?.[key] || {};

    for (const a of PERMISSION_ACTIONS) {
      const allowed = Boolean(role[a.key] || custom[a.key] || temp[a.key]);
      const denied = Boolean(deny[a.key] || deny._deny?.[a.key] || role._deny?.[a.key] || custom._deny?.[a.key]);
      merged[key][a.key] = denied ? false : allowed;
    }
  }

  return merged;
}

export function hasPermission(
  perms: StaffPermissions,
  module: string,
  action: PermissionAction,
  userRole?: string,
): boolean {
  if (userRole === 'SUPER_ADMIN') return true;
  return Boolean(perms[module]?.[action]);
}

export function getMatrixSummary(perms: StaffPermissions, module: string): string {
  const p = perms[module];
  if (!p) return 'None';
  const actions = PERMISSION_ACTIONS.filter((a) => p[a.key]).map((a) => a.label);
  if (actions.length === PERMISSION_ACTIONS.length) return 'Full';
  if (actions.length === 0) return 'None';
  if (actions.length <= 2) return actions.join(', ');
  return 'Limited';
}

export function buildPermissionMatrix(roles: { name: string; permissions: StaffPermissions }[]) {
  const modules = ['hospitals', 'doctors', 'patients', 'payments', 'cms', 'global_settings'] as const;
  return roles.map((role) => ({
    role: role.name,
    cells: Object.fromEntries(modules.map((m) => [m, getMatrixSummary(role.permissions, m)])),
  }));
}
