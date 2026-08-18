import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

const subNav = [
  { to: '/admin/staff', label: 'Dashboard', end: true },
  { to: '/admin/staff/all', label: 'All Staff' },
  { to: '/admin/staff/create', label: 'Create Staff' },
  { to: '/admin/staff/departments', label: 'Departments' },
  { to: '/admin/staff/roles', label: 'Roles & Permissions' },
  { to: '/admin/staff/tasks', label: 'Tasks' },
  { to: '/admin/staff/assignments', label: 'Assignments' },
  { to: '/admin/staff/activity', label: 'Activity' },
  { to: '/admin/staff/performance', label: 'Performance' },
  { to: '/admin/staff/attendance', label: 'Attendance' },
  { to: '/admin/staff/announcements', label: 'Announcements' },
  { to: '/admin/staff/security', label: 'Security & Sessions' },
];

const PERM_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'] as const;

function StaffLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Platform Staff Management" subtitle="Staff, departments, roles, permissions, tasks, and performance" />
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
  const { data, isLoading } = useQuery({ queryKey: ['staff-dash'], queryFn: () => api.get('/admin/platform-staff/dashboard') });
  const d = data?.data as Record<string, unknown> | undefined;
  if (isLoading) return <StaffLayout><LoadingState /></StaffLayout>;

  return (
    <StaffLayout>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Staff', value: d?.totalStaff },
          { label: 'Active Staff', value: d?.activeStaff },
          { label: 'Inactive Staff', value: d?.inactiveStaff },
          { label: 'Suspended Staff', value: d?.suspendedStaff },
          { label: 'Online Staff', value: d?.onlineStaff },
          { label: 'Departments', value: d?.departments },
          { label: 'Pending Tasks', value: d?.pendingTasks },
          { label: 'Open Support Tickets', value: d?.openSupportTickets },
          { label: 'Pending Verifications', value: d?.pendingVerifications },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-primary-600 mt-1">{String(s.value ?? 0)}</p>
          </div>
        ))}
      </div>
    </StaffLayout>
  );
}

function AllStaffPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['staff-list'], queryFn: () => api.get('/admin/platform-staff?limit=100') });
  const rows = (data?.data as Record<string, unknown>[]) || [];

  const control = async (id: string, action: string) => {
    await api.post(`/admin/platform-staff/${id}/${action}`);
    qc.invalidateQueries({ queryKey: ['staff-list'] });
  };

  return (
    <StaffLayout>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Name', render: (r) => String(r.fullName) },
          { key: 'email', label: 'Email', render: (r) => String((r.user as { email?: string })?.email) },
          { key: 'employeeId', label: 'Employee ID' },
          { key: 'department', label: 'Department', render: (r) => String((r.department as { name?: string })?.name || '-') },
          { key: 'designation', label: 'Designation' },
          { key: 'role', label: 'Role', render: (r) => String((r.platformRole as { name?: string })?.name || (r.user as { role?: string })?.role) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'lastLogin', label: 'Last Login', render: (r) => {
            const ll = (r.user as { lastLoginAt?: string })?.lastLoginAt;
            return ll ? formatDate(ll) : 'Never';
          }},
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex flex-wrap gap-1">
              <Link to={`/admin/staff/profile/${r.id}`} className="text-xs text-primary-600">View</Link>
              {r.status === 'ACTIVE' ? (
                <ActionBtn variant="danger" onClick={() => control(String(r.id), 'suspend')}>Suspend</ActionBtn>
              ) : (
                <ActionBtn variant="success" onClick={() => control(String(r.id), 'activate')}>Activate</ActionBtn>
              )}
              <ActionBtn onClick={() => control(String(r.id), 'force-logout')}>Logout</ActionBtn>
            </div>
          )},
        ]} rows={rows} />
      )}
    </StaffLayout>
  );
}

const emptyStaff = {
  fullName: '', email: '', phone: '', password: '', employeeId: '', departmentId: '',
  designation: '', platformRoleId: '', joiningDate: '', status: 'ACTIVE', assignedLocations: '',
  sendInvitation: false,
};

function CreateStaffPage() {
  const qc = useQueryClient();
  const { data: deps } = useQuery({ queryKey: ['staff-deps'], queryFn: () => api.get('/admin/platform-staff/departments') });
  const { data: roles } = useQuery({ queryKey: ['staff-roles'], queryFn: () => api.get('/admin/platform-staff/roles') });
  const [form, setForm] = useState(emptyStaff);
  const [result, setResult] = useState<string | null>(null);

  const depList = (deps?.data as { id: string; name: string }[]) || [];
  const roleList = (roles?.data as { id: string; name: string }[]) || [];

  const save = async () => {
    const res = await api.post('/admin/platform-staff', {
      ...form,
      assignedLocations: form.assignedLocations ? form.assignedLocations.split(',').map((s) => s.trim()) : [],
      sendInvitation: form.sendInvitation,
      password: form.password || undefined,
    });
    const temp = (res.data as { temporaryPassword?: string })?.temporaryPassword;
    setResult(temp ? `Staff created. Temporary password: ${temp}` : 'Staff created successfully');
    setForm(emptyStaff);
    qc.invalidateQueries({ queryKey: ['staff-list'] });
  };

  return (
    <StaffLayout>
      <div className="card p-6 max-w-2xl">
        <h2 className="font-semibold mb-4">Create Platform Staff</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><label className="text-xs text-gray-500">Full Name *</label><input className="input w-full" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500">Email *</label><input className="input w-full" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500">Phone</label><input className="input w-full" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500">Employee ID</label><input className="input w-full" placeholder="QH-1024" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} /></div>
          <div>
            <label className="text-xs text-gray-500">Department</label>
            <select className="input w-full" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">Select</option>
              {depList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Designation</label><input className="input w-full" placeholder="Support Executive" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
          <div>
            <label className="text-xs text-gray-500">Role</label>
            <select className="input w-full" value={form.platformRoleId} onChange={(e) => setForm({ ...form, platformRoleId: e.target.value })}>
              <option value="">Select role</option>
              {roleList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div><label className="text-xs text-gray-500">Joining Date</label><input type="date" className="input w-full" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} /></div>
          <div><label className="text-xs text-gray-500">Password</label><input type="password" className="input w-full" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.sendInvitation} onChange={(e) => setForm({ ...form, sendInvitation: e.target.checked })} />
              Send invitation (auto-generate password if empty)
            </label>
          </div>
          <div className="col-span-2"><label className="text-xs text-gray-500">Assigned Locations (comma-separated)</label><input className="input w-full" placeholder="Patna, Bihar" value={form.assignedLocations} onChange={(e) => setForm({ ...form, assignedLocations: e.target.value })} /></div>
        </div>
        {result && <p className="text-sm text-green-600 mt-3">{result}</p>}
        <button className="btn-primary text-sm mt-4" disabled={!form.fullName || !form.email} onClick={save}>Create Staff</button>
      </div>
    </StaffLayout>
  );
}

function DepartmentsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['staff-deps'], queryFn: () => api.get('/admin/platform-staff/departments') });
  const [name, setName] = useState('');
  const rows = (data?.data as Record<string, unknown>[]) || [];

  const create = async () => {
    await api.post('/admin/platform-staff/departments', { name });
    setName('');
    qc.invalidateQueries({ queryKey: ['staff-deps'] });
  };

  return (
    <StaffLayout>
      <div className="flex gap-2 mb-4">
        <input className="input flex-1 max-w-xs" placeholder="New department name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary text-sm" onClick={create} disabled={!name}>Add Department</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Department' },
          { key: 'staff', label: 'Staff Count', render: (r) => String((r._count as { staff?: number })?.staff || 0) },
          { key: 'isSystem', label: 'System', render: (r) => r.isSystem ? 'Yes' : 'Custom' },
        ]} rows={rows} />
      )}
    </StaffLayout>
  );
}

function RolesPage() {
  const qc = useQueryClient();
  const { data: roles, isLoading } = useQuery({ queryKey: ['staff-roles'], queryFn: () => api.get('/admin/platform-staff/roles') });
  const { data: modules } = useQuery({ queryKey: ['staff-modules'], queryFn: () => api.get('/admin/platform-staff/modules') });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [perms, setPerms] = useState<Record<string, Record<string, boolean>>>({});

  const modList = (modules?.data as { modules?: { key: string; label: string }[] })?.modules || [];
  const roleList = (roles?.data as Record<string, unknown>[]) || [];

  const openEdit = (role: Record<string, unknown>) => {
    setEditing(role);
    setPerms((role.permissions as Record<string, Record<string, boolean>>) || {});
  };

  const save = async () => {
    await api.patch(`/admin/platform-staff/roles/${editing?.id}`, { permissions: perms });
    setEditing(null);
    qc.invalidateQueries({ queryKey: ['staff-roles'] });
  };

  return (
    <StaffLayout>
      <p className="text-sm text-gray-500 mb-4">
        Permission hierarchy: Super Admin → Department Manager → Team Lead → Platform Staff.
        Global Settings, Security, Emergency Control are restricted for platform staff.
      </p>
      {isLoading ? <LoadingState /> : (
        <div className="space-y-4">
          {roleList.map((r) => (
            <div key={String(r.id)} className="card p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{String(r.name)} <span className="text-xs text-gray-400">Level {String(r.level)}</span></h3>
                  <p className="text-sm text-gray-500">{String(r.description || '')}</p>
                  <p className="text-xs text-gray-400 mt-1">{String((r._count as { staff?: number })?.staff || 0)} staff assigned</p>
                </div>
                <ActionBtn onClick={() => openEdit(r)}>Edit Permissions</ActionBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold mb-4">Edit Permissions — {String(editing.name)}</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b">
                <th className="py-2">Module</th>
                {PERM_ACTIONS.map((a) => <th key={a} className="py-2 capitalize">{a}</th>)}
              </tr></thead>
              <tbody>
                {modList.map((m) => (
                  <tr key={m.key} className="border-b border-gray-50">
                    <td className="py-2 font-medium">{m.label}</td>
                    {PERM_ACTIONS.map((a) => (
                      <td key={a} className="py-2 text-center">
                        <input type="checkbox" checked={Boolean(perms[m.key]?.[a])}
                          onChange={(e) => setPerms((p) => ({ ...p, [m.key]: { ...p[m.key], [a]: e.target.checked } }))} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-secondary text-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary text-sm" onClick={save}>Save Permissions</button>
            </div>
          </div>
        </div>
      )}
    </StaffLayout>
  );
}

function TasksPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['staff-tasks'], queryFn: () => api.get('/admin/platform-staff/tasks/list') });
  const { data: staff } = useQuery({ queryKey: ['staff-list'], queryFn: () => api.get('/admin/platform-staff?limit=100') });
  const [form, setForm] = useState({ title: '', description: '', assignedToId: '', priority: 'MEDIUM', dueDate: '' });
  const rows = (data?.data as Record<string, unknown>[]) || [];
  const staffList = (staff?.data as { id: string; fullName: string }[]) || [];

  const create = async () => {
    await api.post('/admin/platform-staff/tasks', form);
    setForm({ title: '', description: '', assignedToId: '', priority: 'MEDIUM', dueDate: '' });
    qc.invalidateQueries({ queryKey: ['staff-tasks'] });
  };

  return (
    <StaffLayout>
      <div className="card p-4 mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
        <input className="input" placeholder="Task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <select className="input" value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}>
          <option value="">Assign to...</option>
          {staffList.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
        <textarea className="input md:col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
          {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        <button className="btn-primary text-sm" disabled={!form.title || !form.assignedToId} onClick={create}>Assign Task</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'title', label: 'Task' },
          { key: 'assignedTo', label: 'Assigned To', render: (r) => String((r.assignedTo as { fullName?: string })?.fullName) },
          { key: 'priority', label: 'Priority' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'dueDate', label: 'Due', render: (r) => r.dueDate ? formatDate(String(r.dueDate)) : '-' },
        ]} rows={rows} />
      )}
    </StaffLayout>
  );
}

function AssignmentsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['staff-assignments'], queryFn: () => api.get('/admin/platform-staff/assignments/list') });
  const { data: staff } = useQuery({ queryKey: ['staff-list'], queryFn: () => api.get('/admin/platform-staff?limit=100') });
  const { data: orgs } = useQuery({ queryKey: ['orgs-staff'], queryFn: () => api.get('/admin/organizations?limit=100') });
  const [form, setForm] = useState({ staffProfileId: '', organizationId: '', locationName: '', stateName: '', assignmentType: 'organization' });
  const rows = (data?.data as Record<string, unknown>[]) || [];

  const create = async () => {
    await api.post('/admin/platform-staff/assignments', form);
    qc.invalidateQueries({ queryKey: ['staff-assignments'] });
  };

  return (
    <StaffLayout>
      <div className="card p-4 mb-6 space-y-3 max-w-xl">
        <h3 className="font-medium">Assign Organization or Location</h3>
        <select className="input w-full" value={form.staffProfileId} onChange={(e) => setForm({ ...form, staffProfileId: e.target.value })}>
          <option value="">Select staff</option>
          {((staff?.data as { id: string; fullName: string }[]) || []).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
        <select className="input w-full" value={form.assignmentType} onChange={(e) => setForm({ ...form, assignmentType: e.target.value })}>
          <option value="organization">Organization</option>
          <option value="location">Location</option>
        </select>
        {form.assignmentType === 'organization' ? (
          <select className="input w-full" value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })}>
            <option value="">Select organization</option>
            {((orgs?.data as { id: string; name: string }[]) || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        ) : (
          <>
            <input className="input w-full" placeholder="City" value={form.locationName} onChange={(e) => setForm({ ...form, locationName: e.target.value })} />
            <input className="input w-full" placeholder="State" value={form.stateName} onChange={(e) => setForm({ ...form, stateName: e.target.value })} />
          </>
        )}
        <button className="btn-primary text-sm" onClick={create} disabled={!form.staffProfileId}>Assign</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'staff', label: 'Staff', render: (r) => String((r.staffProfile as { fullName?: string })?.fullName) },
          { key: 'type', label: 'Type', render: (r) => String(r.assignmentType) },
          { key: 'org', label: 'Organization', render: (r) => String((r.organization as { name?: string })?.name || '-') },
          { key: 'location', label: 'Location', render: (r) => [r.locationName, r.stateName].filter(Boolean).join(', ') || '-' },
        ]} rows={rows} />
      )}
    </StaffLayout>
  );
}

function ActivityPage() {
  const { data, isLoading } = useQuery({ queryKey: ['staff-activity'], queryFn: () => api.get('/admin/platform-staff/activity/list?limit=100') });
  const rows = (data?.data as Record<string, unknown>[]) || [];
  return (
    <StaffLayout>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'staff', label: 'Staff', render: (r) => String((r.staffProfile as { fullName?: string })?.fullName) },
          { key: 'action', label: 'Action' },
          { key: 'entityName', label: 'Entity' },
          { key: 'createdAt', label: 'Date/Time', render: (r) => formatDate(String(r.createdAt)) },
          { key: 'ipAddress', label: 'IP' },
        ]} rows={rows} emptyMessage="No activity logged yet" />
      )}
    </StaffLayout>
  );
}

function PerformancePage() {
  const { data, isLoading } = useQuery({ queryKey: ['staff-perf'], queryFn: () => api.get('/admin/platform-staff/performance/list') });
  const rows = (data?.data as Record<string, unknown>[]) || [];
  return (
    <StaffLayout>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'fullName', label: 'Staff' },
          { key: 'employeeId', label: 'ID' },
          { key: 'tasksCompleted', label: 'Tasks Done' },
          { key: 'ticketsResolved', label: 'Tickets Resolved' },
          { key: 'hospitalsVerified', label: 'Verifications' },
          { key: 'activityCount', label: 'Activity Count' },
        ]} rows={rows} />
      )}
    </StaffLayout>
  );
}

function AttendancePage() {
  const { data, isLoading } = useQuery({ queryKey: ['staff-attendance'], queryFn: () => api.get('/admin/platform-staff/attendance/list') });
  const rows = (data?.data as Record<string, unknown>[]) || [];
  return (
    <StaffLayout>
      <p className="text-sm text-gray-500 mb-4">Optional internal HR attendance tracking.</p>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'staff', label: 'Staff', render: (r) => String((r.staffProfile as { fullName?: string })?.fullName) },
          { key: 'checkInAt', label: 'Check In', render: (r) => formatDate(String(r.checkInAt)) },
          { key: 'checkOutAt', label: 'Check Out', render: (r) => r.checkOutAt ? formatDate(String(r.checkOutAt)) : 'Active' },
        ]} rows={rows} />
      )}
    </StaffLayout>
  );
}

function AnnouncementsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['staff-announcements'], queryFn: () => api.get('/admin/platform-staff/announcements/list') });
  const [form, setForm] = useState({ title: '', message: '' });
  const rows = (data?.data as Record<string, unknown>[]) || [];

  const create = async () => {
    await api.post('/admin/platform-staff/announcements', form);
    setForm({ title: '', message: '' });
    qc.invalidateQueries({ queryKey: ['staff-announcements'] });
  };

  return (
    <StaffLayout>
      <div className="card p-4 mb-6 space-y-3 max-w-lg">
        <input className="input w-full" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="input w-full" rows={3} placeholder="Internal announcement message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <button className="btn-primary text-sm" onClick={create} disabled={!form.title || !form.message}>Publish</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'title', label: 'Title' },
          { key: 'isActive', label: 'Active', render: (r) => r.isActive ? 'Yes' : 'No' },
          { key: 'createdAt', label: 'Date', render: (r) => formatDate(String(r.createdAt)) },
        ]} rows={rows} />
      )}
    </StaffLayout>
  );
}

function SecurityPage() {
  const { data: staff } = useQuery({ queryKey: ['staff-list'], queryFn: () => api.get('/admin/platform-staff?limit=100') });
  const [selectedId, setSelectedId] = useState('');
  const { data: sessions } = useQuery({
    queryKey: ['staff-sessions', selectedId],
    queryFn: () => api.get(`/admin/platform-staff/${selectedId}/sessions`),
    enabled: !!selectedId,
  });
  const sessionRows = (sessions?.data as Record<string, unknown>[]) || [];

  return (
    <StaffLayout>
      <div className="card p-6 max-w-xl">
        <h3 className="font-semibold mb-4">Staff Sessions</h3>
        <select className="input w-full mb-4" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">Select staff member</option>
          {((staff?.data as { id: string; fullName: string }[]) || []).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
        {selectedId && (
          <>
            <AdminTable columns={[
              { key: 'createdAt', label: 'Session Started', render: (r) => formatDate(String(r.createdAt)) },
              { key: 'expiresAt', label: 'Expires', render: (r) => formatDate(String(r.expiresAt)) },
            ]} rows={sessionRows} emptyMessage="No active sessions" />
            <button className="btn-secondary text-sm mt-4" onClick={() => api.post(`/admin/platform-staff/${selectedId}/force-logout`)}>
              Force Logout All Sessions
            </button>
          </>
        )}
      </div>
    </StaffLayout>
  );
}

function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['staff-profile', id],
    queryFn: () => api.get(`/admin/platform-staff/${id}`),
    enabled: !!id,
  });
  const p = data?.data as Record<string, unknown> | undefined;
  if (isLoading) return <StaffLayout><LoadingState /></StaffLayout>;
  if (!p) return <StaffLayout><p>Not found</p></StaffLayout>;

  const user = p.user as { email?: string; lastLoginAt?: string; role?: string };
  const perms = p.effectivePermissions as Record<string, Record<string, boolean>> | undefined;

  return (
    <StaffLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="font-bold text-lg">{String(p.fullName)}</h2>
          <div className="text-sm space-y-1 mt-3 text-gray-600">
            <p>Email: {user.email}</p>
            <p>Employee ID: {String(p.employeeId || '-')}</p>
            <p>Department: {String((p.department as { name?: string })?.name || '-')}</p>
            <p>Designation: {String(p.designation || '-')}</p>
            <p>Role: {String((p.platformRole as { name?: string })?.name || user.role)}</p>
            <p>Status: <StatusBadge status={p.status as string} /></p>
            <p>Last Login: {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}</p>
          </div>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Module Access</h3>
          <div className="flex flex-wrap gap-2">
            {perms && Object.entries(perms).filter(([, v]) => v?.view).map(([k]) => (
              <span key={k} className="badge bg-green-50 text-green-700">{k.replace(/_/g, ' ')}</span>
            ))}
          </div>
        </div>
      </div>
    </StaffLayout>
  );
}

export function AdminStaffPage() {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="all" element={<AllStaffPage />} />
      <Route path="create" element={<CreateStaffPage />} />
      <Route path="departments" element={<DepartmentsPage />} />
      <Route path="roles" element={<RolesPage />} />
      <Route path="tasks" element={<TasksPage />} />
      <Route path="assignments" element={<AssignmentsPage />} />
      <Route path="activity" element={<ActivityPage />} />
      <Route path="performance" element={<PerformancePage />} />
      <Route path="attendance" element={<AttendancePage />} />
      <Route path="announcements" element={<AnnouncementsPage />} />
      <Route path="security" element={<SecurityPage />} />
      <Route path="profile/:id" element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/admin/staff" replace />} />
    </Routes>
  );
}
