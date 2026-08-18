import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api, apiBaseUrl } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const LM_BASE = '/admin/lead-management';

const LEAD_STATUSES = [
  'NEW', 'CONTACTED', 'INTERESTED', 'QUALIFIED', 'FOLLOW_UP', 'APPOINTMENT_BOOKED',
  'VISITED', 'TREATMENT_STARTED', 'CONVERTED', 'NOT_INTERESTED', 'WRONG_NUMBER', 'DUPLICATE', 'LOST', 'INVALID',
];

const LEAD_TYPES = ['PATIENT', 'HOSPITAL', 'CLINIC', 'DOCTOR', 'REFERRAL', 'ADVERTISEMENT', 'PARTNER'];
const LEAD_SOURCES = [
  'WEBSITE', 'MOBILE_APP', 'GOOGLE', 'SOCIAL_MEDIA', 'ADVERTISEMENT', 'REFERRAL', 'AASHA',
  'HOSPITAL', 'CLINIC', 'DOCTOR', 'PARTNER', 'CALL', 'WHATSAPP', 'EMAIL', 'MANUAL_ENTRY', 'API',
];

function tempBadge(temp: string) {
  const colors: Record<string, string> = { HOT: 'text-red-600', WARM: 'text-yellow-600', COLD: 'text-blue-600' };
  return <span className={`text-xs font-semibold ${colors[temp] || ''}`}>{temp}</span>;
}

export function LeadManagementDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['lm-dashboard'],
    queryFn: () => api.get('/admin/leads/dashboard'),
  });
  const stats = data?.data as Record<string, unknown> | undefined;
  const funnel = stats?.funnel as Record<string, number> | undefined;

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Lead Management"
        subtitle="Capture, assign, follow-up, convert — acquisition to revenue funnel"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`${LM_BASE}/leads`} className="btn-primary text-sm">All Leads</Link>
            <Link to={`${LM_BASE}/follow-ups`} className="btn-secondary text-sm">Today's Follow-ups</Link>
            <Link to={`${LM_BASE}/unassigned`} className="btn-secondary text-sm">Unassigned</Link>
            <a href={`${apiBaseUrl}/admin/leads/export`} className="btn-secondary text-sm" target="_blank" rel="noreferrer">Export CSV</a>
          </div>
        }
      />
      {isLoading ? <LoadingState /> : stats && (
        <>
          <StatGrid stats={[
            { label: 'Total Leads', value: Number(stats.totalLeads || 0) },
            { label: 'New Leads', value: Number(stats.newLeads || 0) },
            { label: "Today's Leads", value: Number(stats.todayLeads || 0) },
            { label: 'Contacted', value: Number(stats.contactedLeads || 0) },
            { label: 'Follow-up Pending', value: Number(stats.followUpPending || 0) },
            { label: 'Qualified', value: Number(stats.qualifiedLeads || 0) },
            { label: 'Converted', value: Number(stats.convertedLeads || 0) },
            { label: 'Lost', value: Number(stats.lostLeads || 0) },
            { label: 'Duplicates', value: Number(stats.duplicateLeads || 0) },
            { label: 'Hot Leads', value: Number(stats.hotLeads || 0) },
            { label: 'Warm Leads', value: Number(stats.warmLeads || 0) },
            { label: 'Cold Leads', value: Number(stats.coldLeads || 0) },
            { label: 'Referral Leads', value: Number(stats.referralLeads || 0) },
            { label: 'Ad Leads', value: Number(stats.advertisementLeads || 0) },
            { label: 'Website Leads', value: Number(stats.websiteLeads || 0) },
            { label: 'Google Leads', value: Number(stats.googleLeads || 0) },
            { label: 'Hospital Leads', value: Number(stats.hospitalLeads || 0) },
            { label: 'Clinic Leads', value: Number(stats.clinicLeads || 0) },
            { label: 'Doctor Leads', value: Number(stats.doctorLeads || 0) },
            { label: 'Unassigned', value: Number(stats.unassignedLeads || 0) },
          ]} />

          {funnel && (
            <div className="mt-8 card p-6">
              <h3 className="font-semibold mb-4">Conversion Funnel</h3>
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                {[
                  { label: 'Leads', value: funnel.leads },
                  { label: 'Contacted', value: funnel.contacted },
                  { label: 'Qualified', value: funnel.qualified },
                  { label: 'Appointments', value: funnel.appointments },
                  { label: 'Visited', value: funnel.visited },
                  { label: 'Treatment', value: funnel.treatment },
                  { label: 'Converted', value: funnel.converted },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
                      <p className="text-lg font-bold">{step.value ?? 0}</p>
                      <p className="text-xs text-gray-500">{step.label}</p>
                    </div>
                    {i < arr.length - 1 && <span className="text-gray-400">→</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="font-semibold mb-4">By Source</h3>
              <div className="space-y-2">
                {((stats.bySource as { source: string; count: number }[]) || []).map((s) => (
                  <div key={s.source} className="flex justify-between text-sm">
                    <span>{s.source.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-6">
              <h3 className="font-semibold mb-4">By Type</h3>
              <div className="space-y-2">
                {((stats.byType as { type: string; count: number }[]) || []).map((t) => (
                  <div key={t.type} className="flex justify-between text-sm">
                    <span>{t.type.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{t.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

interface LeadListProps {
  presetStatus?: string;
  presetTemperature?: string;
  unassignedOnly?: boolean;
  title?: string;
}

export function LeadManagementListPage({ presetStatus, presetTemperature, unassignedOnly, title }: LeadListProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(presetStatus || '');
  const [type, setType] = useState('');
  const [source, setSource] = useState('');
  const [temperature, setTemperature] = useState(presetTemperature || '');

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  if (source) params.set('source', source);
  if (temperature) params.set('temperature', temperature);
  if (unassignedOnly) params.set('unassigned', 'true');
  params.set('limit', '50');

  const { data, isLoading } = useQuery({
    queryKey: ['lm-leads', params.toString()],
    queryFn: () => api.get(`/admin/leads?${params.toString()}`),
  });

  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={title || 'All Leads'}
        subtitle="Platform-wide lead registry"
        actions={<Link to={LM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <input className="input text-sm" placeholder="Lead ID, name, phone, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input text-sm w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input text-sm w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          {LEAD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input text-sm w-auto" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All Sources</option>
          {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input text-sm w-auto" value={temperature} onChange={(e) => setTemperature(e.target.value)}>
          <option value="">All Temperature</option>
          <option value="HOT">Hot</option>
          <option value="WARM">Warm</option>
          <option value="COLD">Cold</option>
        </select>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable
          columns={[
            { key: 'leadId', label: 'Lead', render: (r) => (
              <div>
                <p className="font-mono text-xs font-medium">{String(r.leadNumber)}</p>
                <p className="font-medium">{String(r.name)}</p>
              </div>
            )},
            { key: 'type', label: 'Type', render: (r) => String(r.type).replace(/_/g, ' ') },
            { key: 'source', label: 'Source', render: (r) => String(r.source).replace(/_/g, ' ') },
            { key: 'assigned', label: 'Assigned To', render: (r) => String((r.assignedTo as { email?: string })?.email || '—') },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
            { key: 'priority', label: 'Priority', render: (r) => (
              <div className="flex flex-col gap-0.5">
                <StatusBadge status={String(r.priority)} />
                {tempBadge(String(r.temperature))}
              </div>
            )},
            { key: 'contact', label: 'Last Contact', render: (r) => r.lastContactAt ? formatDate(r.lastContactAt as string) : '—' },
            { key: 'actions', label: 'Action', render: (r) => (
              <Link to={`${LM_BASE}/leads/${r.id}`} className="text-xs text-primary-600 font-medium">Manage</Link>
            )},
          ]}
          rows={rows}
          emptyMessage="No leads found"
        />
      )}
    </DashboardLayout>
  );
}

export function LeadManagementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['lm-lead', id],
    queryFn: () => api.get(`/admin/leads/${id}`),
    enabled: Boolean(id),
  });

  const overview = data?.data as {
    lead: Record<string, unknown>;
    auditLogs: Record<string, unknown>[];
  } | undefined;

  const lead = overview?.lead;
  const activities = (lead?.activities as Record<string, unknown>[]) || [];
  const followUps = (lead?.followUps as Record<string, unknown>[]) || [];
  const org = lead?.organization as Record<string, unknown> | undefined;

  if (isLoading) return <DashboardLayout portal="admin"><LoadingState /></DashboardLayout>;
  if (!lead) return <DashboardLayout portal="admin"><p>Lead not found</p></DashboardLayout>;

  const updateStatus = async (status: string) => {
    await api.patch(`/admin/leads/${id}/status`, { status });
    qc.invalidateQueries({ queryKey: ['lm-lead', id] });
  };

  const addNote = async () => {
    const note = prompt('Add note:');
    if (!note) return;
    await api.post(`/admin/leads/${id}/notes`, { notes: note });
    qc.invalidateQueries({ queryKey: ['lm-lead', id] });
  };

  const scheduleFollowUp = async () => {
    const date = prompt('Follow-up date (YYYY-MM-DD HH:MM):');
    const reason = prompt('Reason:');
    if (!date || !reason) return;
    await api.post(`/admin/leads/${id}/follow-up`, { scheduledAt: new Date(date).toISOString(), reason });
    qc.invalidateQueries({ queryKey: ['lm-lead', id] });
  };

  const convertLead = async () => {
    if (!confirm('Convert this lead to patient?')) return;
    await api.post(`/admin/leads/${id}/convert`, {});
    qc.invalidateQueries({ queryKey: ['lm-lead', id] });
  };

  const markLost = async () => {
    const reason = prompt('Lost reason:');
    if (!reason) return;
    await api.post(`/admin/leads/${id}/lost`, { lostReason: reason });
    qc.invalidateQueries({ queryKey: ['lm-lead', id] });
  };

  const assignLead = async () => {
    const staffId = prompt('Staff user ID (UUID):');
    if (!staffId) return;
    await api.post(`/admin/leads/${id}/assign`, { assignedToId: staffId });
    qc.invalidateQueries({ queryKey: ['lm-lead', id] });
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={String(lead.leadNumber)}
        subtitle={`${String(lead.name)} · ${String(lead.type).replace(/_/g, ' ')}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => navigate(`${LM_BASE}/leads`)}>← Back</button>
            <ActionBtn onClick={assignLead}>Assign</ActionBtn>
            <ActionBtn onClick={addNote}>Add Note</ActionBtn>
            <ActionBtn onClick={scheduleFollowUp}>Schedule Follow-up</ActionBtn>
            {lead.status !== 'CONVERTED' && <ActionBtn onClick={convertLead}>Convert</ActionBtn>}
            {!['LOST', 'CONVERTED'].includes(String(lead.status)) && (
              <ActionBtn variant="danger" onClick={markLost}>Mark Lost</ActionBtn>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Contact</h3>
          <p className="font-medium">{String(lead.name)}</p>
          <p className="text-sm text-gray-500">{String(lead.phone || '—')}</p>
          <p className="text-sm text-gray-500">{String(lead.email || '—')}</p>
          <p className="text-sm text-gray-500 mt-2">{String(lead.city || '')}{lead.state ? `, ${String(lead.state)}` : ''}</p>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Source & Campaign</h3>
          <p className="text-sm"><span className="text-gray-500">Source:</span> {String(lead.source).replace(/_/g, ' ')}</p>
          {Boolean(lead.campaign) && <p className="text-sm"><span className="text-gray-500">Campaign:</span> {String(lead.campaign)}</p>}
          {Boolean(lead.referralName) && <p className="text-sm"><span className="text-gray-500">Referral:</span> {String(lead.referralName)}</p>}
          {Boolean(lead.referralType) && <p className="text-sm"><span className="text-gray-500">Type:</span> {String(lead.referralType)}</p>}
          {Boolean(org) && <p className="text-sm mt-2"><span className="text-gray-500">Hospital:</span> {String(org?.name)}</p>}
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Status & Score</h3>
          <StatusBadge status={String(lead.status)} />
          <div className="mt-2 flex gap-3 text-sm">
            <span>Score: <strong>{Number(lead.score)}</strong></span>
            {tempBadge(String(lead.temperature))}
          </div>
          <p className="text-sm text-gray-500 mt-2">Assigned: {String((lead.assignedTo as { email?: string })?.email || 'Unassigned')}</p>
          {Boolean(lead.nextFollowUpAt) && (
            <p className="text-sm text-orange-600 mt-1">Next follow-up: {formatDate(lead.nextFollowUpAt as string)}</p>
          )}
        </div>
      </div>

      <div className="card p-6 mb-8">
        <h3 className="font-semibold mb-4">Update Status</h3>
        <div className="flex flex-wrap gap-2">
          {LEAD_STATUSES.filter((s) => s !== lead.status).slice(0, 8).map((s) => (
            <button key={s} type="button" className="btn-secondary text-xs" onClick={() => updateStatus(s)}>
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Activity Timeline</h3>
          {activities.length === 0 ? <p className="text-sm text-gray-500">No activity yet</p> : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={String(a.id)} className="border-l-2 border-primary-200 pl-3 text-sm">
                  <p className="font-medium">{String(a.action).replace(/_/g, ' ')}</p>
                  {Boolean(a.notes) && <p className="text-gray-600">{String(a.notes)}</p>}
                  <p className="text-xs text-gray-400">
                    {(a.user as { email?: string })?.email} · {formatDate(a.createdAt as string)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Follow-ups</h3>
          {followUps.length === 0 ? <p className="text-sm text-gray-500">No follow-ups scheduled</p> : (
            <div className="space-y-3">
              {followUps.map((f) => (
                <div key={String(f.id)} className="flex justify-between items-start text-sm border-b pb-2">
                  <div>
                    <p className="font-medium">{formatDate(f.scheduledAt as string)}</p>
                    <p className="text-gray-500">{String(f.reason)}</p>
                    <StatusBadge status={String(f.status)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {Boolean(lead.notes) && (
        <div className="card p-6">
          <h3 className="font-semibold mb-2">Notes</h3>
          <p className="text-sm whitespace-pre-wrap">{String(lead.notes)}</p>
        </div>
      )}
    </DashboardLayout>
  );
}

export function LeadFollowUpsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['lm-follow-ups-today'],
    queryFn: () => api.get('/admin/leads/follow-ups/today'),
  });
  const followUps = (data?.data as Record<string, unknown>[]) || [];

  const complete = async (followUpId: string) => {
    const notes = prompt('Completion notes (optional):');
    await api.post(`/admin/leads/follow-ups/${followUpId}/complete`, { notes: notes || undefined });
    qc.invalidateQueries({ queryKey: ['lm-follow-ups-today'] });
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Today's Follow-ups"
        subtitle="Scheduled follow-up tasks for today"
        actions={<Link to={LM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      {isLoading ? <LoadingState /> : followUps.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No follow-ups scheduled for today</div>
      ) : (
        <AdminTable
          columns={[
            { key: 'time', label: 'Time', render: (r) => {
              const d = new Date(r.scheduledAt as string);
              return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
            }},
            { key: 'lead', label: 'Lead', render: (r) => {
              const l = r.lead as { leadNumber?: string; name?: string; phone?: string };
              return (
                <div>
                  <p className="font-mono text-xs">{l?.leadNumber}</p>
                  <p className="font-medium">{l?.name}</p>
                  <p className="text-xs text-gray-500">{l?.phone}</p>
                </div>
              );
            }},
            { key: 'reason', label: 'Reason', render: (r) => String(r.reason) },
            { key: 'assigned', label: 'Assigned', render: (r) => String((r.assignedTo as { email?: string })?.email || '—') },
            { key: 'actions', label: 'Actions', render: (r) => (
              <div className="flex gap-2">
                <Link to={`${LM_BASE}/leads/${(r.lead as { id?: string })?.id}`} className="text-xs text-primary-600">View</Link>
                <ActionBtn onClick={() => complete(String(r.id))}>Complete</ActionBtn>
              </div>
            )},
          ]}
          rows={followUps}
        />
      )}
    </DashboardLayout>
  );
}
