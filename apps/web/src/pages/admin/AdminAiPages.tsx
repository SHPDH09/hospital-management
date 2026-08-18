import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Settings, Zap, FileText, Send, Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const subNav = [
  { to: '/admin/ai/copilot', label: 'Copilot', icon: Bot },
  { to: '/admin/ai/automation', label: 'Automations', icon: Zap },
  { to: '/admin/ai/settings', label: 'AI Settings', icon: Settings },
  { to: '/admin/ai/audit', label: 'AI Audit Logs', icon: FileText },
];

function AiSubNav() {
  const { pathname } = useLocation();
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {subNav.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} className={cn('btn-secondary text-sm flex items-center gap-2', pathname === to && 'ring-2 ring-primary-500')}>
          <Icon className="h-4 w-4" /> {label}
        </Link>
      ))}
    </div>
  );
}

export function AdminAiCopilotPage() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const { data: summary } = useQuery({ queryKey: ['ai-summary'], queryFn: () => api.get<{ summary: string }>('/ai/summary') });

  const ask = useMutation({
    mutationFn: (q: string) => api.post<{ answer: string; fromAi: boolean }>('/ai/copilot', { query: q }),
    onSuccess: (res, q) => {
      setMessages((m) => [
        ...m,
        { role: 'user', text: q },
        { role: 'assistant', text: res.data?.answer || 'No response.' },
      ]);
      setQuery('');
    },
  });

  const suggestions = [
    "Show me today's platform summary",
    'Show failed payments today',
    'Show pending hospital verification',
    'Which hospitals have the most appointments?',
    'Show subscriptions expiring this week',
  ];

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="AI Admin Copilot" subtitle="Query real platform data — never hallucinated stats" />
      <AiSubNav />

      {summary?.data?.summary && (
        <div className="card p-4 mb-4 bg-primary-50 border border-primary-100">
          <p className="text-sm font-medium text-primary-800 mb-1">Today's Summary</p>
          <pre className="text-sm whitespace-pre-wrap text-gray-700">{summary.data.summary}</pre>
        </div>
      )}

      <div className="card p-4 mb-4 min-h-[320px] flex flex-col">
        <div className="flex-1 space-y-3 mb-4 overflow-y-auto max-h-96">
          {messages.length === 0 && (
            <p className="text-sm text-gray-500">Ask about platform operations. Medical diagnosis questions will receive a safety disclaimer.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn('rounded-lg p-3 text-sm max-w-[85%]', m.role === 'user' ? 'bg-primary-100 ml-auto' : 'bg-gray-100')}>
              {m.text}
            </div>
          ))}
          {ask.isPending && <div className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Thinking...</div>}
        </div>
        <div className="flex gap-2 flex-wrap mb-3">
          {suggestions.map((s) => (
            <button key={s} type="button" className="text-xs btn-ghost border" onClick={() => ask.mutate(s)}>{s}</button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (query.trim()) ask.mutate(query.trim()); }}>
          <input className="input flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask: Show me today's platform summary..." />
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={ask.isPending}><Send className="h-4 w-4" /> Ask</button>
        </form>
      </div>
    </DashboardLayout>
  );
}

export function AdminAutomationPage() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ['automation-rules'], queryFn: () => api.get('/automation/rules') });
  const { data: jobStats } = useQuery({ queryKey: ['job-stats'], queryFn: () => api.get('/automation/jobs/stats') });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', trigger: 'appointment.created', module: 'GENERAL', channel: 'push', isActive: true });

  const create = useMutation({
    mutationFn: () => api.post('/automation/rules', {
      ...form,
      conditions: [],
      actions: [{ type: 'alert_admin', title: form.name, message: `Automation: ${form.name}` }],
    }),
    onSuccess: () => { setShowForm(false); refetch(); },
  });

  const toggle = (id: string, isActive: boolean) => api.patch(`/automation/rules/${id}`, { isActive: !isActive }).then(() => refetch());
  const seed = () => api.post('/automation/seed-defaults', {}).then(() => refetch());

  const stats = jobStats?.data as { pending?: number; dead?: number } | undefined;

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Automation Management" subtitle="IF condition THEN action rules" actions={<button type="button" className="btn-primary" onClick={() => setShowForm(true)}>New Automation</button>} />
      <AiSubNav />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card p-4"><p className="text-xs text-gray-500">Pending Jobs</p><p className="text-2xl font-bold">{stats?.pending ?? 0}</p></div>
        <div className="card p-4"><p className="text-xs text-gray-500">Dead Letter</p><p className="text-2xl font-bold text-red-600">{stats?.dead ?? 0}</p></div>
      </div>

      <div className="mb-4"><ActionBtn onClick={seed}>Seed Default Automations</ActionBtn></div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card p-6 w-full max-w-md space-y-3">
            <h3 className="font-semibold">New Automation</h3>
            <input className="input w-full" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input w-full" placeholder="Trigger (e.g. appointment.created)" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} />
            <input className="input w-full" placeholder="Channel (push,email,sms)" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => create.mutate()} disabled={!form.name}>Create</button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Name' },
          { key: 'module', label: 'Module' },
          { key: 'trigger', label: 'Trigger' },
          { key: 'channel', label: 'Channel' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'SUSPENDED'} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <ActionBtn onClick={() => toggle(r.id as string, r.isActive as boolean)}>{r.isActive ? 'Disable' : 'Enable'}</ActionBtn>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}

export function AdminAiSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['ai-settings'], queryFn: () => api.get('/ai/settings') });
  const [form, setForm] = useState<Record<string, unknown>>({});

  const settings = data?.data as Record<string, unknown> | undefined;
  const current = { ...settings, ...form };

  const save = useMutation({
    mutationFn: () => api.put('/ai/settings', {
      enabled: current.enabled,
      provider: current.provider,
      model: current.model,
      maxTokens: current.maxTokens,
      temperature: current.temperature,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
  });

  if (isLoading) return <DashboardLayout portal="admin"><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="AI Settings" subtitle="Configure provider, limits, and feature flags" />
      <AiSubNav />
      <div className="card p-6 max-w-xl space-y-4">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={Boolean(current.enabled)} onChange={(e) => setForm({ enabled: e.target.checked })} />
          Enable AI
        </label>
        <div>
          <label className="text-sm text-gray-600">Provider</label>
          <select className="input w-full" value={String(current.provider || 'none')} onChange={(e) => setForm({ provider: e.target.value })}>
            <option value="none">None (rule-based only)</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600">Model</label>
          <input className="input w-full" value={String(current.model || '')} onChange={(e) => setForm({ model: e.target.value })} />
        </div>
        <p className="text-xs text-gray-500">
          API keys are configured via server environment variables (OPENAI_API_KEY, GEMINI_API_KEY). Never exposed to the browser.
        </p>
        <p className="text-xs text-gray-500">
          OpenAI key: {settings?.hasOpenAiKey ? 'configured' : 'not set'} · Gemini key: {settings?.hasGeminiKey ? 'configured' : 'not set'}
        </p>
        <button type="button" className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>Save Settings</button>
      </div>
    </DashboardLayout>
  );
}

export function AdminAiAuditPage() {
  const { data, isLoading } = useQuery({ queryKey: ['ai-audit'], queryFn: () => api.get('/ai/audit-logs') });
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="AI Audit Logs" subtitle="All AI operations are logged here" />
      <AiSubNav />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'createdAt', label: 'Time', render: (r) => new Date(r.createdAt as string).toLocaleString() },
          { key: 'module', label: 'Module' },
          { key: 'feature', label: 'Feature' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status === 'success' ? 'ACTIVE' : 'SUSPENDED'} /> },
          { key: 'model', label: 'Model' },
          { key: 'outputSummary', label: 'Output', render: (r) => <span className="max-w-xs truncate block text-xs">{String(r.outputSummary || '-')}</span> },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </DashboardLayout>
  );
}
