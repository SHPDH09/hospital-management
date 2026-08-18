import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

const subNav = [
  { to: '/admin/permissions', label: 'Dashboard', end: true },
  { to: '/admin/permissions/hierarchy', label: 'Role Hierarchy' },
  { to: '/admin/permissions/roles', label: 'All Roles' },
  { to: '/admin/permissions/create', label: 'Create Role' },
  { to: '/admin/permissions/templates', label: 'Templates' },
  { to: '/admin/permissions/matrix', label: 'Permission Matrix' },
  { to: '/admin/permissions/modules', label: 'Module Permissions' },
  { to: '/admin/permissions/scope', label: 'Organization Scope' },
  { to: '/admin/permissions/fields', label: 'Field-Level' },
  { to: '/admin/permissions/temporary', label: 'Temporary Access' },
  { to: '/admin/permissions/requests', label: 'Access Requests' },
  { to: '/admin/permissions/history', label: 'Permission History' },
  { to: '/admin/permissions/settings', label: 'Settings' },
];

const MATRIX_MODULES = ['hospitals', 'doctors', 'patients', 'payments', 'cms', 'global_settings'] as const;
const BASIC_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;
const ADVANCED_ACTIONS = ['approve', 'reject', 'suspend', 'activate', 'export', 'import', 'assign', 'refund', 'publish', 'manage'] as const;
const ALL_ACTIONS = [...BASIC_ACTIONS, ...ADVANCED_ACTIONS];

const SCOPE_OPTIONS = [
  { value: 'ALL_ORGANIZATIONS', label: 'All Organizations' },
  { value: 'ASSIGNED_ORGANIZATIONS', label: 'Assigned Organizations' },
  { value: 'OWN_DEPARTMENT', label: 'Own Department' },
  { value: 'OWN_RECORDS', label: 'Own Records' },
];

function PermLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Role ≠ Permission ≠ Scope — granular access control with backend enforcement"
      />
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
        <strong>Architecture:</strong> Role defines job function · Permission defines allowed actions · Scope defines which data can be accessed.
        Explicit Deny &gt; Allow.
      </div>
      <nav className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 pb-2">
        {subNav.map((item) => {
          const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <Link key={item.to} to={item.to}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50')}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </DashboardLayout>
  );
}

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['perm-dash'], queryFn: () => api.get('/admin/permissions/dashboard') });
  const d = data?.data as Record<string, unknown> | undefined;
  if (isLoading) return <PermLayout><LoadingState /></PermLayout>;

  return (
    <PermLayout>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Roles', value: d?.totalRoles },
          { label: 'Active Roles', value: d?.activeRoles },
          { label: 'System Roles', value: d?.systemRoles },
          { label: 'Custom Roles', value: d?.customRoles },
          { label: 'Pending Requests', value: d?.pendingRequests },
          { label: 'Temporary Access', value: d?.activeTempPermissions },
          { label: 'Staff with Roles', value: d?.staffWithRoles },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-primary-600 mt-1">{String(s.value ?? 0)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Platform Role Hierarchy</h3>
          <div className="text-sm space-y-1 text-gray-600 font-mono">
            <p>SUPER ADMIN</p>
            <p className="pl-4">├── PLATFORM ADMIN</p>
            <p className="pl-4">├── DEPARTMENT MANAGER</p>
            <p className="pl-8">│   Operations · Support · Finance · Marketing · Verification · Technical</p>
            <p className="pl-4">└── PLATFORM STAFF</p>
            <p className="pl-8">    Support · Sales · Verification · Finance · Marketing · Operations</p>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3 text-red-700">🔴 Highly Restricted Modules</h3>
          <div className="flex flex-wrap gap-2">
            {['Global Settings', 'Emergency Control', 'Security', 'Roles & Permissions', 'Medical Records', 'Financial Data', 'Audit Logs'].map((m) => (
              <span key={m} className="badge bg-red-50 text-red-700 text-xs">{m}</span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">Default OFF for all non-Super Admin roles</p>
        </div>
      </div>
    </PermLayout>
  );
}

function HierarchyPage() {
  const { data, isLoading } = useQuery({ queryKey: ['perm-hierarchy'], queryFn: () => api.get('/admin/permissions/hierarchy') });
  const hierarchy = (data?.data as { hierarchy?: { type: string; label: string; level: number; children?: string[] }[] })?.hierarchy || [];
  const roles = (data?.data as { roles?: Record<string, unknown>[] })?.roles || [];
  const orgRoles = (data?.data as { orgRoles?: { role: string; label: string; description: string }[] })?.orgRoles || [];

  if (isLoading) return <PermLayout><LoadingState /></PermLayout>;

  return (
    <PermLayout>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Platform Staff Hierarchy</h3>
          {hierarchy.map((h) => (
            <div key={h.type} className="mb-4">
              <div className="flex items-center gap-2">
                <span className="badge bg-primary-50 text-primary-700">L{h.level}</span>
                <span className="font-medium">{h.label}</span>
                <span className="text-xs text-gray-400">({h.type})</span>
              </div>
              {h.children && (
                <div className="ml-8 mt-2 flex flex-wrap gap-1">
                  {h.children.map((c) => <span key={c} className="badge bg-gray-100 text-gray-600 text-xs">{c}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Healthcare Organization Roles</h3>
          <p className="text-sm text-gray-500 mb-3">Separate from platform staff — managed per hospital/clinic</p>
          <div className="space-y-2">
            {orgRoles.map((r) => (
              <div key={r.role} className="flex justify-between items-center py-2 border-b border-gray-50">
                <div>
                  <p className="font-medium text-sm">{r.label}</p>
                  <p className="text-xs text-gray-500">{r.description}</p>
                </div>
                <span className="badge bg-blue-50 text-blue-700 text-xs">{r.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card p-6 mt-6">
        <h3 className="font-semibold mb-4">Configured Roles ({roles.length})</h3>
        <AdminTable columns={[
          { key: 'name', label: 'Role' },
          { key: 'roleType', label: 'Type' },
          { key: 'level', label: 'Level' },
          { key: 'staff', label: 'Staff', render: (r) => String((r._count as { staff?: number })?.staff || 0) },
          { key: 'isSystem', label: 'System', render: (r) => r.isSystem ? 'Yes' : 'Custom' },
        ]} rows={roles} />
      </div>
    </PermLayout>
  );
}

function AllRolesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['perm-roles'], queryFn: () => api.get('/admin/permissions/roles') });
  const roles = (data?.data as Record<string, unknown>[]) || [];

  const duplicate = async (id: string) => {
    await api.post(`/admin/permissions/roles/${id}/duplicate`);
    qc.invalidateQueries({ queryKey: ['perm-roles'] });
  };

  return (
    <PermLayout>
      <div className="flex justify-end mb-4">
        <Link to="/admin/permissions/create" className="btn-primary text-sm">+ Create Role</Link>
      </div>
      {isLoading ? <LoadingState /> : (
        <div className="space-y-3">
          {roles.map((r) => (
            <div key={String(r.id)} className="card p-5 flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{String(r.name)}
                  <span className="ml-2 text-xs badge bg-gray-100">{String(r.roleType)}</span>
                  {r.isSystem ? <span className="ml-1 text-xs badge bg-blue-50 text-blue-700">System</span> : null}
                </h3>
                <p className="text-sm text-gray-500">{String(r.description || '')}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Level {String(r.level)} · Scope: {String(r.organizationScope)} · {String((r._count as { staff?: number })?.staff || 0)} staff
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/admin/permissions/modules?role=${r.id}`} className="btn-secondary text-xs">Permissions</Link>
                <ActionBtn onClick={() => duplicate(String(r.id))}>Duplicate</ActionBtn>
              </div>
            </div>
          ))}
        </div>
      )}
    </PermLayout>
  );
}

function CreateRolePage() {
  const qc = useQueryClient();
  const { data: depts } = useQuery({ queryKey: ['staff-depts'], queryFn: () => api.get('/admin/platform-staff/departments') });
  const { data: roles } = useQuery({ queryKey: ['perm-roles'], queryFn: () => api.get('/admin/permissions/roles') });
  const { data: modules } = useQuery({ queryKey: ['perm-modules'], queryFn: () => api.get('/admin/permissions/modules') });

  const [form, setForm] = useState({
    name: '', code: '', description: '', roleType: 'PLATFORM_STAFF', level: 3,
    departmentId: '', organizationScope: 'ASSIGNED_ORGANIZATIONS', parentRoleId: '',
  });
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>({});

  const modList = (modules?.data as { modules?: { key: string; label: string; sensitive?: boolean }[] })?.modules || [];
  const deptList = (depts?.data as { id: string; name: string }[]) || [];
  const roleList = (roles?.data as { id: string; name: string }[]) || [];

  const create = async () => {
    await api.post('/admin/permissions/roles', { ...form, permissions: perms });
    qc.invalidateQueries({ queryKey: ['perm-roles'] });
    setForm({ name: '', code: '', description: '', roleType: 'PLATFORM_STAFF', level: 3, departmentId: '', organizationScope: 'ASSIGNED_ORGANIZATIONS', parentRoleId: '' });
    setPerms({});
  };

  return (
    <PermLayout>
      <div className="card p-6 max-w-4xl">
        <h3 className="font-semibold mb-4">Create Custom Role</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <input className="input" placeholder="Role Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Code (e.g. HOSPITAL_VERIFICATION_OFFICER)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <textarea className="input md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input" value={form.roleType} onChange={(e) => setForm({ ...form, roleType: e.target.value })}>
            <option value="PLATFORM_ADMIN">Platform Admin</option>
            <option value="DEPARTMENT_MANAGER">Department Manager</option>
            <option value="PLATFORM_STAFF">Platform Staff</option>
          </select>
          <select className="input" value={form.organizationScope} onChange={(e) => setForm({ ...form, organizationScope: e.target.value })}>
            {SCOPE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
            <option value="">Department (optional)</option>
            {deptList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="input" value={form.parentRoleId} onChange={(e) => setForm({ ...form, parentRoleId: e.target.value })}>
            <option value="">Parent Role (optional)</option>
            {roleList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <h4 className="font-medium mb-2">Module Permissions</h4>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-4">Module</th>
              {ALL_ACTIONS.map((a) => <th key={a} className="py-2 px-1 capitalize text-xs">{a}</th>)}
            </tr></thead>
            <tbody>
              {modList.map((m) => (
                <tr key={m.key} className={cn('border-b border-gray-50', m.sensitive && 'bg-red-50/30')}>
                  <td className="py-2 pr-4 font-medium">{m.label}{m.sensitive && ' 🔴'}</td>
                  {ALL_ACTIONS.map((a) => (
                    <td key={a} className="py-2 px-1 text-center">
                      <input type="checkbox" checked={Boolean(perms[m.key]?.[a])}
                        onChange={(e) => setPerms((p) => ({ ...p, [m.key]: { ...p[m.key], [a]: e.target.checked } }))} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-primary" onClick={create} disabled={!form.name}>Create Role</button>
      </div>
    </PermLayout>
  );
}

function TemplatesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['perm-templates'], queryFn: () => api.get('/admin/permissions/templates') });
  const templates = (data?.data as Record<string, unknown>[]) || [];

  const apply = async (code: string) => {
    await api.post(`/admin/permissions/templates/${code}/apply`);
    qc.invalidateQueries({ queryKey: ['perm-roles'] });
  };

  return (
    <PermLayout>
      <p className="text-sm text-gray-500 mb-4">Quick setup with predefined templates. Duplicate and customize as needed.</p>
      {isLoading ? <LoadingState /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <div key={String(t.code)} className="card p-5">
              <h3 className="font-semibold">{String(t.name)}</h3>
              <p className="text-sm text-gray-500 mt-1">{String(t.description)}</p>
              <div className="flex gap-2 mt-3 text-xs">
                <span className="badge bg-gray-100">{String(t.roleType)}</span>
                <span className="badge bg-gray-100">L{String(t.level)}</span>
              </div>
              <button className="btn-secondary text-sm mt-4 w-full" onClick={() => apply(String(t.code))}>Apply Template</button>
            </div>
          ))}
        </div>
      )}
    </PermLayout>
  );
}

function MatrixPage() {
  const { data, isLoading } = useQuery({ queryKey: ['perm-matrix'], queryFn: () => api.get('/admin/permissions/matrix') });
  const matrix = (data?.data as { matrix?: { role: string; cells: Record<string, string> }[] })?.matrix || [];

  if (isLoading) return <PermLayout><LoadingState /></PermLayout>;

  return (
    <PermLayout>
      <div className="overflow-x-auto">
        <table className="w-full text-sm card">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-3 text-left font-semibold">Role</th>
              {MATRIX_MODULES.map((m) => <th key={m} className="p-3 text-center capitalize">{m.replace(/_/g, ' ')}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.role} className="border-b border-gray-50">
                <td className="p-3 font-medium">{row.role}</td>
                {MATRIX_MODULES.map((m) => (
                  <td key={m} className="p-3 text-center">
                    <span className={cn('badge text-xs',
                      row.cells[m] === 'Full' ? 'bg-green-50 text-green-700' :
                      row.cells[m] === 'None' ? 'bg-gray-100 text-gray-500' :
                      'bg-yellow-50 text-yellow-700')}>
                      {row.cells[m]}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PermLayout>
  );
}

function ModulesPage() {
  const qc = useQueryClient();
  const params = new URLSearchParams(window.location.search);
  const roleId = params.get('role');
  const { data: roles } = useQuery({ queryKey: ['perm-roles'], queryFn: () => api.get('/admin/permissions/roles') });
  const { data: modules } = useQuery({ queryKey: ['perm-modules'], queryFn: () => api.get('/admin/permissions/modules') });
  const [selectedId, setSelectedId] = useState(roleId || '');
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [denials, setDenials] = useState<Record<string, Record<string, boolean>>>({});

  const roleList = (roles?.data as Record<string, unknown>[]) || [];
  const modList = (modules?.data as { modules?: { key: string; label: string; sensitive?: boolean }[] })?.modules || [];

  const loadRole = (id: string) => {
    setSelectedId(id);
    const role = roleList.find((r) => r.id === id);
    if (role) {
      setPerms((role.permissions as Record<string, Record<string, boolean>>) || {});
      setDenials((role.deniedPermissions as Record<string, Record<string, boolean>>) || {});
    }
  };

  const save = async () => {
    await api.patch(`/admin/permissions/roles/${selectedId}`, { permissions: perms, deniedPermissions: denials });
    qc.invalidateQueries({ queryKey: ['perm-roles'] });
  };

  return (
    <PermLayout>
      <select className="input max-w-sm mb-4" value={selectedId} onChange={(e) => loadRole(e.target.value)}>
        <option value="">Select role to edit...</option>
        {roleList.map((r) => <option key={String(r.id)} value={String(r.id)}>{String(r.name)}</option>)}
      </select>

      {selectedId && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            ✅ = Allow · ❌ Deny (explicit deny overrides allow)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm card">
              <thead><tr className="bg-gray-50 border-b">
                <th className="p-2 text-left">Module</th>
                {ALL_ACTIONS.map((a) => <th key={a} className="p-2 text-center capitalize text-xs">{a}</th>)}
                <th className="p-2 text-center text-xs text-red-600">Deny</th>
              </tr></thead>
              <tbody>
                {modList.map((m) => (
                  <tr key={m.key} className={cn('border-b', m.sensitive && 'bg-red-50/20')}>
                    <td className="p-2 font-medium">{m.label}</td>
                    {ALL_ACTIONS.map((a) => (
                      <td key={a} className="p-2 text-center">
                        <input type="checkbox" checked={Boolean(perms[m.key]?.[a])}
                          onChange={(e) => setPerms((p) => ({ ...p, [m.key]: { ...p[m.key], [a]: e.target.checked } }))} />
                      </td>
                    ))}
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={Boolean(denials[m.key]?.view)}
                        title="Explicit deny all for module"
                        onChange={(e) => {
                          const val = e.target.checked;
                          const d: Record<string, boolean> = {};
                          ALL_ACTIONS.forEach((a) => { d[a] = val; });
                          setDenials((p) => ({ ...p, [m.key]: d }));
                        }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn-primary mt-4" onClick={save}>Save Permissions</button>
        </>
      )}
    </PermLayout>
  );
}

function ScopePage() {
  const { data: roles, isLoading } = useQuery({ queryKey: ['perm-roles'], queryFn: () => api.get('/admin/permissions/roles') });
  const roleList = (roles?.data as Record<string, unknown>[]) || [];

  return (
    <PermLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Organization Scope Types</h3>
          {SCOPE_OPTIONS.map((s) => (
            <div key={s.value} className="py-3 border-b border-gray-50">
              <p className="font-medium text-sm">{s.label}</p>
              <p className="text-xs text-gray-500 mt-1">
                {s.value === 'ALL_ORGANIZATIONS' && 'Staff can access all hospitals and clinics platform-wide'}
                {s.value === 'ASSIGNED_ORGANIZATIONS' && 'Staff only sees organizations explicitly assigned to them'}
                {s.value === 'OWN_DEPARTMENT' && 'Staff limited to data within their department'}
                {s.value === 'OWN_RECORDS' && 'Staff only sees records they created'}
              </p>
            </div>
          ))}
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Location-Based Access</h3>
          <p className="text-sm text-gray-500 mb-4">
            Staff can be scoped to specific states/cities. Example: Patna Operations Staff → only Patna hospitals/clinics.
          </p>
          <p className="text-sm">Configure location scope per staff in <Link to="/admin/staff/assignments" className="text-primary-600">Staff Assignments</Link>.</p>
        </div>
      </div>
      {!isLoading && (
        <div className="card p-6 mt-6">
          <h3 className="font-semibold mb-4">Role Scope Configuration</h3>
          <AdminTable columns={[
            { key: 'name', label: 'Role' },
            { key: 'organizationScope', label: 'Org Scope' },
            { key: 'roleType', label: 'Type' },
          ]} rows={roleList} />
        </div>
      )}
    </PermLayout>
  );
}

function FieldsPage() {
  const { data: modules } = useQuery({ queryKey: ['perm-modules'], queryFn: () => api.get('/admin/permissions/modules') });
  const fieldDefaults = (modules?.data as { fieldDefaults?: Record<string, Record<string, string>> })?.fieldDefaults || {};

  return (
    <PermLayout>
      <p className="text-sm text-gray-500 mb-4">
        Field-level permissions control sensitive data exposure. Staff without permission cannot view fields in UI or API.
      </p>
      <div className="card p-6">
        <h3 className="font-semibold mb-4">Patient Field Permissions (Default)</h3>
        <AdminTable columns={[
          { key: 'field', label: 'Field' },
          { key: 'access', label: 'Default Access' },
        ]} rows={Object.entries(fieldDefaults.patients || {}).map(([field, access]) => ({
          field: field.replace(/_/g, ' '),
          access,
        }))} />
        <p className="text-xs text-gray-500 mt-4">
          Access levels: view · edit · limited · none
        </p>
      </div>
    </PermLayout>
  );
}

function TemporaryPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['perm-temp'], queryFn: () => api.get('/admin/permissions/temporary') });
  const { data: staff } = useQuery({ queryKey: ['staff-list'], queryFn: () => api.get('/admin/platform-staff?limit=100') });
  const [form, setForm] = useState({ staffProfileId: '', module: 'payments', action: 'view', reason: '', expiresAt: '' });
  const rows = (data?.data as Record<string, unknown>[]) || [];
  const staffList = (staff?.data as { id: string; fullName: string }[]) || [];

  const grant = async () => {
    await api.post('/admin/permissions/temporary', form);
    setForm({ staffProfileId: '', module: 'payments', action: 'view', reason: '', expiresAt: '' });
    qc.invalidateQueries({ queryKey: ['perm-temp'] });
  };

  const revoke = async (id: string) => {
    await api.delete(`/admin/permissions/temporary/${id}`);
    qc.invalidateQueries({ queryKey: ['perm-temp'] });
  };

  return (
    <PermLayout>
      <div className="card p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        <select className="input" value={form.staffProfileId} onChange={(e) => setForm({ ...form, staffProfileId: e.target.value })}>
          <option value="">Select staff...</option>
          {staffList.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
        <input className="input" placeholder="Module (e.g. payments)" value={form.module} onChange={(e) => setForm({ ...form, module: e.target.value })} />
        <input className="input" placeholder="Action (e.g. export)" value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} />
        <input className="input" type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
        <input className="input md:col-span-2" placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button className="btn-primary text-sm" onClick={grant} disabled={!form.staffProfileId || !form.expiresAt}>Grant Temporary Access</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'staff', label: 'Staff', render: (r) => String((r.staffProfile as { fullName?: string })?.fullName || '') },
          { key: 'module', label: 'Module' },
          { key: 'action', label: 'Action' },
          { key: 'expiresAt', label: 'Expires', render: (r) => formatDate(String(r.expiresAt)) },
          { key: 'reason', label: 'Reason' },
          { key: 'actions', label: '', render: (r) => (
            <button className="text-red-600 text-xs" onClick={() => revoke(String(r.id))}>Revoke</button>
          )},
        ]} rows={rows} emptyMessage="No active temporary permissions" />
      )}
    </PermLayout>
  );
}

function RequestsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['perm-requests'], queryFn: () => api.get('/admin/permissions/requests') });
  const rows = (data?.data as Record<string, unknown>[]) || [];

  const review = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await api.patch(`/admin/permissions/requests/${id}`, { status });
    qc.invalidateQueries({ queryKey: ['perm-requests'] });
  };

  return (
    <PermLayout>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'staff', label: 'Staff', render: (r) => String((r.staffProfile as { fullName?: string })?.fullName || '') },
          { key: 'module', label: 'Module' },
          { key: 'action', label: 'Action' },
          { key: 'reason', label: 'Reason' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'createdAt', label: 'Requested', render: (r) => formatDate(String(r.createdAt)) },
          { key: 'actions', label: '', render: (r) => r.status === 'PENDING' ? (
            <div className="flex gap-1">
              <button className="text-green-600 text-xs" onClick={() => review(String(r.id), 'APPROVED')}>Approve</button>
              <button className="text-red-600 text-xs" onClick={() => review(String(r.id), 'REJECTED')}>Reject</button>
            </div>
          ) : null },
        ]} rows={rows} emptyMessage="No access requests" />
      )}
    </PermLayout>
  );
}

function HistoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ['perm-history'], queryFn: () => api.get('/admin/permissions/history') });
  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <PermLayout>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'staff', label: 'Staff', render: (r) => String((r.staffProfile as { fullName?: string })?.fullName || '') },
          { key: 'module', label: 'Module' },
          { key: 'action', label: 'Action' },
          { key: 'previousValue', label: 'Previous', render: (r) => String(r.previousValue || '-') },
          { key: 'newValue', label: 'New', render: (r) => String(r.newValue || '-') },
          { key: 'changedByEmail', label: 'Changed By', render: (r) => String(r.changedByEmail || '-') },
          { key: 'createdAt', label: 'Date', render: (r) => formatDate(String(r.createdAt)) },
        ]} rows={rows} emptyMessage="No permission changes recorded" />
      )}
    </PermLayout>
  );
}

function SettingsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['perm-settings'], queryFn: () => api.get('/admin/permissions/settings') });
  const s = data?.data as Record<string, unknown> | undefined;

  if (isLoading) return <PermLayout><LoadingState /></PermLayout>;

  return (
    <PermLayout>
      <div className="card p-6 max-w-xl space-y-4">
        <h3 className="font-semibold">Permission Security Settings</h3>
        {[
          { label: 'Delete permission default OFF', value: s?.defaultDeleteOff ? 'Enabled' : 'Disabled' },
          { label: 'Prefer Deactivate/Archive over Delete', value: s?.preferArchive ? 'Enabled' : 'Disabled' },
          { label: 'Explicit Deny > Allow', value: s?.explicitDenyWins ? 'Enabled' : 'Disabled' },
          { label: 'Session Timeout', value: `${s?.sessionTimeoutMinutes} minutes` },
          { label: 'Max Login Attempts', value: String(s?.maxLoginAttempts) },
          { label: '2FA Required for Sensitive Modules', value: s?.require2FAForSensitive ? 'Yes' : 'No' },
        ].map((item) => (
          <div key={item.label} className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-sm">{item.label}</span>
            <span className="text-sm font-medium text-primary-600">{item.value}</span>
          </div>
        ))}
        <div className="pt-2">
          <p className="text-xs text-gray-500 font-semibold mb-2">Sensitive Modules</p>
          <div className="flex flex-wrap gap-1">
            {((s?.sensitiveModules as string[]) || []).map((m) => (
              <span key={m} className="badge bg-red-50 text-red-700 text-xs">{m.replace(/_/g, ' ')}</span>
            ))}
          </div>
        </div>
      </div>
    </PermLayout>
  );
}

export function AdminPermissionsPage() {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="hierarchy" element={<HierarchyPage />} />
      <Route path="roles" element={<AllRolesPage />} />
      <Route path="create" element={<CreateRolePage />} />
      <Route path="templates" element={<TemplatesPage />} />
      <Route path="matrix" element={<MatrixPage />} />
      <Route path="modules" element={<ModulesPage />} />
      <Route path="scope" element={<ScopePage />} />
      <Route path="fields" element={<FieldLevelPage />} />
      <Route path="temporary" element={<TemporaryPage />} />
      <Route path="requests" element={<RequestsPage />} />
      <Route path="history" element={<HistoryPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/admin/permissions" replace />} />
    </Routes>
  );
}

// alias for typo safety
const FieldLevelPage = FieldsPage;
