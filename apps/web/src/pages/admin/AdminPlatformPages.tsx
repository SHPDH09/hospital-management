import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

function useList(endpoint: string) {
  return useQuery({ queryKey: [endpoint], queryFn: () => api.get(endpoint) });
}

export function AdminStaffPage() {
  const { data, isLoading, refetch } = useList('/admin/staff');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', role: 'PLATFORM_STAFF' });

  const createStaff = async () => {
    await api.post('/admin/staff', form);
    setShowForm(false);
    refetch();
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Platform Staff" subtitle="Manage operations, verification, finance, support teams" actions={
        <button className="btn-primary text-sm" onClick={() => setShowForm(!showForm)}>+ Add Staff</button>
      } />
      {showForm && (
        <div className="card p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="PLATFORM_STAFF">Platform Staff</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
          <button className="btn-primary" onClick={createStaff}>Create</button>
        </div>
      )}
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Role' },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'SUSPENDED'} /> },
          { key: 'lastLoginAt', label: 'Last Login', render: (r) => r.lastLoginAt ? formatDate(r.lastLoginAt as string) : 'Never' },
          { key: 'actions', label: 'Actions', render: (r) => (
            <ActionBtn variant={r.isActive ? 'danger' : 'success'} onClick={() => api.patch(`/admin/staff/${r.id}`, { isActive: !r.isActive }).then(() => refetch())}>
              {r.isActive ? 'Block' : 'Unblock'}
            </ActionBtn>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminRolesPage() {
  const { data, isLoading } = useList('/admin/roles');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Roles & Permissions" subtitle="Platform role hierarchy and module access" />
      {isLoading ? <LoadingState /> : (
        <div className="space-y-4">
          {(data?.data as { role: string; description: string; modules: string[] }[])?.map((r) => (
            <div key={r.role} className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{r.role}</h3>
                  <p className="text-sm text-gray-500 mt-1">{r.description}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {r.modules.map((m) => <span key={m} className="badge bg-primary-50 text-primary-700">{m}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export function AdminSecurityPage() {
  const { data: logins } = useList('/admin/security/login-history');
  const { data: sessions } = useList('/admin/security/sessions');

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Security Center" subtitle="Login history, active sessions, and security monitoring" />
      <h2 className="font-semibold mb-3">Login History</h2>
      <AdminTable columns={[
        { key: 'email', label: 'Email' },
        { key: 'success', label: 'Result', render: (r) => <StatusBadge status={r.success ? 'COMPLETED' : 'FAILED'} /> },
        { key: 'ipAddress', label: 'IP' },
        { key: 'failureReason', label: 'Reason', render: (r) => String(r.failureReason || '-') },
        { key: 'createdAt', label: 'Time', render: (r) => formatDate(r.createdAt as string) },
      ]} rows={(logins?.data as Record<string, unknown>[]) || []} />

      <h2 className="font-semibold mb-3 mt-8">Active Sessions</h2>
      <AdminTable columns={[
        { key: 'user', label: 'User', render: (r) => String((r.user as { email?: string })?.email) },
        { key: 'role', label: 'Role', render: (r) => String((r.user as { role?: string })?.role) },
        { key: 'expiresAt', label: 'Expires', render: (r) => formatDate(r.expiresAt as string) },
        { key: 'actions', label: 'Actions', render: (r) => (
          <ActionBtn variant="danger" onClick={() => api.delete(`/admin/security/sessions/${r.userId}`)}>Force Logout</ActionBtn>
        )},
      ]} rows={(sessions?.data as Record<string, unknown>[]) || []} />
    </DashboardLayout>
  );
}

export function AdminAuditLogsPage() {
  const { data, isLoading } = useList('/admin/audit-logs');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Audit Logs" subtitle="Immutable record of all platform actions" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'user', label: 'Who', render: (r) => String((r.user as { email?: string })?.email || 'System') },
          { key: 'action', label: 'Action' },
          { key: 'entityType', label: 'Entity' },
          { key: 'entityId', label: 'Entity ID', render: (r) => <span className="text-xs font-mono">{String(r.entityId || '-').slice(0, 8)}</span> },
          { key: 'ipAddress', label: 'IP' },
          { key: 'createdAt', label: 'When', render: (r) => formatDate(r.createdAt as string) },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminComplaintsPage() {
  const { data, isLoading, refetch } = useList('/admin/complaints');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Support & Complaints" subtitle="Manage patient and hospital complaints" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'ticketId', label: 'Ticket' },
          { key: 'subject', label: 'Subject' },
          { key: 'type', label: 'Type' },
          { key: 'priority', label: 'Priority', render: (r) => <StatusBadge status={r.priority as string} /> },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'assignedTo', label: 'Assigned', render: (r) => String((r.assignedTo as { email?: string })?.email || 'Unassigned') },
          { key: 'actions', label: 'Actions', render: (r) => (
            <select className="text-xs border rounded px-1" value={r.status as string} onChange={(e) => api.patch(`/admin/complaints/${r.id}`, { status: e.target.value }).then(() => refetch())}>
              {['NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminLocationsPage() {
  const { data, isLoading } = useList('/admin/locations');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Location Management" subtitle="Countries, states, cities, districts, areas" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Name' },
          { key: 'type', label: 'Type' },
          { key: 'parent', label: 'Parent', render: (r) => String((r.parent as { name?: string })?.name || '-') },
          { key: 'pinCode', label: 'PIN Code' },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminMasterDataPage() {
  const { data, isLoading } = useList('/admin/specializations');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Healthcare Master Data" subtitle="Specializations, departments, and medical services" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Specialization' },
          { key: 'department', label: 'Department' },
          { key: 'services', label: 'Services', render: (r) => (r.services as string[])?.join(', ') || '-' },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'SUSPENDED'} /> },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminCommunicationsPage() {
  const { data, isLoading } = useList('/admin/communications');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Communication Center" subtitle="Email, SMS, WhatsApp templates" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Template' },
          { key: 'channel', label: 'Channel' },
          { key: 'subject', label: 'Subject' },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'SUSPENDED'} /> },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminCmsPage() {
  const { data, isLoading } = useList('/admin/cms');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="CMS Management" subtitle="Website content — About, FAQ, Terms, Privacy" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'title', label: 'Page' },
          { key: 'slug', label: 'Slug' },
          { key: 'isPublished', label: 'Status', render: (r) => <StatusBadge status={r.isPublished ? 'ACTIVE' : 'PENDING'} /> },
          { key: 'updatedAt', label: 'Updated', render: (r) => formatDate(r.updatedAt as string) },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminSettingsPage() {
  const { data, isLoading } = useList('/admin/settings');
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Global Settings" subtitle="Platform name, contact, currency, integrations" />
      {isLoading ? <LoadingState /> : (
        <div className="space-y-4">
          {(data?.data as { key: string; value: unknown; category: string }[])?.length === 0 ? (
            <div className="card p-8 text-center text-gray-500">
              <p>No settings configured yet.</p>
              <p className="text-sm mt-2">Settings like platform name, logo, SMTP, payment gateway can be added here.</p>
            </div>
          ) : (
            <AdminTable columns={[
              { key: 'key', label: 'Setting' },
              { key: 'category', label: 'Category' },
              { key: 'value', label: 'Value', render: (r) => <span className="text-xs font-mono">{JSON.stringify(r.value)}</span> },
            ]} rows={(data?.data as Record<string, unknown>[]) || []} />
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

export function AdminEmergencyPage() {
  const { data, refetch } = useList('/admin/emergency');
  const flags = (data?.data || {}) as Record<string, boolean>;

  const toggle = async (key: string, value: boolean) => {
    await api.put('/admin/emergency', { [key]: value });
    refetch();
  };

  const controls = [
    { key: 'maintenanceMode', label: 'Maintenance Mode', desc: 'Disable public website access' },
    { key: 'registrationDisabled', label: 'Disable Registration', desc: 'Block new user signups' },
    { key: 'paymentDisabled', label: 'Disable Payments', desc: 'Stop all payment processing' },
    { key: 'advertisementsDisabled', label: 'Stop Advertisements', desc: 'Pause all ad campaigns' },
  ];

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Emergency Control" subtitle="Platform-wide emergency actions" />
      <div className="space-y-4">
        {controls.map((c) => (
          <div key={c.key} className="card p-6 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-red-700">{c.label}</h3>
              <p className="text-sm text-gray-500">{c.desc}</p>
            </div>
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium ${flags[c.key] ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              onClick={() => toggle(c.key, !flags[c.key])}
            >
              {flags[c.key] ? 'ON — Click to Disable' : 'OFF — Click to Enable'}
            </button>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
