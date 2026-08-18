import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, LoadingState } from '@/components/admin/AdminComponents';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Settings, Palette, Globe, Smartphone } from 'lucide-react';

const CONFIG_BASE = '/admin/settings';

const configNav = [
  {
    title: 'GENERAL',
    items: [
      { to: `${CONFIG_BASE}/platform`, icon: Settings, label: 'Platform' },
      { to: `${CONFIG_BASE}/branding`, icon: Palette, label: 'Branding' },
      { to: `${CONFIG_BASE}/website`, icon: Globe, label: 'Website' },
      { to: `${CONFIG_BASE}/mobile-app`, icon: Smartphone, label: 'Mobile App' },
    ],
  },
];

function ConfigLayout({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Configuration" subtitle="Platform-level defaults and settings" />
      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-56 shrink-0">
          <nav className="card p-3 space-y-4">
            {configNav.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-semibold text-gray-400 px-2 mb-1">{group.title}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = location.pathname === item.to;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                          active ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <Link to="/admin/emergency" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">
              Emergency Control
            </Link>
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-1">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500 mb-6">{subtitle}</p>}
            {children}
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}

function PlatformSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings-platform'],
    queryFn: () => api.get('/admin/settings-config/platform'),
  });
  const [form, setForm] = useState({
    platformName: '', shortName: '', logoUrl: '', faviconUrl: '', tagline: '',
    description: '', supportEmail: '', supportPhone: '', businessEmail: '', businessAddress: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.data) {
      const d = data.data as Record<string, string>;
      setForm({
        platformName: String(d.platformName || ''),
        shortName: String(d.shortName || ''),
        logoUrl: String(d.logoUrl || ''),
        faviconUrl: String(d.faviconUrl || ''),
        tagline: String(d.tagline || ''),
        description: String(d.description || ''),
        supportEmail: String(d.supportEmail || ''),
        supportPhone: String(d.supportPhone || ''),
        businessEmail: String(d.businessEmail || ''),
        businessAddress: String(d.businessAddress || ''),
      });
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await api.put('/admin/settings-config/platform', form);
    qc.invalidateQueries({ queryKey: ['settings-platform'] });
    setSaving(false);
    setSaved(true);
  };

  if (isLoading) return <ConfigLayout title="Platform Information" subtitle="Platform-level defaults and configuration"><LoadingState /></ConfigLayout>;

  return (
    <ConfigLayout title="Platform Information" subtitle="Platform-level defaults and configuration">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500">Platform Name</label>
          <input className="input w-full" value={form.platformName} onChange={(e) => setForm({ ...form, platformName: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Short Name</label>
          <input className="input w-full" value={form.shortName} onChange={(e) => setForm({ ...form, shortName: e.target.value })} />
        </div>
        <div>
          <ImageUpload label="Upload Logo" value={form.logoUrl} onChange={(url) => setForm({ ...form, logoUrl: url })} folder="logos" hint="PNG, JPG or SVG. Max 5MB." previewClassName="h-16 w-32" />
        </div>
        <div>
          <ImageUpload label="Upload Favicon" value={form.faviconUrl} onChange={(url) => setForm({ ...form, faviconUrl: url })} folder="favicons" accept="image/*,.ico" hint="ICO, PNG 32×32 recommended." previewClassName="h-12 w-12" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Tagline</label>
          <input className="input w-full" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Description</label>
          <textarea className="input w-full" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Support Email</label>
          <input type="email" className="input w-full" value={form.supportEmail} onChange={(e) => setForm({ ...form, supportEmail: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Support Phone</label>
          <input className="input w-full" value={form.supportPhone} onChange={(e) => setForm({ ...form, supportPhone: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Business Email</label>
          <input type="email" className="input w-full" value={form.businessEmail} onChange={(e) => setForm({ ...form, businessEmail: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Business Address</label>
          <textarea className="input w-full" rows={2} value={form.businessAddress} onChange={(e) => setForm({ ...form, businessAddress: e.target.value })} />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-6 pt-4 border-t">
        <button type="button" className="btn-primary text-sm" disabled={saving} onClick={save}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-green-600">Settings saved</span>}
      </div>
    </ConfigLayout>
  );
}

function BrandingSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings-branding'],
    queryFn: () => api.get('/admin/settings-config/branding'),
  });
  const [form, setForm] = useState({
    primaryColor: '#2563eb', secondaryColor: '#7c3aed', coverImageUrl: '', loginBannerUrl: '', footerText: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.data) {
      const d = data.data as Record<string, string>;
      setForm({
        primaryColor: String(d.primaryColor || '#2563eb'),
        secondaryColor: String(d.secondaryColor || '#7c3aed'),
        coverImageUrl: String(d.coverImageUrl || ''),
        loginBannerUrl: String(d.loginBannerUrl || ''),
        footerText: String(d.footerText || ''),
      });
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    await api.put('/admin/settings-config/branding', form);
    qc.invalidateQueries({ queryKey: ['settings-branding'] });
    setSaving(false);
    setSaved(true);
  };

  if (isLoading) return <ConfigLayout title="Branding" subtitle="Colors, banners and visual identity"><LoadingState /></ConfigLayout>;

  return (
    <ConfigLayout title="Branding" subtitle="Colors, banners and visual identity">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500">Primary Color</label>
          <div className="flex gap-2">
            <input type="color" className="h-10 w-14 rounded border" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
            <input className="input flex-1" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500">Secondary Color</label>
          <div className="flex gap-2">
            <input type="color" className="h-10 w-14 rounded border" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
            <input className="input flex-1" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} />
          </div>
        </div>
        <div>
          <ImageUpload label="Upload Cover Image" value={form.coverImageUrl} onChange={(url) => setForm({ ...form, coverImageUrl: url })} folder="covers" previewClassName="h-24 w-full max-w-xs" />
        </div>
        <div>
          <ImageUpload label="Upload Login Banner" value={form.loginBannerUrl} onChange={(url) => setForm({ ...form, loginBannerUrl: url })} folder="covers" previewClassName="h-24 w-full max-w-xs" />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Footer Text</label>
          <textarea className="input w-full" rows={2} value={form.footerText} onChange={(e) => setForm({ ...form, footerText: e.target.value })} />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-6 pt-4 border-t">
        <button type="button" className="btn-primary text-sm" disabled={saving} onClick={save}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-green-600">Settings saved</span>}
      </div>
    </ConfigLayout>
  );
}

function PlaceholderConfigPage({ title }: { title: string }) {
  return (
    <ConfigLayout title={title}>
      <p className="text-sm text-gray-500">This section will be configured in a future update.</p>
    </ConfigLayout>
  );
}

export function AdminConfigurationPage() {
  return (
    <Routes>
      <Route index element={<Navigate to="platform" replace />} />
      <Route path="platform" element={<PlatformSettingsPage />} />
      <Route path="branding" element={<BrandingSettingsPage />} />
      <Route path="website" element={<PlaceholderConfigPage title="Website" />} />
      <Route path="mobile-app" element={<PlaceholderConfigPage title="Mobile App" />} />
    </Routes>
  );
}
