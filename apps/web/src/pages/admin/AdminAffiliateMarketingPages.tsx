import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import {
  MessageCircle, Facebook, Instagram, Users, Send, Download, Plus,
  CheckCircle2, XCircle, Loader2, Settings, Megaphone,
} from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, LoadingState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

const subNav = [
  { to: '/admin/affiliate-marketing', label: 'Dashboard', end: true },
  { to: '/admin/affiliate-marketing/whatsapp', label: 'WhatsApp' },
  { to: '/admin/affiliate-marketing/groups', label: 'Groups & Export' },
  { to: '/admin/affiliate-marketing/bulk-send', label: 'Bulk Messages' },
  { to: '/admin/affiliate-marketing/facebook', label: 'Facebook' },
  { to: '/admin/affiliate-marketing/instagram', label: 'Instagram' },
  { to: '/admin/affiliate-marketing/settings', label: 'Settings' },
];

function AffLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Affiliate Marketing"
        subtitle="Connect WhatsApp, Facebook & Instagram — export groups, create groups, and send bulk campaigns"
      />
      <nav className="flex flex-wrap gap-1 mb-6 border-b border-gray-200 pb-2">
        {subNav.map((item) => {
          const active = item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
          return (
            <Link key={item.to} to={item.to}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600 hover:bg-gray-50')}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </DashboardLayout>
  );
}

interface WhatsAppStatus {
  status: 'disconnected' | 'connecting' | 'qr' | 'connected';
  qrDataUrl?: string;
  phone?: string;
  name?: string;
  lastError?: string;
}

interface SocialStatus {
  status: 'disconnected' | 'connected';
  accountName?: string;
  accountId?: string;
  profilePicture?: string;
  connectedAt?: string;
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
      ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['affiliate-dashboard'],
    queryFn: () => api.get('/admin/affiliate-marketing/dashboard'),
  });
  const d = data?.data as {
    whatsapp?: WhatsAppStatus;
    facebook?: SocialStatus;
    instagram?: SocialStatus;
    recentCampaigns?: Record<string, unknown>[];
    connectedChannels?: string[];
  } | undefined;

  if (isLoading) return <AffLayout><LoadingState /></AffLayout>;

  return (
    <AffLayout>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-8">
        {[
          { icon: MessageCircle, label: 'WhatsApp', ok: d?.whatsapp?.status === 'connected', detail: d?.whatsapp?.phone || 'Not connected' },
          { icon: Facebook, label: 'Facebook', ok: d?.facebook?.status === 'connected', detail: d?.facebook?.accountName || 'Not connected' },
          { icon: Instagram, label: 'Instagram', ok: d?.instagram?.status === 'connected', detail: d?.instagram?.accountName || 'Not connected' },
        ].map((c) => (
          <div key={c.label} className="card p-5">
            <div className="flex items-center justify-between">
              <c.icon className={cn('h-8 w-8', c.ok ? 'text-emerald-600' : 'text-gray-400')} />
              <StatusPill ok={c.ok} label={c.ok ? 'Connected' : 'Disconnected'} />
            </div>
            <p className="mt-3 font-semibold text-gray-900">{c.label}</p>
            <p className="text-sm text-gray-500">{c.detail}</p>
          </div>
        ))}
      </div>

      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/admin/affiliate-marketing/whatsapp" className="btn-primary text-sm">Connect WhatsApp</Link>
          <Link to="/admin/affiliate-marketing/groups" className="btn-secondary text-sm">Export Group Numbers</Link>
          <Link to="/admin/affiliate-marketing/bulk-send" className="btn-secondary text-sm">Send Bulk Message</Link>
        </div>
      </div>

      {d?.recentCampaigns?.length ? (
        <div className="card p-6 mt-6">
          <h3 className="font-semibold mb-4">Recent Campaigns</h3>
          <AdminTable columns={[
            { key: 'title', label: 'Title' },
            { key: 'status', label: 'Status' },
            { key: 'sentCount', label: 'Sent' },
            { key: 'failedCount', label: 'Failed' },
            { key: 'createdAt', label: 'Date', render: (r) => formatDate(String(r.createdAt)) },
          ]} rows={d.recentCampaigns} />
        </div>
      ) : null}
    </AffLayout>
  );
}

function WhatsAppPage() {
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [notice, setNotice] = useState('');

  const { data, refetch, isLoading } = useQuery({
    queryKey: ['affiliate-whatsapp-status'],
    queryFn: () => api.get<WhatsAppStatus>('/admin/affiliate-marketing/whatsapp/status'),
    refetchInterval: (q) => {
      const status = (q.state.data?.data as WhatsAppStatus | undefined)?.status;
      return status === 'qr' || status === 'connecting' ? 2000 : false;
    },
  });

  const status = data?.data as WhatsAppStatus | undefined;

  const connect = async () => {
    setConnecting(true);
    setNotice('');
    const res = await api.post<WhatsAppStatus>('/admin/affiliate-marketing/whatsapp/connect');
    setConnecting(false);
    if (!res.success) {
      setNotice(res.error || 'Failed to start connection');
      return;
    }
    qc.invalidateQueries({ queryKey: ['affiliate-whatsapp-status'] });
    refetch();
  };

  const disconnect = async () => {
    await api.post('/admin/affiliate-marketing/whatsapp/disconnect');
    qc.invalidateQueries({ queryKey: ['affiliate-whatsapp-status'] });
    refetch();
  };

  if (isLoading) return <AffLayout><LoadingState /></AffLayout>;

  return (
    <AffLayout>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-green-100">
              <MessageCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">WhatsApp Web Connection</h3>
              <p className="text-sm text-gray-500">Scan QR with your phone to link WhatsApp</p>
            </div>
          </div>

          <div className="mb-4">
            <StatusPill
              ok={status?.status === 'connected'}
              label={status?.status === 'connected' ? `Connected · ${status.phone || ''}` : (status?.status || 'disconnected').toUpperCase()}
            />
          </div>

          {status?.status === 'connected' && (
            <div className="rounded-xl bg-green-50 border border-green-100 p-4 mb-4 text-sm text-green-800">
              <p className="font-medium">{status.name || 'WhatsApp Account'}</p>
              <p>+{status.phone}</p>
            </div>
          )}

          {status?.status === 'qr' && status.qrDataUrl && (
            <div className="flex flex-col items-center rounded-xl border border-gray-200 bg-white p-6 mb-4">
              <img src={status.qrDataUrl} alt="WhatsApp QR Code" className="h-64 w-64 rounded-lg" />
              <p className="mt-4 text-sm text-gray-600 text-center">
                Open WhatsApp → Linked Devices → Link a Device → Scan this QR code
              </p>
            </div>
          )}

          {(status?.status === 'connecting' || connecting) && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Generating QR code…
            </div>
          )}

          {notice && <p className="text-sm text-red-600 mb-4">{notice}</p>}
          {status?.lastError && <p className="text-sm text-amber-700 mb-4">{status.lastError}</p>}

          <div className="flex gap-3">
            {status?.status === 'connected' ? (
              <button type="button" className="btn-secondary text-sm" onClick={disconnect}>Disconnect</button>
            ) : (
              <button type="button" className="btn-primary text-sm" onClick={connect} disabled={connecting || status?.status === 'qr'}>
                {status?.status === 'qr' ? 'Waiting for scan…' : 'Generate QR & Connect'}
              </button>
            )}
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100">
          <h4 className="font-semibold text-emerald-900 mb-3">What you can do after connecting</h4>
          <ul className="space-y-2 text-sm text-emerald-800">
            <li className="flex items-start gap-2"><Users className="h-4 w-4 mt-0.5 shrink-0" /> Export phone numbers from any WhatsApp group</li>
            <li className="flex items-start gap-2"><Plus className="h-4 w-4 mt-0.5 shrink-0" /> Create new groups from bulk phone numbers</li>
            <li className="flex items-start gap-2"><Send className="h-4 w-4 mt-0.5 shrink-0" /> Send bulk WhatsApp messages to your contacts</li>
          </ul>
          {status?.status === 'connected' && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/admin/affiliate-marketing/groups" className="btn-primary text-xs">Go to Groups</Link>
              <Link to="/admin/affiliate-marketing/bulk-send" className="btn-secondary text-xs">Bulk Send</Link>
            </div>
          )}
        </div>
      </div>
    </AffLayout>
  );
}

function GroupsPage() {
  const [selectedGroup, setSelectedGroup] = useState('');
  const [exportData, setExportData] = useState<{ count: number; csv: string; participants: { phone: string; name?: string }[] } | null>(null);
  const [groupName, setGroupName] = useState('');
  const [bulkPhones, setBulkPhones] = useState('');
  const [notice, setNotice] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['affiliate-whatsapp-groups'],
    queryFn: () => api.get('/admin/affiliate-marketing/whatsapp/groups'),
    retry: false,
  });

  const groups = (data?.data as { id: string; name: string; participantCount: number }[]) || [];

  const exportGroup = async () => {
    if (!selectedGroup) return;
    setNotice('');
    const res = await api.get<{ count: number; csv: string; participants: { phone: string; name?: string }[] }>(
      `/admin/affiliate-marketing/whatsapp/groups/${encodeURIComponent(selectedGroup)}/export`,
    );
    if (!res.success) {
      setNotice(res.error || 'Export failed. Connect WhatsApp first.');
      return;
    }
    setExportData(res.data || null);
  };

  const downloadCsv = () => {
    if (!exportData?.csv) return;
    const blob = new Blob([exportData.csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `whatsapp-group-${selectedGroup}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createGroup = async () => {
    setNotice('');
    const res = await api.post('/admin/affiliate-marketing/whatsapp/groups/create', {
      name: groupName,
      phones: bulkPhones,
    });
    if (!res.success) {
      setNotice(res.error || 'Failed to create group');
      return;
    }
    setNotice(`Group "${groupName}" created with ${(res.data as { added: number })?.added || 0} members.`);
    setGroupName('');
    setBulkPhones('');
    refetch();
  };

  return (
    <AffLayout>
      {notice && <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{notice}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Download className="h-5 w-5 text-emerald-600" /> Export Group Numbers
          </h3>
          {isLoading ? <LoadingState /> : (
            <>
              <select className="input w-full mb-3" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
                <option value="">Select a WhatsApp group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.participantCount} members)</option>
                ))}
              </select>
              <button type="button" className="btn-primary text-sm" onClick={exportGroup} disabled={!selectedGroup}>
                Export Numbers
              </button>
              {exportData && (
                <div className="mt-4 rounded-xl bg-gray-50 p-4">
                  <p className="text-sm font-medium">{exportData.count} numbers exported</p>
                  <button type="button" className="btn-secondary text-xs mt-2" onClick={downloadCsv}>Download CSV</button>
                  <div className="mt-3 max-h-40 overflow-auto text-xs font-mono text-gray-600">
                    {exportData.participants.slice(0, 20).map((p) => <div key={p.phone}>+{p.phone}</div>)}
                    {exportData.participants.length > 20 && <div>…and {exportData.participants.length - 20} more</div>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-semibold flex items-center gap-2 mb-4">
            <Plus className="h-5 w-5 text-emerald-600" /> Create Group from Bulk Numbers
          </h3>
          <input className="input w-full mb-3" placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <textarea className="input w-full mb-3" rows={6}
            placeholder="Phone numbers (one per line or comma-separated)&#10;9876543210&#10;9123456789"
            value={bulkPhones} onChange={(e) => setBulkPhones(e.target.value)} />
          <button type="button" className="btn-primary text-sm" onClick={createGroup} disabled={!groupName || !bulkPhones.trim()}>
            Create WhatsApp Group
          </button>
        </div>
      </div>
    </AffLayout>
  );
}

function BulkSendPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [phones, setPhones] = useState('');
  const [delayMs, setDelayMs] = useState(2000);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sentCount: number; failedCount: number } | null>(null);

  const send = async () => {
    setSending(true);
    setResult(null);
    const res = await api.post<{ sentCount: number; failedCount: number }>('/admin/affiliate-marketing/whatsapp/bulk-send', {
      title, message, phones, delayMs,
    });
    setSending(false);
    if (res.success && res.data) setResult(res.data);
  };

  return (
    <AffLayout>
      <div className="card p-6 max-w-2xl">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Megaphone className="h-5 w-5 text-emerald-600" /> Bulk WhatsApp Campaign
        </h3>
        <input className="input w-full mb-3" placeholder="Campaign title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="input w-full mb-3" rows={5} placeholder="Your message…" value={message} onChange={(e) => setMessage(e.target.value)} />
        <textarea className="input w-full mb-3" rows={6} placeholder="Recipients — one phone per line" value={phones} onChange={(e) => setPhones(e.target.value)} />
        <label className="text-xs text-gray-500 block mb-3">
          Delay between messages (ms): {delayMs}
          <input type="range" min={1000} max={8000} step={500} value={delayMs} onChange={(e) => setDelayMs(Number(e.target.value))} className="w-full mt-1" />
        </label>
        <button type="button" className="btn-primary text-sm" onClick={send} disabled={sending || !message || !phones.trim()}>
          {sending ? 'Sending…' : 'Send Bulk Messages'}
        </button>
        {result && (
          <p className="mt-4 text-sm text-green-700">
            Sent: {result.sentCount} · Failed: {result.failedCount}
          </p>
        )}
      </div>
    </AffLayout>
  );
}

function SocialConnectPage({ platform }: { platform: 'facebook' | 'instagram' }) {
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const isFb = platform === 'facebook';
  const Icon = isFb ? Facebook : Instagram;

  const { data, isLoading, refetch } = useQuery({
    queryKey: [`affiliate-${platform}-status`],
    queryFn: () => api.get<SocialStatus>(`/admin/affiliate-marketing/${platform}/status`),
  });

  const status = data?.data as SocialStatus | undefined;
  const connected = searchParams.get('connected') === '1';

  useEffect(() => {
    if (connected) refetch();
  }, [connected, refetch]);

  const connect = async () => {
    const res = await api.get<{ url: string }>(`/admin/affiliate-marketing/${platform}/auth-url`);
    if (res.success && res.data?.url) {
      window.location.href = res.data.url;
    }
  };

  const disconnect = async () => {
    await api.post(`/admin/affiliate-marketing/${platform}/disconnect`);
    qc.invalidateQueries({ queryKey: [`affiliate-${platform}-status`] });
    refetch();
  };

  if (isLoading) return <AffLayout><LoadingState /></AffLayout>;

  return (
    <AffLayout>
      <div className="card p-6 max-w-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn('grid h-12 w-12 place-items-center rounded-xl', isFb ? 'bg-blue-100' : 'bg-pink-100')}>
            <Icon className={cn('h-6 w-6', isFb ? 'text-blue-600' : 'text-pink-600')} />
          </div>
          <div>
            <h3 className="font-semibold capitalize">{platform} Connect</h3>
            <p className="text-sm text-gray-500">Link your {platform} business account for affiliate campaigns</p>
          </div>
        </div>

        <StatusPill ok={status?.status === 'connected'} label={status?.status === 'connected' ? 'Connected' : 'Not connected'} />

        {status?.status === 'connected' && (
          <div className={cn('mt-4 rounded-xl p-4 text-sm', isFb ? 'bg-blue-50 text-blue-800' : 'bg-pink-50 text-pink-800')}>
            {status.profilePicture && <img src={status.profilePicture} alt="" className="h-12 w-12 rounded-full mb-2" />}
            <p className="font-medium">{status.accountName}</p>
            <p className="text-xs opacity-70">ID: {status.accountId}</p>
            {status.connectedAt && <p className="text-xs mt-1">Connected {formatDate(status.connectedAt)}</p>}
          </div>
        )}

        {connected && <p className="mt-3 text-sm text-green-600">Successfully connected!</p>}
        {searchParams.get('error') && <p className="mt-3 text-sm text-red-600">Connection failed. Check Meta App settings.</p>}

        <div className="mt-5 flex gap-3">
          {status?.status === 'connected' ? (
            <button type="button" className="btn-secondary text-sm" onClick={disconnect}>Disconnect</button>
          ) : (
            <button type="button" className="btn-primary text-sm" onClick={connect}>Connect with {platform === 'facebook' ? 'Facebook' : 'Instagram'}</button>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Requires Meta App ID & Secret in Settings. Add redirect URI: {window.location.origin}/api/v1/affiliate-oauth/{platform}/callback
        </p>
      </div>
    </AffLayout>
  );
}

function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['affiliate-settings'],
    queryFn: () => api.get('/admin/affiliate-marketing/settings'),
  });
  const [form, setForm] = useState({ metaAppId: '', metaAppSecret: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = data?.data as { metaAppId?: string } | undefined;
    if (s) setForm((f) => ({ ...f, metaAppId: s.metaAppId || '' }));
  }, [data]);

  const save = async () => {
    await api.put('/admin/affiliate-marketing/settings', form);
    setSaved(true);
    qc.invalidateQueries({ queryKey: ['affiliate-settings'] });
    setTimeout(() => setSaved(false), 3000);
  };

  if (isLoading) return <AffLayout><LoadingState /></AffLayout>;

  return (
    <AffLayout>
      <div className="card p-6 max-w-lg">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <Settings className="h-5 w-5" /> Meta / Affiliate Settings
        </h3>
        <p className="text-sm text-gray-500 mb-4">Required for Facebook & Instagram OAuth connection.</p>
        <input className="input w-full mb-3" placeholder="Meta App ID" value={form.metaAppId}
          onChange={(e) => setForm((f) => ({ ...f, metaAppId: e.target.value }))} />
        <input className="input w-full mb-3" type="password" placeholder="Meta App Secret"
          value={form.metaAppSecret} onChange={(e) => setForm((f) => ({ ...f, metaAppSecret: e.target.value }))} />
        <button type="button" className="btn-primary text-sm" onClick={save}>Save Settings</button>
        {saved && <p className="mt-2 text-sm text-green-600">Settings saved.</p>}
      </div>
    </AffLayout>
  );
}

export function AdminAffiliateMarketingPage() {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="whatsapp" element={<WhatsAppPage />} />
      <Route path="groups" element={<GroupsPage />} />
      <Route path="bulk-send" element={<BulkSendPage />} />
      <Route path="facebook" element={<SocialConnectPage platform="facebook" />} />
      <Route path="instagram" element={<SocialConnectPage platform="instagram" />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/admin/affiliate-marketing" replace />} />
    </Routes>
  );
}
