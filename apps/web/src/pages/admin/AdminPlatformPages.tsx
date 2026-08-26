import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';

function useList(endpoint: string) {
  return useQuery({ queryKey: [endpoint], queryFn: () => api.get(endpoint) });
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
  const { data: sessions, refetch } = useList('/admin/security/sessions');

  const forceLogout = async (userId: string) => {
    if (!userId) return;
    if (!confirm('Force logout this user from all devices?')) return;
    const result = await api.delete(`/admin/security/sessions/${userId}`);
    if (result.success) {
      await refetch();
    } else {
      alert(result.error || 'Failed to force logout user');
    }
  };

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
        { key: 'user', label: 'User', render: (r) => String((r.user as { email?: string })?.email || '-') },
        { key: 'role', label: 'Role', render: (r) => String((r.user as { role?: string })?.role || '-') },
        { key: 'sessionCount', label: 'Devices', render: (r) => String(r.sessionCount || 1) },
        { key: 'createdAt', label: 'Last Active', render: (r) => formatDate(r.createdAt as string) },
        { key: 'expiresAt', label: 'Expires', render: (r) => formatDate(r.expiresAt as string) },
        { key: 'actions', label: 'Actions', render: (r) => (
          <ActionBtn variant="danger" onClick={() => forceLogout(r.userId as string)}>Force Logout</ActionBtn>
        )},
      ]} rows={(sessions?.data as Record<string, unknown>[]) || []} emptyMessage="No active sessions" />
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

const LOCATION_TYPES = ['COUNTRY', 'STATE', 'DISTRICT', 'CITY', 'AREA'] as const;
const PARENT_TYPES: Record<string, string[]> = {
  COUNTRY: [],
  STATE: ['COUNTRY'],
  DISTRICT: ['STATE'],
  CITY: ['STATE', 'DISTRICT'],
  AREA: ['CITY', 'DISTRICT'],
};

const emptyLocation = { name: '', type: 'STATE' as typeof LOCATION_TYPES[number], parentId: '', pinCode: '' };

export function AdminLocationsPage() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(emptyLocation);
  const endpoint = `/admin/locations${typeFilter ? `?type=${typeFilter}` : ''}`;
  const { data, isLoading } = useList(endpoint);
  const { data: allLocations } = useList('/admin/locations');
  const refetch = () => qc.invalidateQueries({ queryKey: [endpoint] });

  const parentOptions = ((allLocations?.data as { id: string; name: string; type: string }[]) || [])
    .filter((l) => PARENT_TYPES[form.type]?.includes(l.type));

  const save = async () => {
    const payload = {
      name: form.name,
      type: form.type,
      parentId: form.type === 'COUNTRY' ? undefined : form.parentId || undefined,
      pinCode: form.pinCode || undefined,
    };
    if (editing?.id) await api.patch(`/admin/locations/${editing.id}`, payload);
    else await api.post('/admin/locations', payload);
    setEditing(null);
    setForm(emptyLocation);
    qc.invalidateQueries({ queryKey: ['/admin/locations'] });
    refetch();
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setForm({
      name: String(row.name || ''),
      type: (row.type as typeof LOCATION_TYPES[number]) || 'STATE',
      parentId: String((row.parent as { id?: string })?.id || row.parentId || ''),
      pinCode: String(row.pinCode || ''),
    });
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Location Management"
        subtitle="Manage countries, states, cities, districts, and areas"
        actions={<button className="btn-primary text-sm" onClick={() => { setEditing({}); setForm({ ...emptyLocation, type: 'COUNTRY' }); }}>+ Add Location</button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <button className={`px-3 py-1 rounded-lg text-sm ${!typeFilter ? 'bg-primary-50 text-primary-700' : 'bg-gray-100'}`} onClick={() => setTypeFilter('')}>All</button>
        {LOCATION_TYPES.map((t) => (
          <button key={t} className={`px-3 py-1 rounded-lg text-sm ${typeFilter === t ? 'bg-primary-50 text-primary-700' : 'bg-gray-100'}`} onClick={() => setTypeFilter(t)}>{t}</button>
        ))}
      </div>

      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Name' },
          { key: 'type', label: 'Type', render: (r) => <StatusBadge status={r.type as string} /> },
          { key: 'parent', label: 'Parent', render: (r) => String((r.parent as { name?: string })?.name || '-') },
          { key: 'pinCode', label: 'PIN Code', render: (r) => String(r.pinCode || '-') },
          { key: 'children', label: 'Children', render: (r) => String((r._count as { children?: number })?.children ?? 0) },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'CANCELLED'} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex flex-wrap gap-2">
              <ActionBtn onClick={() => openEdit(r)}>Edit</ActionBtn>
              {r.isActive
                ? <ActionBtn variant="danger" onClick={() => api.patch(`/admin/locations/${r.id}/deactivate`).then(refetch)}>Deactivate</ActionBtn>
                : <ActionBtn variant="success" onClick={() => api.patch(`/admin/locations/${r.id}/activate`).then(refetch)}>Activate</ActionBtn>}
              <ActionBtn variant="danger" onClick={() => { if (confirm('Delete this location?')) api.delete(`/admin/locations/${r.id}`).then(refetch); }}>Delete</ActionBtn>
            </div>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} emptyMessage="No locations found" />
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">{editing.id ? 'Edit Location' : 'Add Location'}</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-xs text-gray-500">Name</label>
                <input className="input w-full" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Type</label>
                <select className="input w-full" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof form.type, parentId: '' })}>
                  {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {form.type !== 'COUNTRY' && (
                <div>
                  <label className="text-xs text-gray-500">Parent ({PARENT_TYPES[form.type]?.join(' / ')})</label>
                  <select className="input w-full" value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
                    <option value="">Select parent</option>
                    {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
                  </select>
                </div>
              )}
              {(form.type === 'CITY' || form.type === 'AREA') && (
                <div>
                  <label className="text-xs text-gray-500">PIN Code</label>
                  <input className="input w-full" value={form.pinCode} onChange={(e) => setForm({ ...form, pinCode: e.target.value })} />
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-secondary text-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button
                className="btn-primary text-sm"
                disabled={!form.name || (form.type !== 'COUNTRY' && !form.parentId)}
                onClick={save}
              >
                {editing.id ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

