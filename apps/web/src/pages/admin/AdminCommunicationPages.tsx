import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const subNav = [
  { to: '/admin/communications', label: 'Dashboard', end: true },
  { to: '/admin/communications/email', label: 'Email' },
  { to: '/admin/communications/sms', label: 'SMS' },
  { to: '/admin/communications/whatsapp', label: 'WhatsApp' },
  { to: '/admin/communications/push', label: 'Push' },
  { to: '/admin/communications/templates', label: 'Templates' },
  { to: '/admin/communications/campaigns', label: 'Campaigns' },
  { to: '/admin/communications/scheduled', label: 'Scheduled' },
  { to: '/admin/communications/history', label: 'History' },
  { to: '/admin/communications/failed', label: 'Failed' },
  { to: '/admin/communications/usage', label: 'Usage & Cost' },
  { to: '/admin/communications/announcements', label: 'Announcements' },
  { to: '/admin/communications/providers', label: 'Providers' },
  { to: '/admin/communications/permissions', label: 'Permissions' },
];

function CommLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Communication Center" subtitle="Email, SMS, WhatsApp, push notifications, and campaigns" />
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

const USER_TYPES = ['PATIENT', 'DOCTOR', 'HOSPITAL', 'CLINIC', 'STAFF'];

function SendPanel({ channel, title }: { channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH'; title: string }) {
  const qc = useQueryClient();
  const { data: templates } = useQuery({ queryKey: ['comm-tpl', channel], queryFn: () => api.get(`/admin/communications/templates?channel=${channel}`) });
  const tplList = (templates?.data as { id: string; name: string }[]) || [];
  const [form, setForm] = useState({
    subject: '', body: '', templateId: '', userType: 'PATIENT', userId: '', scheduledAt: '', city: '', state: '',
  });
  const [preview, setPreview] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  const audience = {
    userType: form.userType || undefined,
    userId: form.userId || undefined,
    city: form.city || undefined,
    state: form.state || undefined,
  };

  const previewAudience = async () => {
    const res = await api.post('/admin/communications/audience/preview', { audience });
    setPreview((res.data as { count: number })?.count ?? 0);
  };

  const send = async () => {
    setSending(true);
    const res = await api.post('/admin/communications/send', {
      channel, subject: form.subject || undefined, body: form.body,
      templateId: form.templateId || undefined,
      scheduledAt: form.scheduledAt || undefined,
      audience,
    });
    setSending(false);
    if (res.success) {
      alert(`Sent to ${(res.data as { count: number })?.count} recipients`);
      qc.invalidateQueries({ queryKey: ['comm-history'] });
    } else alert(res.error || 'Send failed');
  };

  return (
    <CommLayout>
      <h2 className="font-semibold text-lg mb-4">{title}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-3">
          <h3 className="font-medium">Compose Message</h3>
          {channel === 'EMAIL' && (
            <input className="input w-full" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          )}
          <select className="input w-full" value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
            <option value="">Use template (optional)</option>
            {tplList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <textarea className="input w-full" rows={6} placeholder="Message body — use {{patient_name}}, {{doctor_name}}, {{hospital_name}}, etc."
            value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <input type="datetime-local" className="input w-full" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          <p className="text-xs text-gray-400">Leave schedule empty to send immediately</p>
        </div>
        <div className="card p-6 space-y-3">
          <h3 className="font-medium">Audience</h3>
          <select className="input w-full" value={form.userType} onChange={(e) => setForm({ ...form, userType: e.target.value })}>
            {USER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="input w-full" placeholder="Specific User ID (optional)" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} />
          <input className="input w-full" placeholder="Filter by City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input className="input w-full" placeholder="Filter by State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          <button type="button" className="btn-secondary text-sm w-full" onClick={previewAudience}>
            Preview Audience {preview !== null ? `(${preview} recipients)` : ''}
          </button>
          <button type="button" className="btn-primary w-full py-3" disabled={!form.body || sending} onClick={send}>
            {sending ? 'Sending...' : form.scheduledAt ? 'Schedule Message' : 'Send Now'}
          </button>
        </div>
      </div>
    </CommLayout>
  );
}

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['comm-dash'], queryFn: () => api.get('/admin/communications/dashboard') });
  const d = data?.data as Record<string, unknown> | undefined;
  const usage = (d?.usageByChannel as { channel: string; count: number }[]) || [];

  if (isLoading) return <CommLayout><LoadingState /></CommLayout>;

  return (
    <CommLayout>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Emails Sent', value: d?.email, color: 'text-blue-600' },
          { label: 'SMS Sent', value: d?.sms, color: 'text-green-600' },
          { label: 'WhatsApp', value: d?.whatsapp, color: 'text-emerald-600' },
          { label: 'Push Notifications', value: d?.push, color: 'text-purple-600' },
          { label: 'Failed', value: d?.failed, color: 'text-red-600' },
          { label: 'Pending', value: d?.pending, color: 'text-orange-600' },
          { label: 'Scheduled', value: d?.scheduled, color: 'text-indigo-600' },
          { label: "Today's Total", value: d?.todayTotal, color: 'text-gray-700' },
        ].map((s) => (
          <div key={s.label} className="card p-5 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{String(s.value ?? 0)}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <p className="text-sm text-gray-500">Monthly Cost (Est.)</p>
          <p className="text-2xl font-bold text-primary-600">{formatCurrency((d?.monthlyCost as number) || 0)}</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500">Delivery Rate</p>
          <p className="text-2xl font-bold text-green-600">{String(d?.deliveryRate ?? 0)}%</p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-500">Failure Rate</p>
          <p className="text-2xl font-bold text-red-600">{String(d?.failureRate ?? 0)}%</p>
        </div>
      </div>
      <div className="card p-6 mt-6">
        <h3 className="font-semibold mb-4">This Month by Channel</h3>
        <div className="grid grid-cols-4 gap-4">
          {usage.map((u) => (
            <div key={u.channel} className="text-center">
              <p className="text-sm text-gray-500">{u.channel}</p>
              <p className="text-xl font-bold">{u.count}</p>
            </div>
          ))}
        </div>
      </div>
    </CommLayout>
  );
}

function TemplatesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['comm-templates'], queryFn: () => api.get('/admin/communications/templates') });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ name: '', channel: 'EMAIL', category: '', subject: '', body: '' });
  const refetch = () => qc.invalidateQueries({ queryKey: ['comm-templates'] });

  const save = async () => {
    if (editing?.id) await api.patch(`/admin/communications/templates/${editing.id}`, form);
    else await api.post('/admin/communications/templates', form);
    setEditing(null); refetch();
  };

  return (
    <CommLayout>
      <div className="flex justify-end mb-4">
        <button className="btn-primary text-sm" onClick={() => { setEditing({}); setForm({ name: '', channel: 'EMAIL', category: '', subject: '', body: '' }); }}>+ Create Template</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Template' },
          { key: 'channel', label: 'Channel', render: (r) => <StatusBadge status={r.channel as string} /> },
          { key: 'category', label: 'Category', render: (r) => String(r.category || '-') },
          { key: 'subject', label: 'Subject', render: (r) => String(r.subject || '-') },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'CANCELLED'} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <ActionBtn onClick={() => { setEditing(r); setForm({ name: String(r.name), channel: String(r.channel), category: String(r.category || ''), subject: String(r.subject || ''), body: String(r.body) }); }}>Edit</ActionBtn>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold mb-4">{editing.id ? 'Edit Template' : 'Create Template'}</h3>
            <div className="space-y-3 text-sm">
              <input className="input w-full" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <select className="input w-full" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                {['EMAIL', 'SMS', 'WHATSAPP', 'PUSH'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className="input w-full" placeholder="Category (e.g. Appointment, Payment)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <input className="input w-full" placeholder="Subject (email only)" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              <textarea className="input w-full" rows={5} placeholder="Body with {{patient_name}}, {{doctor_name}}, etc." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-secondary text-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary text-sm" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </CommLayout>
  );
}

function HistoryPage({ status }: { status?: string }) {
  const qc = useQueryClient();
  const endpoint = `/admin/communications/${status === 'FAILED' ? 'failed' : 'history'}${status && status !== 'FAILED' ? `?status=${status}` : ''}`;
  const { data, isLoading } = useQuery({ queryKey: ['comm-history', status], queryFn: () => api.get(endpoint) });
  const rows = status === 'FAILED' ? (data?.data as Record<string, unknown>[]) : (data?.data as Record<string, unknown>[]) || [];

  const retry = async (id: string) => {
    await api.post(`/admin/communications/retry/${id}`);
    qc.invalidateQueries({ queryKey: ['comm-history'] });
  };

  const retryAll = async () => {
    await api.post('/admin/communications/retry-all');
    qc.invalidateQueries({ queryKey: ['comm-history'] });
  };

  return (
    <CommLayout>
      {status === 'FAILED' && (
        <div className="flex justify-end mb-4">
          <button className="btn-primary text-sm" onClick={retryAll}>Retry All Failed</button>
        </div>
      )}
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'date', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
          { key: 'recipient', label: 'Recipient', render: (r) => String(r.recipientName || r.recipientEmail || r.recipientPhone || '-') },
          { key: 'channel', label: 'Channel', render: (r) => <StatusBadge status={r.channel as string} /> },
          { key: 'subject', label: 'Message', render: (r) => <span className="max-w-xs truncate block">{String(r.subject || r.body).slice(0, 60)}</span> },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'actions', label: 'Actions', render: (r) => r.status === 'FAILED' ? (
            <ActionBtn onClick={() => retry(r.id as string)}>Retry</ActionBtn>
          ) : <ActionBtn onClick={() => alert(String(r.body))}>View</ActionBtn> },
        ]} rows={rows} />
      )}
    </CommLayout>
  );
}

function CampaignsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['comm-campaigns'], queryFn: () => api.get('/admin/communications/campaigns') });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', body: '', channels: ['EMAIL'] as string[], userType: 'PATIENT' });
  const refetch = () => qc.invalidateQueries({ queryKey: ['comm-campaigns'] });

  const create = async () => {
    await api.post('/admin/communications/campaigns', {
      name: form.name, body: form.body, channels: form.channels,
      audience: { userType: form.userType },
    });
    setShowForm(false); refetch();
  };

  return (
    <CommLayout>
      <div className="flex justify-end mb-4">
        <button className="btn-primary text-sm" onClick={() => setShowForm(true)}>+ Create Campaign</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Campaign' },
          { key: 'channels', label: 'Channels', render: (r) => (r.channels as string[])?.join(', ') },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'createdAt', label: 'Created', render: (r) => formatDate(r.createdAt as string) },
          { key: 'actions', label: 'Actions', render: (r) => (
            <ActionBtn onClick={() => api.post(`/admin/communications/campaigns/${r.id}/send`).then(refetch)}>Send</ActionBtn>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">New Campaign</h3>
            <input className="input w-full mb-3" placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <textarea className="input w-full mb-3" rows={4} placeholder="Message" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <select className="input w-full mb-3" value={form.userType} onChange={(e) => setForm({ ...form, userType: e.target.value })}>
              {USER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-sm" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary text-sm" onClick={create}>Create Draft</button>
            </div>
          </div>
        </div>
      )}
    </CommLayout>
  );
}

function UsagePage() {
  const { data, isLoading } = useQuery({ queryKey: ['comm-usage'], queryFn: () => api.get('/admin/communications/usage') });
  const u = data?.data as Record<string, unknown> | undefined;
  if (isLoading) return <CommLayout><LoadingState /></CommLayout>;
  return (
    <CommLayout>
      <div className="card p-6 mb-6">
        <h3 className="font-semibold mb-4">{String(u?.month)}</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {['email', 'sms', 'whatsapp', 'push'].map((ch) => (
            <div key={ch} className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 uppercase">{ch}</p>
              <p className="text-2xl font-bold">{String(u?.[ch] ?? 0)}</p>
            </div>
          ))}
          <div className="text-center p-4 bg-primary-50 rounded-lg">
            <p className="text-sm text-gray-500">Est. Cost</p>
            <p className="text-2xl font-bold text-primary-600">{formatCurrency((u?.estimatedCost as number) || 0)}</p>
          </div>
        </div>
      </div>
    </CommLayout>
  );
}

function AnnouncementsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['comm-announce'], queryFn: () => api.get('/admin/communications/announcements') });
  const [form, setForm] = useState({ title: '', message: '', type: 'INFORMATION', audience: ['EVERYONE'] });
  const [show, setShow] = useState(false);
  const refetch = () => qc.invalidateQueries({ queryKey: ['comm-announce'] });

  return (
    <CommLayout>
      <div className="flex justify-end mb-4">
        <button className="btn-primary text-sm" onClick={() => setShow(true)}>+ New Announcement</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'title', label: 'Title' },
          { key: 'type', label: 'Type', render: (r) => <StatusBadge status={r.type as string} /> },
          { key: 'audience', label: 'Audience', render: (r) => (r.audience as string[])?.join(', ') },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'CANCELLED'} /> },
          { key: 'actions', label: 'Actions', render: (r) => r.isActive ? (
            <ActionBtn variant="danger" onClick={() => api.patch(`/admin/communications/announcements/${r.id}/deactivate`).then(refetch)}>Deactivate</ActionBtn>
          ) : null },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
      {show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="font-semibold mb-4">System Announcement</h3>
            <input className="input w-full mb-3" placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea className="input w-full mb-3" rows={3} placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            <select className="input w-full mb-3" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {['INFORMATION', 'WARNING', 'MAINTENANCE', 'EMERGENCY'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button className="btn-secondary text-sm" onClick={() => setShow(false)}>Cancel</button>
              <button className="btn-primary text-sm" onClick={() => api.post('/admin/communications/announcements', form).then(() => { setShow(false); refetch(); })}>Publish</button>
            </div>
          </div>
        </div>
      )}
    </CommLayout>
  );
}

function ProvidersPage() {
  const [email, setEmail] = useState({ provider: 'SMTP', senderName: '', senderEmail: '', host: '', apiKey: '' });
  const save = async (key: string, data: object) => {
    await api.put(`/admin/communications/providers/${key}`, data);
    alert('Settings saved (API keys stored securely, not shown in UI)');
  };
  return (
    <CommLayout>
      <div className="space-y-6 max-w-xl">
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Email Provider</h3>
          <div className="space-y-3 text-sm">
            <input className="input w-full" placeholder="Sender Name" value={email.senderName} onChange={(e) => setEmail({ ...email, senderName: e.target.value })} />
            <input className="input w-full" placeholder="Sender Email" value={email.senderEmail} onChange={(e) => setEmail({ ...email, senderEmail: e.target.value })} />
            <input className="input w-full" placeholder="SMTP Host / API Provider" value={email.host} onChange={(e) => setEmail({ ...email, host: e.target.value })} />
            <input className="input w-full" type="password" placeholder="API Key (masked after save)" value={email.apiKey} onChange={(e) => setEmail({ ...email, apiKey: e.target.value })} />
            <button className="btn-primary text-sm" onClick={() => save('email', email)}>Save Email Settings</button>
          </div>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-4">SMS / WhatsApp / Push</h3>
          <p className="text-sm text-gray-500">Configure provider API keys via secure settings. Keys are never displayed in plaintext after saving.</p>
        </div>
      </div>
    </CommLayout>
  );
}

function PermissionsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['comm-perms'], queryFn: () => api.get('/admin/communications/permissions') });
  const perms = data?.data as Record<string, Record<string, boolean>> | undefined;
  if (isLoading) return <CommLayout><LoadingState /></CommLayout>;
  return (
    <CommLayout>
      <div className="card p-6 max-w-2xl">
        <h3 className="font-semibold mb-4">Communication Permissions by Role</h3>
        <div className="space-y-4 text-sm">
          {perms && Object.entries(perms).map(([role, rules]) => (
            <div key={role} className="border-b pb-3">
              <p className="font-medium">{role.replace(/_/g, ' ')}</p>
              <ul className="mt-1 text-gray-600">
                {Object.entries(rules).map(([k, v]) => (
                  <li key={k}>{v ? '✅' : '❌'} {k.replace(/([A-Z])/g, ' $1')}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">Contact platform admin to modify permission matrix.</p>
      </div>
    </CommLayout>
  );
}

function ScheduledPage() {
  const { data, isLoading } = useQuery({ queryKey: ['comm-scheduled'], queryFn: () => api.get('/admin/communications/scheduled') });
  return (
    <CommLayout>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Name' },
          { key: 'channel', label: 'Channel' },
          { key: 'runAt', label: 'Next Run', render: (r) => r.runAt ? formatDate(r.runAt as string) : String(r.cronExpr || '-') },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'CANCELLED'} /> },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} emptyMessage="No scheduled communications" />
      )}
    </CommLayout>
  );
}

export function AdminCommunicationsPage() {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="email" element={<SendPanel channel="EMAIL" title="Email Center" />} />
      <Route path="sms" element={<SendPanel channel="SMS" title="SMS Center" />} />
      <Route path="whatsapp" element={<SendPanel channel="WHATSAPP" title="WhatsApp Center" />} />
      <Route path="push" element={<SendPanel channel="PUSH" title="Push Notification Center" />} />
      <Route path="templates" element={<TemplatesPage />} />
      <Route path="campaigns" element={<CampaignsPage />} />
      <Route path="scheduled" element={<ScheduledPage />} />
      <Route path="history" element={<HistoryPage />} />
      <Route path="failed" element={<HistoryPage status="FAILED" />} />
      <Route path="usage" element={<UsagePage />} />
      <Route path="announcements" element={<AnnouncementsPage />} />
      <Route path="providers" element={<ProvidersPage />} />
      <Route path="permissions" element={<PermissionsPage />} />
      <Route path="*" element={<Navigate to="/admin/communications" replace />} />
    </Routes>
  );
}
