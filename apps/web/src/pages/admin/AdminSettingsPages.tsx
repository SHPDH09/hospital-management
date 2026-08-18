import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, LoadingState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

type FieldType = 'text' | 'textarea' | 'number' | 'email' | 'url' | 'color' | 'select' | 'toggle' | 'secret' | 'json';

type FieldDef = {
  key: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  hint?: string;
  placeholder?: string;
};

const subNavGroups = [
  {
    title: 'General',
    items: [
      { to: '/admin/settings', label: 'Overview', end: true },
      { to: '/admin/settings/platform', label: 'Platform' },
      { to: '/admin/settings/branding', label: 'Branding' },
      { to: '/admin/settings/website', label: 'Website' },
      { to: '/admin/settings/mobile', label: 'Mobile App' },
      { to: '/admin/settings/localization', label: 'Localization' },
    ],
  },
  {
    title: 'Commerce',
    items: [
      { to: '/admin/settings/currency-tax', label: 'Currency & Tax' },
      { to: '/admin/settings/payment', label: 'Payment Gateway' },
      { to: '/admin/settings/subscriptions', label: 'Subscriptions' },
      { to: '/admin/settings/advertisements', label: 'Advertisements' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { to: '/admin/settings/email', label: 'Email' },
      { to: '/admin/settings/sms', label: 'SMS' },
      { to: '/admin/settings/whatsapp', label: 'WhatsApp' },
      { to: '/admin/settings/notifications', label: 'Notifications' },
    ],
  },
  {
    title: 'Healthcare',
    items: [
      { to: '/admin/settings/appointment', label: 'Appointment' },
      { to: '/admin/settings/hospital-clinic', label: 'Hospital & Clinic' },
      { to: '/admin/settings/doctor', label: 'Doctor' },
      { to: '/admin/settings/patient', label: 'Patient' },
      { to: '/admin/settings/search', label: 'Search' },
      { to: '/admin/settings/reviews', label: 'Reviews' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/admin/settings/security', label: 'Security' },
      { to: '/admin/settings/privacy', label: 'Privacy & Data' },
      { to: '/admin/settings/storage', label: 'File & Storage' },
      { to: '/admin/settings/analytics', label: 'Analytics' },
      { to: '/admin/settings/api-integration', label: 'API & Integrations' },
      { to: '/admin/settings/legal', label: 'Legal & Compliance' },
      { to: '/admin/settings/audit', label: 'Audit Logs' },
    ],
  },
];

function SettingsLayout({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={title || 'Global Settings'}
        subtitle={subtitle || 'Platform-level defaults and configuration'}
      />
      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-56 shrink-0">
          <nav className="space-y-4">
            {subNavGroups.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 px-2">{group.title}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = item.end
                      ? location.pathname === item.to
                      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          'block px-3 py-1.5 rounded-lg text-sm transition-colors',
                          active ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </DashboardLayout>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn('relative w-11 h-6 rounded-full transition-colors', checked ? 'bg-primary-600' : 'bg-gray-200')}
      >
        <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform', checked && 'translate-x-5')} />
      </button>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const type = field.type || 'text';
  if (type === 'toggle') {
    return <Toggle checked={Boolean(value)} onChange={onChange} label={field.label} hint={field.hint} />;
  }
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{field.label}</label>
      {field.hint && <p className="text-xs text-gray-500">{field.hint}</p>}
      {type === 'textarea' ? (
        <textarea
          className="input w-full"
          rows={3}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : type === 'select' ? (
        <select className="input w-full" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          className="input w-full"
          type={type === 'secret' ? 'password' : type === 'number' ? 'number' : type}
          value={String(value ?? '')}
          placeholder={type === 'secret' ? 'Leave blank to keep existing' : field.placeholder}
          onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        />
      )}
    </div>
  );
}

function CategoryForm({
  category,
  title,
  fields,
  extra,
}: {
  category: string;
  title: string;
  fields: FieldDef[];
  extra?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const key = ['settings', category];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api.get(`/admin/settings/${category}`),
  });
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.data) setForm(data.data as Record<string, unknown>);
  }, [data]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    await api.put(`/admin/settings/${category}`, form);
    setSaving(false);
    setSaved(true);
    qc.invalidateQueries({ queryKey: key });
    setTimeout(() => setSaved(false), 2000);
  };

  const toggles = fields.filter((f) => f.type === 'toggle');
  const inputs = fields.filter((f) => f.type !== 'toggle');

  if (isLoading) return <SettingsLayout><LoadingState /></SettingsLayout>;

  return (
    <SettingsLayout title={title}>
      <div className="card p-6 space-y-6">
        {inputs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inputs.map((f) => (
              <FieldInput key={f.key} field={f} value={form[f.key]} onChange={(v) => set(f.key, v)} />
            ))}
          </div>
        )}
        {toggles.length > 0 && (
          <div className="border rounded-lg px-4 divide-y divide-gray-100">
            {toggles.map((f) => (
              <FieldInput key={f.key} field={f} value={form[f.key]} onChange={(v) => set(f.key, v)} />
            ))}
          </div>
        )}
        {extra}
        <div className="flex items-center gap-3 pt-2 border-t">
          <button className="btn-primary text-sm" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && <span className="text-sm text-green-600">Saved successfully</span>}
        </div>
      </div>
    </SettingsLayout>
  );
}

function OverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings-overview'],
    queryFn: () => api.get('/admin/settings'),
  });
  const categories = (data?.data as { categories?: { id: string; label: string; updatedAt: string | null; configured: boolean }[] })?.categories || [];

  const seedDefaults = async () => {
    await api.post('/admin/settings/seed-defaults');
    window.location.reload();
  };

  if (isLoading) return <SettingsLayout><LoadingState /></SettingsLayout>;

  return (
    <SettingsLayout>
      <div className="mb-4 flex justify-between items-center">
        <p className="text-sm text-gray-600">
          Global Settings define platform-level defaults. Organization settings override these per hospital/clinic.
        </p>
        <button className="btn-secondary text-sm" onClick={seedDefaults}>Seed Defaults</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {categories.map((c) => (
          <Link key={c.id} to={`/admin/settings/${c.id}`} className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-gray-900">{c.label}</h3>
              <span className={cn('text-xs px-2 py-0.5 rounded-full', c.configured ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                {c.configured ? 'Configured' : 'Default'}
              </span>
            </div>
            {c.updatedAt && (
              <p className="text-xs text-gray-500 mt-2">Updated {formatDate(c.updatedAt)}</p>
            )}
          </Link>
        ))}
      </div>
    </SettingsLayout>
  );
}

function BrandingPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'branding'], queryFn: () => api.get('/admin/settings/branding') });
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data?.data) setForm(data.data as Record<string, unknown>); }, [data]);

  const fields: FieldDef[] = [
    { key: 'primaryLogo', label: 'Primary Logo URL' },
    { key: 'darkLogo', label: 'Dark Logo URL' },
    { key: 'favicon', label: 'Favicon URL' },
    { key: 'loginPageLogo', label: 'Login Page Logo' },
    { key: 'appLogo', label: 'App Logo' },
    { key: 'primaryColor', label: 'Primary Color', type: 'color' },
    { key: 'secondaryColor', label: 'Secondary Color', type: 'color' },
    { key: 'accentColor', label: 'Accent Color', type: 'color' },
    { key: 'buttonStyle', label: 'Button Style', type: 'select', options: [
      { value: 'rounded', label: 'Rounded' }, { value: 'pill', label: 'Pill' }, { value: 'square', label: 'Square' },
    ]},
    { key: 'emailLogo', label: 'Email Logo URL' },
    { key: 'defaultProfileImage', label: 'Default Profile Image URL' },
  ];

  if (isLoading) return <SettingsLayout><LoadingState /></SettingsLayout>;

  return (
    <SettingsLayout title="Branding">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f) => (
              <FieldInput key={f.key} field={f} value={form[f.key]} onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))} />
            ))}
          </div>
          <button className="btn-primary text-sm" disabled={saving} onClick={async () => {
            setSaving(true);
            await api.put('/admin/settings/branding', form);
            setSaving(false);
            qc.invalidateQueries({ queryKey: ['settings', 'branding'] });
          }}>Save Changes</button>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Preview</h3>
          <div className="rounded-lg border p-4 space-y-3" style={{ borderColor: String(form.primaryColor || '#2563eb') }}>
            {form.primaryLogo ? (
              <img src={String(form.primaryLogo)} alt="Logo" className="h-10 object-contain" />
            ) : (
              <div className="h-10 w-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">Logo</div>
            )}
            <button
              className="px-4 py-2 text-white text-sm font-medium"
              style={{ backgroundColor: String(form.primaryColor || '#2563eb'), borderRadius: form.buttonStyle === 'pill' ? '9999px' : form.buttonStyle === 'square' ? '4px' : '8px' }}
            >
              Sample Button
            </button>
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded" style={{ backgroundColor: String(form.primaryColor) }} />
              <div className="w-8 h-8 rounded" style={{ backgroundColor: String(form.secondaryColor) }} />
              <div className="w-8 h-8 rounded" style={{ backgroundColor: String(form.accentColor) }} />
            </div>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}

function PaymentPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'payment'], queryFn: () => api.get('/admin/settings/payment') });
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data?.data) setForm(data.data as Record<string, unknown>); }, [data]);

  const gateway = (name: 'razorpay' | 'stripe') => {
    const g = (form[name] || {}) as Record<string, unknown>;
    const setG = (k: string, v: unknown) => setForm((f) => ({ ...f, [name]: { ...(f[name] as object || {}), [k]: v } }));
    return (
      <div key={name} className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold capitalize">{name}</h3>
          <Toggle checked={Boolean(g.enabled)} onChange={(v) => setG('enabled', v)} label="" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FieldInput field={{ key: 'testMode', label: 'Test Mode', type: 'toggle' }} value={g.testMode} onChange={(v) => setG('testMode', v)} />
          <FieldInput field={{ key: 'currency', label: 'Currency' }} value={g.currency} onChange={(v) => setG('currency', v)} />
          <FieldInput field={{ key: 'apiKey', label: 'API Key', type: 'secret' }} value={g.apiKey} onChange={(v) => setG('apiKey', v)} />
          <FieldInput field={{ key: 'secretKey', label: 'Secret Key', type: 'secret' }} value={g.secretKey} onChange={(v) => setG('secretKey', v)} />
          <FieldInput field={{ key: 'webhookSecret', label: 'Webhook Secret', type: 'secret' }} value={g.webhookSecret} onChange={(v) => setG('webhookSecret', v)} />
        </div>
      </div>
    );
  };

  if (isLoading) return <SettingsLayout><LoadingState /></SettingsLayout>;

  return (
    <SettingsLayout title="Payment Gateway">
      <div className="card p-6 space-y-4">
        <p className="text-sm text-gray-500">Credentials are encrypted at rest and masked in the UI.</p>
        {gateway('razorpay')}
        {gateway('stripe')}
        <button className="btn-primary text-sm" disabled={saving} onClick={async () => {
          setSaving(true);
          await api.put('/admin/settings/payment', form);
          setSaving(false);
          qc.invalidateQueries({ queryKey: ['settings', 'payment'] });
        }}>Save Changes</button>
      </div>
    </SettingsLayout>
  );
}

function EmailPage() {
  const [testTo, setTestTo] = useState('');
  const [testResult, setTestResult] = useState('');
  const fields: FieldDef[] = [
    { key: 'enabled', label: 'Email Enabled', type: 'toggle' },
    { key: 'provider', label: 'Provider', type: 'select', options: [
      { value: 'smtp', label: 'SMTP' }, { value: 'sendgrid', label: 'SendGrid' }, { value: 'ses', label: 'AWS SES' }, { value: 'mailgun', label: 'Mailgun' },
    ]},
    { key: 'smtpHost', label: 'SMTP Host' },
    { key: 'smtpPort', label: 'SMTP Port', type: 'number' },
    { key: 'smtpUsername', label: 'SMTP Username' },
    { key: 'smtpPassword', label: 'SMTP Password', type: 'secret' },
    { key: 'senderName', label: 'Sender Name' },
    { key: 'senderEmail', label: 'Sender Email', type: 'email' },
    { key: 'replyTo', label: 'Reply-To', type: 'email' },
    { key: 'apiProvider', label: 'API Provider' },
    { key: 'apiKey', label: 'API Key', type: 'secret' },
  ];

  const sendTest = async () => {
    const res = await api.post('/admin/settings/email/test', { to: testTo });
    setTestResult((res as { message?: string }).message || 'Test email sent');
  };

  return (
    <CategoryForm
      category="email"
      title="Email Settings"
      fields={fields}
      extra={
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="font-medium mb-2">Test Email</h3>
          <div className="flex gap-2">
            <input className="input flex-1" type="email" placeholder="recipient@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
            <button className="btn-secondary text-sm" onClick={sendTest} disabled={!testTo}>Send Test</button>
          </div>
          {testResult && <p className="text-sm text-green-600 mt-2">{testResult}</p>}
        </div>
      }
    />
  );
}

function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings', 'notifications'], queryFn: () => api.get('/admin/settings/notifications') });
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (data?.data) setForm(data.data as Record<string, unknown>); }, [data]);

  const channels = ['email', 'sms', 'whatsapp', 'push', 'inApp'] as const;
  const types = form.types as Record<string, Record<string, boolean>> || {};
  const typeLabels: Record<string, string> = {
    appointmentConfirmation: 'Appointment Confirmation',
    appointmentReminder: 'Appointment Reminder',
    appointmentCancellation: 'Appointment Cancellation',
    paymentReceipt: 'Payment Receipt',
    registrationWelcome: 'Registration Welcome',
    passwordReset: 'Password Reset',
    subscriptionExpiry: 'Subscription Expiry',
    reviewRequest: 'Review Request',
  };

  const setChannel = (typeKey: string, channel: string, val: boolean) => {
    setForm((f) => ({
      ...f,
      types: { ...types, [typeKey]: { ...types[typeKey], [channel]: val } },
    }));
  };

  if (isLoading) return <SettingsLayout><LoadingState /></SettingsLayout>;

  return (
    <SettingsLayout title="Notification Settings">
      <div className="card p-6 space-y-6">
        <div className="border rounded-lg px-4">
          {[
            { key: 'emailNotifications', label: 'Email Notifications' },
            { key: 'smsNotifications', label: 'SMS Notifications' },
            { key: 'whatsappNotifications', label: 'WhatsApp Notifications' },
            { key: 'pushNotifications', label: 'Push Notifications' },
            { key: 'inAppNotifications', label: 'In-App Notifications' },
          ].map((g) => (
            <Toggle key={g.key} checked={Boolean(form[g.key])} onChange={(v) => setForm((f) => ({ ...f, [g.key]: v }))} label={g.label} />
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-4">Notification Type</th>
                {channels.map((c) => <th key={c} className="py-2 px-2 capitalize">{c === 'inApp' ? 'In-App' : c}</th>)}
              </tr>
            </thead>
            <tbody>
              {Object.entries(typeLabels).map(([typeKey, label]) => (
                <tr key={typeKey} className="border-b border-gray-50">
                  <td className="py-2 pr-4 font-medium">{label}</td>
                  {channels.map((ch) => (
                    <td key={ch} className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={Boolean(types[typeKey]?.[ch])}
                        onChange={(e) => setChannel(typeKey, ch, e.target.checked)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-primary text-sm" disabled={saving} onClick={async () => {
          setSaving(true);
          await api.put('/admin/settings/notifications', form);
          setSaving(false);
          qc.invalidateQueries({ queryKey: ['settings', 'notifications'] });
        }}>Save Changes</button>
      </div>
    </SettingsLayout>
  );
}

function AuditLogsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['settings-logs'],
    queryFn: () => api.get('/admin/settings/logs?limit=100'),
  });
  const logs = (data?.data as Record<string, unknown>[]) || [];

  if (isLoading) return <SettingsLayout><LoadingState /></SettingsLayout>;

  return (
    <SettingsLayout title="Audit & System Logs">
      <p className="text-sm text-gray-600 mb-4">
        Critical setting changes are logged with old value, new value, changed by, and timestamp.
      </p>
      <AdminTable
        emptyMessage="No settings change logs yet"
        columns={[
          { key: 'createdAt', label: 'Date/Time', render: (r) => formatDate(String(r.createdAt)) },
          { key: 'action', label: 'Action' },
          { key: 'entityId', label: 'Category' },
          { key: 'user', label: 'Changed By', render: (r) => {
            const u = r.user as { email?: string } | null;
            return u?.email || 'System';
          }},
          { key: 'details', label: 'Changes', render: (r) => (
            <span className="text-xs font-mono max-w-xs truncate block">{JSON.stringify(r.details)}</span>
          )},
        ]}
        rows={logs}
      />
      <div className="mt-4">
        <Link to="/admin/audit-logs" className="text-sm text-primary-600 hover:underline">
          View full system audit logs →
        </Link>
      </div>
    </SettingsLayout>
  );
}

// Field definitions for standard category pages
const categoryFields: Record<string, { title: string; fields: FieldDef[] }> = {
  platform: {
    title: 'Platform Information',
    fields: [
      { key: 'platformName', label: 'Platform Name' },
      { key: 'shortName', label: 'Short Name' },
      { key: 'logo', label: 'Logo URL' },
      { key: 'favicon', label: 'Favicon URL' },
      { key: 'tagline', label: 'Tagline' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'supportEmail', label: 'Support Email', type: 'email' },
      { key: 'supportPhone', label: 'Support Phone' },
      { key: 'businessEmail', label: 'Business Email', type: 'email' },
      { key: 'businessAddress', label: 'Business Address', type: 'textarea' },
      { key: 'websiteUrl', label: 'Website URL', type: 'url' },
      { key: 'defaultLanguage', label: 'Default Language' },
      { key: 'defaultCountry', label: 'Default Country' },
      { key: 'defaultCurrency', label: 'Default Currency' },
      { key: 'timeZone', label: 'Time Zone' },
    ],
  },
  website: {
    title: 'Website Settings',
    fields: [
      { key: 'websiteStatus', label: 'Website Status', type: 'select', options: [
        { value: 'active', label: 'Active' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'disabled', label: 'Disabled' },
      ]},
      { key: 'maintenanceMode', label: 'Maintenance Mode', type: 'toggle' },
      { key: 'maintenanceMessage', label: 'Maintenance Message', type: 'textarea' },
      { key: 'registrationEnabled', label: 'Registration Enabled', type: 'toggle' },
      { key: 'patientRegistration', label: 'Patient Registration', type: 'toggle' },
      { key: 'hospitalRegistration', label: 'Hospital Registration', type: 'toggle' },
      { key: 'clinicRegistration', label: 'Clinic Registration', type: 'toggle' },
      { key: 'doctorRegistration', label: 'Doctor Registration', type: 'toggle' },
      { key: 'searchEnabled', label: 'Search Enabled', type: 'toggle' },
      { key: 'appointmentBookingEnabled', label: 'Appointment Booking Enabled', type: 'toggle' },
    ],
  },
  mobile: {
    title: 'Mobile App Settings',
    fields: [
      { key: 'appName', label: 'App Name' },
      { key: 'appVersion', label: 'App Version' },
      { key: 'minimumSupportedVersion', label: 'Minimum Supported Version', hint: 'Users below this version see update prompt' },
      { key: 'latestVersion', label: 'Latest Version' },
      { key: 'forceUpdate', label: 'Force Update', type: 'toggle' },
      { key: 'androidAppLink', label: 'Android App Link', type: 'url' },
      { key: 'iosAppLink', label: 'iOS App Link', type: 'url' },
      { key: 'maintenanceMode', label: 'Maintenance Mode', type: 'toggle' },
      { key: 'maintenanceMessage', label: 'Maintenance Message', type: 'textarea' },
    ],
  },
  'currency-tax': {
    title: 'Currency & Tax Settings',
    fields: [
      { key: 'currency', label: 'Currency' },
      { key: 'currencySymbol', label: 'Currency Symbol' },
      { key: 'decimalPlaces', label: 'Decimal Places', type: 'number' },
      { key: 'taxEnabled', label: 'Tax Enabled', type: 'toggle' },
      { key: 'taxName', label: 'Tax Name (VAT/GST)' },
      { key: 'taxPercentage', label: 'Tax Percentage', type: 'number' },
      { key: 'platformFeePercent', label: 'Platform Fee %', type: 'number' },
      { key: 'serviceFeePercent', label: 'Service Fee %', type: 'number' },
      { key: 'convenienceFeePercent', label: 'Convenience Fee %', type: 'number' },
      { key: 'minimumTransaction', label: 'Minimum Transaction', type: 'number' },
      { key: 'maximumTransaction', label: 'Maximum Transaction', type: 'number' },
    ],
  },
  sms: {
    title: 'SMS Settings',
    fields: [
      { key: 'enabled', label: 'SMS Enabled', type: 'toggle' },
      { key: 'provider', label: 'SMS Provider' },
      { key: 'apiKey', label: 'API Key', type: 'secret' },
      { key: 'senderId', label: 'Sender ID' },
      { key: 'otpEnabled', label: 'OTP Enabled', type: 'toggle' },
      { key: 'deliveryReports', label: 'Delivery Reports', type: 'toggle' },
    ],
  },
  whatsapp: {
    title: 'WhatsApp Settings',
    fields: [
      { key: 'enabled', label: 'WhatsApp Enabled', type: 'toggle' },
      { key: 'businessAccountId', label: 'Business Account ID' },
      { key: 'apiProvider', label: 'API Provider' },
      { key: 'apiCredentials', label: 'API Credentials', type: 'secret' },
      { key: 'phoneNumber', label: 'Phone Number' },
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url' },
    ],
  },
  appointment: {
    title: 'Appointment Settings',
    fields: [
      { key: 'bookingEnabled', label: 'Booking Enabled', type: 'toggle' },
      { key: 'advanceBookingDays', label: 'Advance Booking Days', type: 'number', hint: 'e.g. 30 days in advance' },
      { key: 'minimumCancellationHours', label: 'Minimum Cancellation Time (hours)', type: 'number' },
      { key: 'reschedulingAllowed', label: 'Rescheduling Allowed', type: 'toggle' },
      { key: 'noShowPolicy', label: 'No-show Policy' },
      { key: 'defaultDurationMinutes', label: 'Default Duration (minutes)', type: 'number' },
      { key: 'bufferTimeMinutes', label: 'Buffer Time (minutes)', type: 'number' },
      { key: 'maxAppointmentsPerSlot', label: 'Max Appointments Per Slot', type: 'number' },
    ],
  },
  'hospital-clinic': {
    title: 'Hospital & Clinic Settings',
    fields: [
      { key: 'hospitalApprovalRequired', label: 'Hospital Approval Required', type: 'toggle' },
      { key: 'clinicApprovalRequired', label: 'Clinic Approval Required', type: 'toggle' },
      { key: 'doctorApprovalRequired', label: 'Doctor Approval Required', type: 'toggle' },
      { key: 'verificationRequired', label: 'Verification Required', type: 'toggle' },
      { key: 'documentVerificationRequired', label: 'Document Verification Required', type: 'toggle' },
      { key: 'autoApproval', label: 'Auto Approval', type: 'toggle' },
      { key: 'organizationListingVisibility', label: 'Listing Visibility', type: 'select', options: [
        { value: 'public', label: 'Public' }, { value: 'verified_only', label: 'Verified Only' }, { value: 'hidden', label: 'Hidden' },
      ]},
    ],
  },
  doctor: {
    title: 'Doctor Settings',
    fields: [
      { key: 'verificationRequired', label: 'Verification Required', type: 'toggle' },
      { key: 'registrationApproval', label: 'Registration Approval', type: 'toggle' },
      { key: 'profileVisibility', label: 'Profile Visibility', type: 'select', options: [
        { value: 'public', label: 'Public' }, { value: 'organization_only', label: 'Organization Only' },
      ]},
      { key: 'reviewEligibility', label: 'Review Eligibility', type: 'toggle' },
      { key: 'consultationFeeRequired', label: 'Consultation Fee Required', type: 'toggle' },
      { key: 'availabilityRequired', label: 'Availability Required', type: 'toggle' },
    ],
  },
  patient: {
    title: 'Patient Settings',
    fields: [
      { key: 'emailVerification', label: 'Email Verification', type: 'toggle' },
      { key: 'phoneVerification', label: 'Phone Verification', type: 'toggle' },
      { key: 'otpRequired', label: 'OTP Required', type: 'toggle' },
      { key: 'profileCompletionRequired', label: 'Profile Completion Required', type: 'toggle' },
      { key: 'accountDeletionAllowed', label: 'Account Deletion Allowed', type: 'toggle' },
      { key: 'accountDeactivationAllowed', label: 'Account Deactivation Allowed', type: 'toggle' },
      { key: 'reviewEligibility', label: 'Review Eligibility', type: 'toggle' },
    ],
  },
  security: {
    title: 'Security Settings',
    fields: [
      { key: 'minPasswordLength', label: 'Minimum Password Length', type: 'number' },
      { key: 'requireUppercase', label: 'Require Uppercase', type: 'toggle' },
      { key: 'requireNumbers', label: 'Require Numbers', type: 'toggle' },
      { key: 'requireSpecialChars', label: 'Require Special Characters', type: 'toggle' },
      { key: 'maxLoginAttempts', label: 'Maximum Login Attempts', type: 'number' },
      { key: 'accountLockDurationMinutes', label: 'Account Lock Duration (minutes)', type: 'number' },
      { key: 'sessionTimeoutMinutes', label: 'Session Timeout (minutes)', type: 'number' },
      { key: 'twoFactorRequired', label: '2FA Required (All Users)', type: 'toggle' },
      { key: 'twoFactorRequiredForAdmin', label: '2FA Required for Super Admin', type: 'toggle' },
      { key: 'otpExpiryMinutes', label: 'OTP Expiry (minutes)', type: 'number' },
      { key: 'otpAttemptLimit', label: 'OTP Attempt Limit', type: 'number' },
      { key: 'ipBlockingEnabled', label: 'IP Blocking', type: 'toggle' },
      { key: 'deviceSessionManagement', label: 'Device Session Management', type: 'toggle' },
      { key: 'adminLoginSecurity', label: 'Admin Login Security', type: 'toggle' },
    ],
  },
  privacy: {
    title: 'Privacy & Data Settings',
    fields: [
      { key: 'dataRetentionDays', label: 'Data Retention (days)', type: 'number' },
      { key: 'accountDeletionGraceDays', label: 'Account Deletion Grace (days)', type: 'number' },
      { key: 'documentRetentionDays', label: 'Document Retention (days)', type: 'number' },
      { key: 'consentRequired', label: 'Consent Required', type: 'toggle' },
      { key: 'privacyControlsEnabled', label: 'Privacy Controls', type: 'toggle' },
      { key: 'dataExportEnabled', label: 'Data Export', type: 'toggle' },
      { key: 'dataAccessLogging', label: 'Data Access Logging', type: 'toggle' },
      { key: 'auditLogRetentionDays', label: 'Audit Log Retention (days)', type: 'number' },
    ],
  },
  storage: {
    title: 'File & Storage Settings',
    fields: [
      { key: 'provider', label: 'Storage Provider', type: 'select', options: [
        { value: 'local', label: 'Local' }, { value: 's3', label: 'AWS S3' }, { value: 'gcs', label: 'Google Cloud' },
      ]},
      { key: 'maxFileSizeMb', label: 'Max File Size (MB)', type: 'number' },
      { key: 'imageCompression', label: 'Image Compression', type: 'toggle' },
      { key: 'signedUrlExpiryMinutes', label: 'Signed URL Expiry (minutes)', type: 'number', hint: 'Medical documents use signed URLs, not public paths' },
    ],
  },
  search: {
    title: 'Search Settings',
    fields: [
      { key: 'searchEnabled', label: 'Search Enabled', type: 'toggle' },
      { key: 'locationSearch', label: 'Location Search', type: 'toggle' },
      { key: 'defaultRadiusKm', label: 'Default Radius (KM)', type: 'number' },
      { key: 'defaultSorting', label: 'Default Sorting', type: 'select', options: [
        { value: 'relevance', label: 'Relevance' }, { value: 'rating', label: 'Rating' }, { value: 'distance', label: 'Distance' },
      ]},
      { key: 'ratingSorting', label: 'Rating Sorting', type: 'toggle' },
      { key: 'distanceSorting', label: 'Distance Sorting', type: 'toggle' },
      { key: 'featuredListingPriority', label: 'Featured Listing Priority', type: 'toggle' },
      { key: 'searchResultLimit', label: 'Search Result Limit', type: 'number' },
    ],
  },
  reviews: {
    title: 'Review Settings',
    fields: [
      { key: 'reviewEnabled', label: 'Reviews Enabled', type: 'toggle' },
      { key: 'ratingRequired', label: 'Rating Required', type: 'toggle' },
      { key: 'afterCompletedAppointmentOnly', label: 'After Completed Appointment Only', type: 'toggle' },
      { key: 'reviewModeration', label: 'Review Moderation', type: 'toggle' },
      { key: 'hospitalResponseAllowed', label: 'Hospital Response Allowed', type: 'toggle' },
      { key: 'doctorResponseAllowed', label: 'Doctor Response Allowed', type: 'toggle' },
      { key: 'reportReviewAllowed', label: 'Report Review Allowed', type: 'toggle' },
    ],
  },
  advertisements: {
    title: 'Advertisement Settings',
    fields: [
      { key: 'advertisementEnabled', label: 'Advertisements Enabled', type: 'toggle' },
      { key: 'adminApprovalRequired', label: 'Admin Approval Required', type: 'toggle' },
      { key: 'autoPublish', label: 'Auto Publish', type: 'toggle' },
      { key: 'maxCampaignDurationDays', label: 'Max Campaign Duration (days)', type: 'number' },
      { key: 'featuredListingEnabled', label: 'Featured Listing', type: 'toggle' },
      { key: 'trackingEnabled', label: 'Tracking Enabled', type: 'toggle' },
    ],
  },
  subscriptions: {
    title: 'Subscription Settings',
    fields: [
      { key: 'subscriptionEnabled', label: 'Subscriptions Enabled', type: 'toggle' },
      { key: 'defaultPlan', label: 'Default Plan' },
      { key: 'trialPeriodDays', label: 'Trial Period (days)', type: 'number' },
      { key: 'gracePeriodDays', label: 'Grace Period (days)', type: 'number' },
      { key: 'autoRenewal', label: 'Auto Renewal', type: 'toggle' },
      { key: 'expiryBehavior', label: 'Expiry Behavior', type: 'select', options: [
        { value: 'suspend', label: 'Suspend' }, { value: 'downgrade', label: 'Downgrade to Free' },
      ]},
      { key: 'suspensionBehavior', label: 'Suspension Behavior', type: 'select', options: [
        { value: 'read_only', label: 'Read Only' }, { value: 'block', label: 'Block Access' },
      ]},
      { key: 'upgradeAllowed', label: 'Upgrade Allowed', type: 'toggle' },
      { key: 'downgradeAllowed', label: 'Downgrade Allowed', type: 'toggle' },
    ],
  },
  analytics: {
    title: 'Analytics Settings',
    fields: [
      { key: 'googleAnalyticsEnabled', label: 'Google Analytics', type: 'toggle' },
      { key: 'googleAnalyticsId', label: 'Google Analytics ID' },
      { key: 'googleTagManagerEnabled', label: 'Google Tag Manager', type: 'toggle' },
      { key: 'googleTagManagerId', label: 'GTM Container ID' },
      { key: 'metaPixelEnabled', label: 'Meta Pixel', type: 'toggle' },
      { key: 'metaPixelId', label: 'Meta Pixel ID' },
      { key: 'conversionTrackingEnabled', label: 'Conversion Tracking', type: 'toggle' },
    ],
  },
  localization: {
    title: 'Localization',
    fields: [
      { key: 'language', label: 'Language' },
      { key: 'country', label: 'Country' },
      { key: 'currency', label: 'Currency' },
      { key: 'dateFormat', label: 'Date Format' },
      { key: 'timeFormat', label: 'Time Format', type: 'select', options: [
        { value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' },
      ]},
      { key: 'timeZone', label: 'Time Zone' },
      { key: 'numberFormat', label: 'Number Format' },
    ],
  },
  'api-integration': {
    title: 'API & Integration Settings',
    fields: [
      { key: 'googleMapsApiKey', label: 'Google Maps API Key', type: 'secret' },
    ],
  },
  legal: {
    title: 'Legal & Compliance',
    fields: [
      { key: 'termsUrl', label: 'Terms & Conditions URL' },
      { key: 'privacyPolicyUrl', label: 'Privacy Policy URL' },
      { key: 'cookiePolicyUrl', label: 'Cookie Policy URL' },
      { key: 'refundPolicyUrl', label: 'Refund Policy URL' },
      { key: 'patientConsentUrl', label: 'Patient Consent URL' },
      { key: 'hospitalAgreementUrl', label: 'Hospital Agreement URL' },
      { key: 'doctorAgreementUrl', label: 'Doctor Agreement URL' },
      { key: 'advertisementPolicyUrl', label: 'Advertisement Policy URL' },
    ],
  },
};

function StandardCategoryPage({ category }: { category: string }) {
  const config = categoryFields[category];
  if (!config) return <Navigate to="/admin/settings" replace />;
  return <CategoryForm category={category} title={config.title} fields={config.fields} />;
}

export function AdminSettingsPage() {
  return (
    <Routes>
      <Route index element={<OverviewPage />} />
      <Route path="platform" element={<StandardCategoryPage category="platform" />} />
      <Route path="branding" element={<BrandingPage />} />
      <Route path="website" element={<StandardCategoryPage category="website" />} />
      <Route path="mobile" element={<StandardCategoryPage category="mobile" />} />
      <Route path="currency-tax" element={<StandardCategoryPage category="currency-tax" />} />
      <Route path="payment" element={<PaymentPage />} />
      <Route path="email" element={<EmailPage />} />
      <Route path="sms" element={<StandardCategoryPage category="sms" />} />
      <Route path="whatsapp" element={<StandardCategoryPage category="whatsapp" />} />
      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="appointment" element={<StandardCategoryPage category="appointment" />} />
      <Route path="hospital-clinic" element={<StandardCategoryPage category="hospital-clinic" />} />
      <Route path="doctor" element={<StandardCategoryPage category="doctor" />} />
      <Route path="patient" element={<StandardCategoryPage category="patient" />} />
      <Route path="security" element={<StandardCategoryPage category="security" />} />
      <Route path="privacy" element={<StandardCategoryPage category="privacy" />} />
      <Route path="storage" element={<StandardCategoryPage category="storage" />} />
      <Route path="search" element={<StandardCategoryPage category="search" />} />
      <Route path="reviews" element={<StandardCategoryPage category="reviews" />} />
      <Route path="advertisements" element={<StandardCategoryPage category="advertisements" />} />
      <Route path="subscriptions" element={<StandardCategoryPage category="subscriptions" />} />
      <Route path="analytics" element={<StandardCategoryPage category="analytics" />} />
      <Route path="localization" element={<StandardCategoryPage category="localization" />} />
      <Route path="api-integration" element={<StandardCategoryPage category="api-integration" />} />
      <Route path="legal" element={<StandardCategoryPage category="legal" />} />
      <Route path="audit" element={<AuditLogsPage />} />
      <Route path="*" element={<Navigate to="/admin/settings" replace />} />
    </Routes>
  );
}
