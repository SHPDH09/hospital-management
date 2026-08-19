import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

const subNav = [
  { to: '/admin/support', label: 'Dashboard', end: true },
  { to: '/admin/support/tickets', label: 'All Tickets' },
  { to: '/admin/support/new', label: 'New' },
  { to: '/admin/support/open', label: 'Open' },
  { to: '/admin/support/in-progress', label: 'In Progress' },
  { to: '/admin/support/waiting', label: 'Waiting' },
  { to: '/admin/support/resolved', label: 'Resolved' },
  { to: '/admin/support/closed', label: 'Closed' },
  { to: '/admin/support/escalated', label: 'Escalated' },
  { to: '/admin/support/complaints', label: 'Complaints' },
  { to: '/admin/support/requests', label: 'Support Requests' },
  { to: '/admin/support/categories', label: 'Categories' },
  { to: '/admin/support/sla', label: 'SLA' },
  { to: '/admin/support/assignment-rules', label: 'Assignment Rules' },
  { to: '/admin/support/knowledge-base', label: 'Knowledge Base' },
  { to: '/admin/support/canned', label: 'Canned Responses' },
  { to: '/admin/support/analytics', label: 'Analytics' },
  { to: '/admin/support/performance', label: 'Staff Performance' },
  { to: '/admin/support/csat', label: 'CSAT' },
];

function SupportLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Support & Complaints" subtitle="Ticket management, SLA, conversations, and customer satisfaction" />
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
  const { data, isLoading } = useQuery({ queryKey: ['support-dash'], queryFn: () => api.get('/admin/support/dashboard') });
  const d = data?.data as Record<string, unknown> | undefined;
  if (isLoading) return <SupportLayout><LoadingState /></SupportLayout>;

  return (
    <SupportLayout>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Tickets', value: d?.totalTickets },
          { label: 'New Tickets', value: d?.newTickets },
          { label: 'Open', value: d?.openTickets },
          { label: 'In Progress', value: d?.inProgress },
          { label: 'Waiting for User', value: d?.waitingForUser },
          { label: 'Resolved', value: d?.resolved },
          { label: 'Closed', value: d?.closed },
          { label: 'Escalated', value: d?.escalated },
          { label: 'High Priority', value: d?.highPriority },
          { label: "Today's Tickets", value: d?.todayTickets },
          { label: 'Resolved Today', value: d?.resolvedToday },
          { label: 'Avg Response', value: d?.avgResponseMinutes ? `${d.avgResponseMinutes} min` : '-' },
          { label: 'Avg Resolution', value: d?.avgResolutionHours ? `${d.avgResolutionHours} hrs` : '-' },
          { label: 'CSAT', value: d?.customerSatisfaction ? `${d.customerSatisfaction}/5` : '-' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-primary-600 mt-1">{String(s.value ?? 0)}</p>
          </div>
        ))}
      </div>
    </SupportLayout>
  );
}

function TicketListPage({ filter = '', title = 'All Tickets', kind }: { filter?: string; title?: string; kind?: string }) {
  const [search, setSearch] = useState('');
  const query = `?limit=50${filter}${kind ? `&kind=${kind}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const { data, isLoading } = useQuery({ queryKey: ['support-tickets', filter, kind, search], queryFn: () => api.get(`/admin/support/tickets${query}`) });
  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <SupportLayout>
      <div className="flex gap-2 mb-4">
        <input className="input flex-1 max-w-md" placeholder="Search ticket ID, name, email, subject..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Link to="/admin/support/create" className="btn-primary text-sm">+ Create Ticket</Link>
      </div>
      <h3 className="font-semibold mb-3">{title} ({rows.length})</h3>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'ticketId', label: 'Ticket ID', render: (r) => <Link to={`/admin/support/ticket/${r.id}`} className="text-primary-600 hover:underline">{String(r.ticketId)}</Link> },
          { key: 'kind', label: 'Type', render: (r) => <span className="text-xs">{String(r.kind).replace(/_/g, ' ')}</span> },
          { key: 'subject', label: 'Subject' },
          { key: 'category', label: 'Category', render: (r) => String((r.category as { name?: string })?.name || '-') },
          { key: 'priority', label: 'Priority', render: (r) => <StatusBadge status={r.priority as string} /> },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'assignedTo', label: 'Assigned', render: (r) => String((r.assignedTo as { email?: string })?.email || 'Unassigned') },
          { key: 'createdAt', label: 'Created', render: (r) => formatDate(String(r.createdAt)) },
        ]} rows={rows} />
      )}
    </SupportLayout>
  );
}

function CreateTicketPage() {
  const qc = useQueryClient();
  const { data: cats } = useQuery({ queryKey: ['support-cats'], queryFn: () => api.get('/admin/support/categories') });
  const [form, setForm] = useState({
    subject: '', description: '', kind: 'SUPPORT_REQUEST', categoryId: '', priority: 'MEDIUM',
    complainantType: 'PATIENT', complainantName: '', complainantEmail: '', complainantPhone: '',
  });
  const catList = (cats?.data as { id: string; name: string }[]) || [];

  const create = async () => {
    await api.post('/admin/support/tickets', { ...form, autoRoute: true });
    qc.invalidateQueries({ queryKey: ['support-tickets'] });
    setForm({ subject: '', description: '', kind: 'SUPPORT_REQUEST', categoryId: '', priority: 'MEDIUM', complainantType: 'PATIENT', complainantName: '', complainantEmail: '', complainantPhone: '' });
  };

  return (
    <SupportLayout>
      <div className="card p-6 max-w-2xl">
        <h3 className="font-semibold mb-4">Create Support Ticket</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="SUPPORT_REQUEST">Support Request</option>
            <option value="COMPLAINT">Complaint</option>
          </select>
          <select className="input" value={form.complainantType} onChange={(e) => setForm({ ...form, complainantType: e.target.value })}>
            {['PATIENT', 'HOSPITAL', 'DOCTOR', 'PLATFORM_STAFF', 'GUEST'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="input md:col-span-2" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea className="input md:col-span-2" rows={4} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Auto-detect category</option>
            {catList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input className="input" placeholder="Name" value={form.complainantName} onChange={(e) => setForm({ ...form, complainantName: e.target.value })} />
          <input className="input" placeholder="Email" value={form.complainantEmail} onChange={(e) => setForm({ ...form, complainantEmail: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.complainantPhone} onChange={(e) => setForm({ ...form, complainantPhone: e.target.value })} />
        </div>
        <p className="text-xs text-gray-500 mt-2">Smart routing will auto-detect category, priority, and department from description.</p>
        <button className="btn-primary mt-4" onClick={create} disabled={!form.subject || !form.description}>Create Ticket</button>
      </div>
    </SupportLayout>
  );
}

function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['support-ticket', id], queryFn: () => api.get(`/admin/support/tickets/${id}`), enabled: !!id });
  const { data: staff } = useQuery({ queryKey: ['platform-staff'], queryFn: () => api.get('/admin/platform-staff?limit=100') });
  const { data: canned } = useQuery({ queryKey: ['canned'], queryFn: () => api.get('/admin/support/canned-responses') });
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [assignId, setAssignId] = useState('');
  const [resolution, setResolution] = useState('');

  const ticket = data?.data as Record<string, unknown> | undefined;
  const messages = (ticket?.messages as Record<string, unknown>[]) || [];
  const history = (ticket?.history as Record<string, unknown>[]) || [];
  const staffList = (staff?.data as { user: { id: string; email: string }; fullName: string }[]) || [];
  const cannedList = (canned?.data as { title: string; body: string }[]) || [];

  const refetch = () => qc.invalidateQueries({ queryKey: ['support-ticket', id] });

  if (isLoading) return <SupportLayout><LoadingState /></SupportLayout>;
  if (!ticket) return <SupportLayout><p>Ticket not found</p></SupportLayout>;

  return (
    <SupportLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-bold text-lg">{String(ticket.ticketId)} — {String(ticket.subject)}</h2>
                <div className="flex gap-2 mt-2">
                  <StatusBadge status={ticket.status as string} />
                  <StatusBadge status={ticket.priority as string} />
                  <span className="badge bg-gray-100">{String(ticket.kind).replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">{String(ticket.description)}</p>

            <h4 className="font-medium mb-3">Conversation</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
              {messages.filter((m) => !m.isInternal).map((m) => (
                <div key={String(m.id)} className={cn('p-3 rounded-lg text-sm', m.senderType === 'staff' ? 'bg-primary-50 ml-8' : 'bg-gray-50 mr-8')}>
                  <p className="text-xs text-gray-500 mb-1">{String(m.senderName || m.senderType)} · {formatDate(String(m.createdAt))}</p>
                  <p>{String(m.body)}</p>
                </div>
              ))}
              {messages.length === 0 && <p className="text-gray-400 text-sm">No messages yet</p>}
            </div>

            <div className="border-t pt-4">
              <textarea className="input w-full mb-2" rows={3} placeholder="Reply to customer..." value={reply} onChange={(e) => setReply(e.target.value)} />
              <div className="flex flex-wrap gap-2 mb-2">
                {cannedList.slice(0, 3).map((c) => (
                  <button key={c.title} type="button" className="text-xs bg-gray-100 px-2 py-1 rounded" onClick={() => setReply(c.body)}>{c.title}</button>
                ))}
              </div>
              <button type="button" className="btn-primary text-sm" disabled={!reply} onClick={() => api.post(`/admin/support/tickets/${id}/reply`, { body: reply }).then(refetch).then(() => setReply(''))}>Send Reply</button>
            </div>
          </div>

          <div className="card p-5">
            <h4 className="font-medium mb-3">Internal Notes (not visible to customer)</h4>
            <div className="space-y-2 mb-3">
              {messages.filter((m) => m.isInternal).map((m) => (
                <div key={String(m.id)} className="bg-yellow-50 p-2 rounded text-sm border border-yellow-200">
                  <p className="text-xs text-gray-500">{String(m.senderName)} · {formatDate(String(m.createdAt))}</p>
                  <p>{String(m.body)}</p>
                </div>
              ))}
            </div>
            <textarea className="input w-full mb-2" rows={2} placeholder="Add internal note..." value={internalNote} onChange={(e) => setInternalNote(e.target.value)} />
            <button type="button" className="btn-secondary text-sm" disabled={!internalNote} onClick={() => api.post(`/admin/support/tickets/${id}/internal-note`, { body: internalNote }).then(refetch).then(() => setInternalNote(''))}>Add Note</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5 text-sm space-y-2">
            <p><span className="text-gray-500">User:</span> {String(ticket.complainantName || '-')} ({String(ticket.complainantType)})</p>
            <p><span className="text-gray-500">Email:</span> {String(ticket.complainantEmail || '-')}</p>
            <p><span className="text-gray-500">Category:</span> {String((ticket.category as { name?: string })?.name || '-')}</p>
            <p><span className="text-gray-500">Department:</span> {String(ticket.department || '-')}</p>
            <p><span className="text-gray-500">Created:</span> {formatDate(String(ticket.createdAt))}</p>
            {ticket.slaResponseDue ? <p><span className="text-gray-500">SLA Response Due:</span> {formatDate(String(ticket.slaResponseDue))}</p> : null}
          </div>

          <div className="card p-5">
            <h4 className="font-medium mb-3">Actions</h4>
            <div className="space-y-2">
              <select className="input w-full text-sm" value={assignId} onChange={(e) => setAssignId(e.target.value)}>
                <option value="">Assign to staff...</option>
                {staffList.map((s) => <option key={s.user.id} value={s.user.id}>{s.fullName} ({s.user.email})</option>)}
              </select>
              <button type="button" className="btn-secondary text-sm w-full" disabled={!assignId} onClick={() => api.post(`/admin/support/tickets/${id}/assign`, { assignedToId: assignId }).then(refetch)}>Assign</button>
              <button type="button" className="btn-secondary text-sm w-full" onClick={() => api.post(`/admin/support/tickets/${id}/escalate`, { reason: 'Manual escalation' }).then(refetch)}>Escalate</button>
              <textarea className="input w-full text-sm" rows={2} placeholder="Resolution message..." value={resolution} onChange={(e) => setResolution(e.target.value)} />
              <button type="button" className="btn-primary text-sm w-full" disabled={!resolution} onClick={() => api.post(`/admin/support/tickets/${id}/resolve`, { resolution }).then(refetch)}>Resolve</button>
              <button type="button" className="btn-secondary text-sm w-full" onClick={() => api.post(`/admin/support/tickets/${id}/close`).then(refetch)}>Close</button>
              <button type="button" className="text-red-600 text-sm w-full" onClick={() => api.post(`/admin/support/tickets/${id}/archive`).then(() => window.history.back())}>Archive</button>
            </div>
          </div>

          <div className="card p-5">
            <h4 className="font-medium mb-3">Audit History</h4>
            <ul className="space-y-2 text-xs max-h-60 overflow-y-auto">
              {history.map((h) => (
                <li key={String(h.id)} className="border-b border-gray-50 pb-1">
                  <span className="font-medium">{String(h.action)}</span>
                  {h.fromValue ? <span> {String(h.fromValue)} → {String(h.toValue)}</span> : null}
                  <p className="text-gray-400">{formatDate(String(h.createdAt))} · {String(h.performedByEmail || 'System')}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </SupportLayout>
  );
}

function CategoriesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['support-cats'], queryFn: () => api.get('/admin/support/categories') });
  const [name, setName] = useState('');
  const rows = (data?.data as Record<string, unknown>[]) || [];

  const create = async () => {
    await api.post('/admin/support/categories', { name, slug: name.toLowerCase().replace(/\s+/g, '-'), userTypes: ['PATIENT'] });
    setName('');
    qc.invalidateQueries({ queryKey: ['support-cats'] });
  };

  return (
    <SupportLayout>
      <div className="flex gap-2 mb-4">
        <input className="input max-w-xs" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="btn-primary text-sm" onClick={create} disabled={!name}>Add</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Category' },
          { key: 'department', label: 'Department' },
          { key: 'defaultPriority', label: 'Default Priority' },
          { key: 'tickets', label: 'Tickets', render: (r) => String((r._count as { complaints?: number })?.complaints || 0) },
          { key: 'userTypes', label: 'User Types', render: (r) => ((r.userTypes as string[]) || []).join(', ') },
        ]} rows={rows} />
      )}
    </SupportLayout>
  );
}

function SlaPage() {
  const { data, isLoading } = useQuery({ queryKey: ['support-sla'], queryFn: () => api.get('/admin/support/sla') });
  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <SupportLayout>
      <p className="text-sm text-gray-500 mb-4">Category-wise response and resolution time targets. Critical: 15 min response, 4 hr resolution.</p>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Rule' },
          { key: 'priority', label: 'Priority', render: (r) => <StatusBadge status={r.priority as string} /> },
          { key: 'response', label: 'Response Time', render: (r) => `${r.responseMinutes} min` },
          { key: 'resolution', label: 'Resolution Time', render: (r) => `${Math.round(Number(r.resolutionMinutes) / 60)} hrs` },
        ]} rows={rows} />
      )}
    </SupportLayout>
  );
}

function AssignmentRulesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['assign-rules'], queryFn: () => api.get('/admin/support/assignment-rules') });
  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <SupportLayout>
      <p className="text-sm text-gray-500 mb-4">Auto-assignment rules: Payment → Finance, Technical → Tech Support, etc.</p>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Rule' },
          { key: 'categorySlug', label: 'Category' },
          { key: 'department', label: 'Department' },
          { key: 'defaultPriority', label: 'Priority' },
          { key: 'isActive', label: 'Active', render: (r) => r.isActive ? 'Yes' : 'No' },
        ]} rows={rows} />
      )}
    </SupportLayout>
  );
}

function KnowledgeBasePage() {
  const { data, isLoading } = useQuery({ queryKey: ['kb'], queryFn: () => api.get('/admin/support/knowledge-base') });
  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <SupportLayout>
      <p className="text-sm text-gray-500 mb-4">FAQs and help articles suggested before ticket creation.</p>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'title', label: 'Article' },
          { key: 'category', label: 'Category' },
          { key: 'isPublished', label: 'Published', render: (r) => r.isPublished ? 'Yes' : 'Draft' },
          { key: 'viewCount', label: 'Views' },
        ]} rows={rows} />
      )}
    </SupportLayout>
  );
}

function CannedPage() {
  const { data, isLoading } = useQuery({ queryKey: ['canned'], queryFn: () => api.get('/admin/support/canned-responses') });
  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <SupportLayout>
      {isLoading ? <LoadingState /> : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={String(r.id)} className="card p-4">
              <h4 className="font-medium">{String(r.title)} <span className="text-xs text-gray-400">({String(r.category)})</span></h4>
              <p className="text-sm text-gray-600 mt-1">{String(r.body)}</p>
            </div>
          ))}
        </div>
      )}
    </SupportLayout>
  );
}

function AnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['support-analytics'], queryFn: () => api.get('/admin/support/analytics') });
  const d = data?.data as Record<string, unknown> | undefined;

  if (isLoading) return <SupportLayout><LoadingState /></SupportLayout>;

  return (
    <SupportLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Tickets (Last 7 Days)</h3>
          <div className="space-y-2">
            {((d?.ticketsPerDay as { date: string; count: number }[]) || []).map((day) => (
              <div key={day.date} className="flex justify-between text-sm">
                <span>{day.date}</span>
                <span className="font-medium">{day.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">By Category</h3>
          {((d?.byCategory as { category: string; count: number }[]) || []).map((c) => (
            <div key={c.category} className="flex justify-between text-sm py-1 border-b border-gray-50">
              <span>{c.category}</span><span>{c.count}</span>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">By Status</h3>
          {((d?.byStatus as { status: string; count: number }[]) || []).map((s) => (
            <div key={s.status} className="flex justify-between text-sm py-1"><StatusBadge status={s.status} /><span>{s.count}</span></div>
          ))}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Summary</h3>
          <p className="text-sm">Total: {String(d?.totalTickets)}</p>
          <p className="text-sm">Resolved/Closed: {String(d?.resolutionRate)}</p>
        </div>
      </div>
    </SupportLayout>
  );
}

function PerformancePage() {
  const { data, isLoading } = useQuery({ queryKey: ['support-perf'], queryFn: () => api.get('/admin/support/staff-performance') });
  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <SupportLayout>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'email', label: 'Staff' },
          { key: 'assigned', label: 'Assigned' },
          { key: 'resolved', label: 'Resolved' },
          { key: 'pending', label: 'Pending' },
          { key: 'csat', label: 'CSAT', render: (r) => r.csat ? `${r.csat}/5` : '-' },
        ]} rows={rows} emptyMessage="No staff performance data yet" />
      )}
    </SupportLayout>
  );
}

function CsatPage() {
  const { data, isLoading } = useQuery({ queryKey: ['support-csat'], queryFn: () => api.get('/admin/support/csat') });
  const d = data?.data as Record<string, unknown> | undefined;

  if (isLoading) return <SupportLayout><LoadingState /></SupportLayout>;

  return (
    <SupportLayout>
      <div className="card p-6 max-w-md text-center">
        <p className="text-4xl font-bold text-primary-600">{d?.average ? `${Math.round(Number(d.average) * 10) / 10}/5` : 'N/A'}</p>
        <p className="text-gray-500 mt-2">Average Customer Satisfaction</p>
        <p className="text-sm text-gray-400 mt-1">{String(d?.count || 0)} ratings</p>
        <div className="mt-6 space-y-2">
          {((d?.distribution as { csatRating: number; _count: number }[]) || []).map((r) => (
            <div key={r.csatRating} className="flex justify-between text-sm">
              <span>{'⭐'.repeat(r.csatRating)}</span>
              <span>{r._count}</span>
            </div>
          ))}
        </div>
      </div>
    </SupportLayout>
  );
}

export function AdminSupportPage() {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="tickets" element={<TicketListPage />} />
      <Route path="create" element={<CreateTicketPage />} />
      <Route path="ticket/:id" element={<TicketDetailPage />} />
      <Route path="new" element={<TicketListPage filter="&status=NEW" title="New Tickets" />} />
      <Route path="open" element={<TicketListPage filter="&status=OPEN" title="Open Tickets" />} />
      <Route path="in-progress" element={<TicketListPage filter="&status=IN_PROGRESS" title="In Progress" />} />
      <Route path="waiting" element={<TicketListPage filter="&status=WAITING_FOR_USER" title="Waiting for User" />} />
      <Route path="resolved" element={<TicketListPage filter="&status=RESOLVED" title="Resolved" />} />
      <Route path="closed" element={<TicketListPage filter="&status=CLOSED" title="Closed" />} />
      <Route path="escalated" element={<TicketListPage filter="&status=ESCALATED" title="Escalated" />} />
      <Route path="complaints" element={<TicketListPage kind="COMPLAINT" title="Complaints" />} />
      <Route path="requests" element={<TicketListPage kind="SUPPORT_REQUEST" title="Support Requests" />} />
      <Route path="categories" element={<CategoriesPage />} />
      <Route path="sla" element={<SlaPage />} />
      <Route path="assignment-rules" element={<AssignmentRulesPage />} />
      <Route path="knowledge-base" element={<KnowledgeBasePage />} />
      <Route path="canned" element={<CannedPage />} />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="performance" element={<PerformancePage />} />
      <Route path="csat" element={<CsatPage />} />
      <Route path="*" element={<Navigate to="/admin/support" replace />} />
    </Routes>
  );
}
