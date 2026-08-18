import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

const subNav = [
  { to: '/admin/master-data', label: 'Overview', end: true },
  { to: '/admin/master-data/specializations', label: 'Specializations' },
  { to: '/admin/master-data/departments', label: 'Departments' },
  { to: '/admin/master-data/services', label: 'Services' },
  { to: '/admin/master-data/diagnostic-tests', label: 'Diagnostic Tests' },
  { to: '/admin/master-data/medicines', label: 'Medicines' },
  { to: '/admin/master-data/service-categories', label: 'Service Categories' },
  { to: '/admin/master-data/test-categories', label: 'Test Categories' },
  { to: '/admin/master-data/hospital-types', label: 'Hospital Types' },
  { to: '/admin/master-data/clinic-types', label: 'Clinic Types' },
  { to: '/admin/master-data/facilities', label: 'Facilities' },
  { to: '/admin/master-data/health-package-categories', label: 'Package Categories' },
  { to: '/admin/master-data/insurance-providers', label: 'Insurance' },
  { to: '/admin/master-data/qualifications', label: 'Qualifications' },
  { to: '/admin/master-data/staff-roles', label: 'Staff Roles' },
  { to: '/admin/locations', label: 'Locations', external: true },
];

function MasterDataLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Healthcare Master Data" subtitle="Central catalog for specializations, services, tests, medicines, and more" />
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

type FieldDef = { key: string; label: string; type?: 'text' | 'number' | 'select' | 'textarea'; options?: { value: string; label: string }[]; col?: string };

type SectionConfig = {
  endpoint: string;
  title: string;
  subtitle: string;
  columns: { key: string; label: string; render?: (r: Record<string, unknown>) => React.ReactNode }[];
  fields: FieldDef[];
  emptyForm: Record<string, string | number>;
  parseForm?: (form: Record<string, string | number>) => Record<string, unknown>;
  openForm?: (row: Record<string, unknown>) => Record<string, string | number>;
};

function MasterDataSection({ config }: { config: SectionConfig }) {
  const qc = useQueryClient();
  const key = ['master', config.endpoint];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api.get(`/admin/master-data/${config.endpoint}`) });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(config.emptyForm);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = (data?.data as Record<string, unknown>[]) || [];
  const refetch = () => qc.invalidateQueries({ queryKey: key });

  const save = async () => {
    const payload = config.parseForm ? config.parseForm(form) : { ...form };
    if (editing?.id) await api.patch(`/admin/master-data/${config.endpoint}/${editing.id}`, payload);
    else await api.post(`/admin/master-data/${config.endpoint}`, payload);
    setEditing(null);
    setForm(config.emptyForm);
    refetch();
  };

  const openEdit = (row: Record<string, unknown>) => {
    setEditing(row);
    setForm(config.openForm ? config.openForm(row) : {
      name: String(row.name || ''),
      description: String(row.description || ''),
      ...(row as Record<string, string | number>),
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkAction = async (action: 'activate' | 'deactivate') => {
    if (selected.size === 0) return;
    await api.post(`/admin/master-data/${config.endpoint}/bulk-${action}`, { ids: Array.from(selected) });
    setSelected(new Set());
    refetch();
  };

  const exportCsv = async () => {
    const token = localStorage.getItem('accessToken');
    const base = import.meta.env.VITE_API_URL || '/api/v1';
    const res = await fetch(`${base}/admin/master-data/${config.endpoint}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.endpoint}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MasterDataLayout>
      <div className="flex flex-wrap justify-between gap-2 mb-4">
        <div>
          <h2 className="font-semibold text-lg">{config.title}</h2>
          <p className="text-sm text-gray-500">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.size > 0 && (
            <>
              <button className="btn-secondary text-xs" onClick={() => bulkAction('activate')}>Bulk Activate ({selected.size})</button>
              <button className="btn-secondary text-xs" onClick={() => bulkAction('deactivate')}>Bulk Deactivate ({selected.size})</button>
            </>
          )}
          <button className="btn-secondary text-xs" onClick={exportCsv}>Export CSV</button>
          <button className="btn-primary text-sm" onClick={() => { setEditing({}); setForm(config.emptyForm); }}>+ Add</button>
        </div>
      </div>

      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'select', label: '', render: (r) => (
            <input type="checkbox" checked={selected.has(r.id as string)} onChange={() => toggleSelect(r.id as string)} />
          )},
          ...config.columns,
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'CANCELLED'} /> },
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex flex-wrap gap-2">
              <ActionBtn onClick={() => openEdit(r)}>Edit</ActionBtn>
              {r.isActive
                ? <ActionBtn variant="danger" onClick={() => api.patch(`/admin/master-data/${config.endpoint}/${r.id}/deactivate`).then(refetch)}>Deactivate</ActionBtn>
                : <ActionBtn variant="success" onClick={() => api.patch(`/admin/master-data/${config.endpoint}/${r.id}/activate`).then(refetch)}>Activate</ActionBtn>}
              <ActionBtn variant="danger" onClick={() => { if (confirm('Delete? Deactivated items are preferred for data integrity.')) api.delete(`/admin/master-data/${config.endpoint}/${r.id}`).then(refetch); }}>Delete</ActionBtn>
            </div>
          )},
        ]} rows={rows} />
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold mb-4">{editing.id ? 'Edit' : 'Add'} {config.title.replace(/s$/, '')}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {config.fields.map((f) => (
                <div key={f.key} className={f.col === 'full' ? 'col-span-2' : ''}>
                  <label className="text-xs text-gray-500">{f.label}</label>
                  {f.type === 'select' ? (
                    <select className="input w-full" value={String(form[f.key] || '')} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                      <option value="">Select</option>
                      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea className="input w-full" rows={3} value={String(form[f.key] || '')} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  ) : (
                    <input type={f.type || 'text'} className="input w-full" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })} />
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">Deactivating preserves existing records; item won&apos;t appear in new selections.</p>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-secondary text-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary text-sm" disabled={!form.name} onClick={save}>{editing.id ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </MasterDataLayout>
  );
}

const simpleFields: FieldDef[] = [
  { key: 'name', label: 'Name', col: 'full' },
  { key: 'description', label: 'Description', type: 'textarea', col: 'full' },
];

function OverviewPage() {
  const { data, isLoading } = useQuery({ queryKey: ['master-overview'], queryFn: () => api.get('/admin/master-data/overview') });
  const o = data?.data as Record<string, number> | undefined;
  if (isLoading) return <MasterDataLayout><LoadingState /></MasterDataLayout>;
  return (
    <MasterDataLayout>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Specializations', value: o?.specializations, to: '/admin/master-data/specializations' },
          { label: 'Departments', value: o?.departments, to: '/admin/master-data/departments' },
          { label: 'Services', value: o?.services, to: '/admin/master-data/services' },
          { label: 'Diagnostic Tests', value: o?.diagnosticTests, to: '/admin/master-data/diagnostic-tests' },
          { label: 'Medicines', value: o?.medicines, to: '/admin/master-data/medicines' },
          { label: 'Insurance Providers', value: o?.insuranceProviders, to: '/admin/master-data/insurance-providers' },
          { label: 'Qualifications', value: o?.qualifications, to: '/admin/master-data/qualifications' },
          { label: 'Staff Roles', value: o?.staffRoles, to: '/admin/master-data/staff-roles' },
        ].map((s) => (
          <Link key={s.label} to={s.to} className="card p-5 hover:ring-2 hover:ring-primary-200 transition-all">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-primary-600 mt-1">{s.value ?? 0}</p>
          </Link>
        ))}
      </div>
      <div className="card p-6 mt-6">
        <h3 className="font-semibold mb-2">Data Integrity Policy</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>✓ Deactivate instead of delete to preserve historical records</li>
          <li>✓ Master data is for catalog/reference — not a replacement for clinical judgment</li>
          <li>✓ Changes reflect immediately in platform dropdowns and searches</li>
          <li>✓ Bulk activate/deactivate and CSV export available per section</li>
        </ul>
      </div>
    </MasterDataLayout>
  );
}

function ServicesPage() {
  const { data: cats } = useQuery({ queryKey: ['master', 'service-categories'], queryFn: () => api.get('/admin/master-data/service-categories') });
  const options = ((cats?.data as { id: string; name: string }[]) || []).map((c) => ({ value: c.id, label: c.name }));
  return (
    <MasterDataSection config={{
      endpoint: 'services',
      title: 'Healthcare Services',
      subtitle: 'Central service catalog hospitals can select in CRM',
      columns: [
        { key: 'name', label: 'Service' },
        { key: 'category', label: 'Category', render: (r) => String((r.category as { name?: string })?.name || '-') },
        { key: 'defaultPrice', label: 'Price', render: (r) => r.defaultPrice ? formatCurrency(r.defaultPrice as number) : '-' },
        { key: 'duration', label: 'Duration (min)', render: (r) => String(r.duration || '-') },
      ],
      fields: [
        { key: 'name', label: 'Service Name', col: 'full' },
        { key: 'categoryId', label: 'Category', type: 'select', options, col: 'full' },
        { key: 'description', label: 'Description', type: 'textarea', col: 'full' },
        { key: 'defaultPrice', label: 'Default Price', type: 'number' },
        { key: 'duration', label: 'Duration (minutes)', type: 'number' },
      ],
      emptyForm: { name: '', categoryId: '', description: '', defaultPrice: 0, duration: 30 },
      parseForm: (f) => ({ ...f, defaultPrice: f.defaultPrice ? Number(f.defaultPrice) : undefined, duration: f.duration ? Number(f.duration) : undefined, categoryId: f.categoryId || undefined }),
      openForm: (r) => ({ name: String(r.name), categoryId: String((r.category as { id?: string })?.id || ''), description: String(r.description || ''), defaultPrice: Number(r.defaultPrice || 0), duration: Number(r.duration || 30) }),
    }} />
  );
}

function DiagnosticTestsPage() {
  const { data: cats } = useQuery({ queryKey: ['master', 'test-categories'], queryFn: () => api.get('/admin/master-data/test-categories') });
  const options = ((cats?.data as { id: string; name: string; group?: string }[]) || []).map((c) => ({ value: c.id, label: `${c.group ? c.group + ' → ' : ''}${c.name}` }));
  return (
    <MasterDataSection config={{
      endpoint: 'diagnostic-tests',
      title: 'Diagnostic Tests',
      subtitle: 'Central test catalog with sample type and preparation info',
      columns: [
        { key: 'name', label: 'Test' },
        { key: 'category', label: 'Category', render: (r) => String((r.category as { name?: string })?.name || '-') },
        { key: 'sampleType', label: 'Sample' },
        { key: 'defaultPrice', label: 'Price', render: (r) => r.defaultPrice ? formatCurrency(r.defaultPrice as number) : '-' },
      ],
      fields: [
        { key: 'name', label: 'Test Name', col: 'full' },
        { key: 'categoryId', label: 'Category', type: 'select', options, col: 'full' },
        { key: 'sampleType', label: 'Sample Type' },
        { key: 'defaultPrice', label: 'Default Price', type: 'number' },
        { key: 'preparation', label: 'Preparation', type: 'textarea', col: 'full' },
      ],
      emptyForm: { name: '', categoryId: '', sampleType: '', preparation: '', defaultPrice: 0 },
      parseForm: (f) => ({ ...f, defaultPrice: f.defaultPrice ? Number(f.defaultPrice) : undefined, categoryId: f.categoryId || undefined }),
      openForm: (r) => ({ name: String(r.name), categoryId: String((r.category as { id?: string })?.id || ''), sampleType: String(r.sampleType || ''), preparation: String(r.preparation || ''), defaultPrice: Number(r.defaultPrice || 0) }),
    }} />
  );
}

export function AdminMasterDataPage() {
  return (
    <Routes>
      <Route index element={<OverviewPage />} />
      <Route path="specializations" element={
        <MasterDataSection config={{
          endpoint: 'specializations', title: 'Specializations', subtitle: 'Doctor specialties',
          columns: [{ key: 'name', label: 'Specialization' }, { key: 'department', label: 'Department' }],
          fields: [...simpleFields, { key: 'department', label: 'Department' }, { key: 'services', label: 'Services (comma-separated)', col: 'full' }],
          emptyForm: { name: '', description: '', department: '', services: '' },
          parseForm: (f) => ({ ...f, services: String(f.services).split(',').map((s) => s.trim()).filter(Boolean) }),
          openForm: (r) => ({ name: String(r.name), description: String(r.description || ''), department: String(r.department || ''), services: (r.services as string[])?.join(', ') || '' }),
        }} />
      } />
      <Route path="departments" element={<MasterDataSection config={{ endpoint: 'departments', title: 'Departments', subtitle: 'Hospital and clinic departments', columns: [{ key: 'name', label: 'Department' }], fields: simpleFields, emptyForm: { name: '', description: '' } }} />} />
      <Route path="services" element={<ServicesPage />} />
      <Route path="diagnostic-tests" element={<DiagnosticTestsPage />} />
      <Route path="medicines" element={
        <MasterDataSection config={{
          endpoint: 'medicines', title: 'Medicines', subtitle: 'Medicine catalog — hospitals use clinical judgment for prescriptions',
          columns: [
            { key: 'name', label: 'Medicine' },
            { key: 'genericName', label: 'Generic' },
            { key: 'dosageForm', label: 'Form' },
            { key: 'strength', label: 'Strength' },
          ],
          fields: [
            { key: 'name', label: 'Medicine Name', col: 'full' },
            { key: 'genericName', label: 'Generic Name' },
            { key: 'brandName', label: 'Brand Name' },
            { key: 'category', label: 'Category' },
            { key: 'dosageForm', label: 'Dosage Form' },
            { key: 'strength', label: 'Strength' },
            { key: 'manufacturer', label: 'Manufacturer' },
            { key: 'unit', label: 'Unit' },
          ],
          emptyForm: { name: '', genericName: '', brandName: '', category: '', dosageForm: '', strength: '', manufacturer: '', unit: '' },
        }} />
      } />
      <Route path="service-categories" element={<MasterDataSection config={{ endpoint: 'service-categories', title: 'Service Categories', subtitle: 'Consultation, Diagnostic, Laboratory, etc.', columns: [{ key: 'name', label: 'Category' }], fields: simpleFields, emptyForm: { name: '', description: '' } }} />} />
      <Route path="test-categories" element={
        <MasterDataSection config={{
          endpoint: 'test-categories', title: 'Test Categories', subtitle: 'Laboratory and imaging categories',
          columns: [{ key: 'name', label: 'Category' }, { key: 'group', label: 'Group' }, { key: 'parent', label: 'Parent', render: (r) => String((r.parent as { name?: string })?.name || '-') }],
          fields: [{ key: 'name', label: 'Name', col: 'full' }, { key: 'group', label: 'Group (e.g. Laboratory, Imaging)' }],
          emptyForm: { name: '', group: '' },
        }} />
      } />
      <Route path="hospital-types" element={<MasterDataSection config={{ endpoint: 'hospital-types', title: 'Hospital Types', subtitle: 'General, Multi-Specialty, Government, etc.', columns: [{ key: 'name', label: 'Type' }], fields: simpleFields, emptyForm: { name: '', description: '' } }} />} />
      <Route path="clinic-types" element={<MasterDataSection config={{ endpoint: 'clinic-types', title: 'Clinic Types', subtitle: 'General, Dental, Eye, Pediatric, etc.', columns: [{ key: 'name', label: 'Type' }], fields: simpleFields, emptyForm: { name: '', description: '' } }} />} />
      <Route path="facilities" element={<MasterDataSection config={{ endpoint: 'facilities', title: 'Facilities', subtitle: 'Emergency, ICU, Pharmacy, Ambulance, etc.', columns: [{ key: 'name', label: 'Facility' }], fields: simpleFields, emptyForm: { name: '', description: '' } }} />} />
      <Route path="health-package-categories" element={<MasterDataSection config={{ endpoint: 'health-package-categories', title: 'Health Package Categories', subtitle: 'Full Body, Senior Citizen, Diabetes, etc.', columns: [{ key: 'name', label: 'Category' }], fields: simpleFields, emptyForm: { name: '', description: '' } }} />} />
      <Route path="insurance-providers" element={
        <MasterDataSection config={{
          endpoint: 'insurance-providers', title: 'Insurance Providers', subtitle: 'Insurance companies hospitals can accept',
          columns: [{ key: 'name', label: 'Provider' }, { key: 'contact', label: 'Contact' }, { key: 'website', label: 'Website' }],
          fields: [{ key: 'name', label: 'Provider Name', col: 'full' }, { key: 'contact', label: 'Contact' }, { key: 'website', label: 'Website' }, { key: 'logoUrl', label: 'Logo URL', col: 'full' }],
          emptyForm: { name: '', contact: '', website: '', logoUrl: '' },
        }} />
      } />
      <Route path="qualifications" element={
        <MasterDataSection config={{
          endpoint: 'qualifications', title: 'Doctor Qualifications', subtitle: 'MBBS, MD, MS, BDS, etc.',
          columns: [{ key: 'name', label: 'Qualification' }, { key: 'shortName', label: 'Short' }],
          fields: [{ key: 'name', label: 'Qualification', col: 'full' }, { key: 'shortName', label: 'Short Name' }, { key: 'description', label: 'Description', type: 'textarea', col: 'full' }],
          emptyForm: { name: '', shortName: '', description: '' },
        }} />
      } />
      <Route path="staff-roles" element={
        <MasterDataSection config={{
          endpoint: 'staff-roles', title: 'Staff Roles', subtitle: 'Standard platform staff roles',
          columns: [{ key: 'name', label: 'Role' }, { key: 'code', label: 'Code' }],
          fields: [{ key: 'name', label: 'Role Name', col: 'full' }, { key: 'code', label: 'Code' }, { key: 'description', label: 'Description', type: 'textarea', col: 'full' }],
          emptyForm: { name: '', code: '', description: '' },
        }} />
      } />
      <Route path="*" element={<Navigate to="/admin/master-data" replace />} />
    </Routes>
  );
}
