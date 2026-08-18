import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, LoadingState } from '@/components/admin/AdminComponents';
import { HospitalLogo } from '@/components/HospitalLogo';
import { api } from '@/lib/api';

interface BrandingData {
  branding: {
    organizationId: string;
    name: string;
    logoUrl: string | null;
    logoLightUrl: string | null;
    logoDarkUrl: string | null;
    faviconUrl: string | null;
    coverImageUrl: string | null;
    brandColor: string | null;
    displayLogoUrl: string | null;
  };
  brandingLocked?: boolean;
  logoApproved?: boolean;
  galleryUrls: string[];
  branches: { id: string; name: string; logoUrl?: string | null; isActive: boolean }[];
  history: { id: string; logoUrl: string; action: string; uploadedByName?: string; createdAt: string }[];
  requirements: {
    allowedFormats: string[];
    maxFileSizeMb: number;
    recommendedFormats: string[];
    transparentBackgroundSupported: boolean;
    minWidth: number;
    minHeight: number;
  };
}

export function CrmBrandingPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['crm-branding'],
    queryFn: () => api.get<BrandingData>('/crm/branding'),
  });
  const branding = data?.data;

  const [form, setForm] = useState<Record<string, string>>({});
  const [galleryInput, setGalleryInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const field = (key: string, label: string) => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="url"
        className="input"
        placeholder="https://..."
        defaultValue={String((branding?.branding as Record<string, unknown>)?.[key] || '')}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  const save = async (confirmLogoChange = false) => {
    setSaving(true);
    setMsg('');
    try {
      const payload: Record<string, unknown> = { ...form };
      if (confirmLogoChange) payload.confirmLogoChange = true;
      if (galleryInput) {
        const existing = branding?.galleryUrls || [];
        payload.galleryUrls = [...existing, galleryInput];
      }
      await api.patch('/crm/branding', payload);
      setMsg('Branding saved — updates apply across the platform automatically.');
      setShowConfirm(false);
      setGalleryInput('');
      setForm({});
      qc.invalidateQueries({ queryKey: ['crm-branding'] });
      qc.invalidateQueries({ queryKey: ['crm-profile'] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      if (message.includes('confirmLogoChange')) setShowConfirm(true);
      else setMsg(message);
    } finally {
      setSaving(false);
    }
  };

  const removeLogo = async () => {
    if (!confirm('Remove hospital logo? It will disappear from all modules until you upload a new one.')) return;
    await api.delete('/crm/branding/logo');
    qc.invalidateQueries({ queryKey: ['crm-branding'] });
  };

  if (isLoading) return <DashboardLayout portal="crm"><LoadingState /></DashboardLayout>;

  const b = branding?.branding;
  const locked = branding?.brandingLocked;

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Branding & Identity" subtitle="Centralized hospital logo — automatically used everywhere" />
      {locked && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">
          Branding is locked by platform admin. Contact support to make changes.
        </div>
      )}
      {msg && <div className="mb-4 text-sm text-green-600">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Hospital Logo</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('logoUrl', 'Main Logo URL')}
              {field('logoLightUrl', 'Light Background Logo')}
              {field('logoDarkUrl', 'Dark Background Logo')}
              {field('faviconUrl', 'Favicon URL')}
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" className="btn-primary" disabled={saving || locked} onClick={() => save()}>
                {saving ? 'Saving...' : 'Save Branding'}
              </button>
              {b?.logoUrl && (
                <button type="button" className="btn border border-red-200 text-red-600" disabled={locked} onClick={removeLogo}>
                  Remove Logo
                </button>
              )}
            </div>
            {showConfirm && (
              <div className="mt-4 p-4 rounded-lg bg-primary-50 border border-primary-100">
                <p className="text-sm text-gray-700 mb-3">
                  Changing the logo will update branding across your hospital profile, listings, appointments,
                  referrals, staff dashboard and communications.
                </p>
                <button type="button" className="btn-primary" onClick={() => save(true)}>Confirm & Update Everywhere</button>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-4">Cover & Gallery</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {field('coverImageUrl', 'Cover Image URL')}
              {field('brandColor', 'Brand Color (hex)')}
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Add Gallery Image URL</label>
              <div className="flex gap-2">
                <input type="url" className="input flex-1" value={galleryInput} onChange={(e) => setGalleryInput(e.target.value)} placeholder="https://..." />
                <button type="button" className="btn-primary" disabled={!galleryInput || locked} onClick={() => save()}>Add</button>
              </div>
              {branding?.galleryUrls && branding.galleryUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {branding.galleryUrls.map((url) => (
                    <img key={url} src={url} alt="" className="h-16 w-16 object-cover rounded-lg border" />
                  ))}
                </div>
              )}
            </div>
          </div>

          {branding?.branches && branding.branches.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold mb-2">Branch Logos</h3>
              <p className="text-sm text-gray-500 mb-4">Optional branch logos fall back to main hospital logo when not set.</p>
              <div className="space-y-2">
                {branding.branches.map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                    <span>{branch.name}</span>
                    {branch.logoUrl ? (
                      <img src={branch.logoUrl} alt="" className="h-8 object-contain" />
                    ) : (
                      <span className="text-gray-400">Uses main logo</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Logo Preview</h3>
            <div className="p-4 bg-white border rounded-lg mb-3">
              <p className="text-xs text-gray-400 mb-2">Light background</p>
              {b && <HospitalLogo organization={{ branding: b }} size="lg" showName />}
            </div>
            <div className="p-4 bg-gray-900 rounded-lg">
              <p className="text-xs text-gray-400 mb-2">Dark background</p>
              {b && <HospitalLogo organization={{ branding: b }} size="lg" showName darkBackground nameClassName="text-white" />}
            </div>
            {b?.coverImageUrl && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-2">Cover image</p>
                <img src={b.coverImageUrl} alt="Cover" className="w-full h-32 object-cover rounded-lg" />
              </div>
            )}
          </div>

          {branding?.requirements && (
            <div className="card p-6 text-sm text-gray-600">
              <h3 className="font-semibold text-gray-900 mb-3">Logo Requirements</h3>
              <ul className="space-y-1 list-disc list-inside">
                <li>Recommended: {branding.requirements.recommendedFormats.join(', ')}</li>
                <li>Allowed: {branding.requirements.allowedFormats.join(', ')}</li>
                <li>Max size: {branding.requirements.maxFileSizeMb} MB</li>
                <li>Min resolution: {branding.requirements.minWidth}×{branding.requirements.minHeight}px</li>
                <li>Transparent background supported</li>
              </ul>
            </div>
          )}

          {branding?.history && branding.history.length > 0 && (
            <div className="card p-6">
              <h3 className="font-semibold mb-3">Logo History</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {branding.history.map((h) => (
                  <div key={h.id} className="flex items-center gap-3 text-sm">
                    <img src={h.logoUrl} alt="" className="h-8 w-8 object-contain rounded border" />
                    <div>
                      <p className="font-medium">{h.action}</p>
                      <p className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
