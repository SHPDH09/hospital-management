import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

const subNav = [
  { to: '/admin/cms', label: 'Dashboard', end: true },
  { to: '/admin/cms/homepage', label: 'Homepage' },
  { to: '/admin/cms/pages', label: 'Pages' },
  { to: '/admin/cms/blogs', label: 'Blog' },
  { to: '/admin/cms/banners', label: 'Banners' },
  { to: '/admin/cms/featured', label: 'Featured' },
  { to: '/admin/cms/faqs', label: 'FAQs' },
  { to: '/admin/cms/testimonials', label: 'Testimonials' },
  { to: '/admin/cms/promotions', label: 'Promotions' },
  { to: '/admin/cms/media', label: 'Media' },
  { to: '/admin/cms/menu', label: 'Menu' },
  { to: '/admin/cms/footer', label: 'Footer' },
  { to: '/admin/cms/health-articles', label: 'Health Articles' },
  { to: '/admin/cms/legal', label: 'Legal Pages' },
  { to: '/admin/cms/locations', label: 'Location Pages' },
  { to: '/admin/cms/scheduled', label: 'Scheduled' },
  { to: '/admin/cms/versions', label: 'Version History' },
];

function CmsLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="CMS Management" subtitle="Website content, homepage, blog, SEO, and media" />
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
  const { data, isLoading } = useQuery({ queryKey: ['cms-dash'], queryFn: () => api.get('/admin/cms/dashboard') });
  const d = data?.data as Record<string, unknown> | undefined;
  const last = d?.lastUpdated as { title?: string; updatedAt?: string } | undefined;
  if (isLoading) return <CmsLayout><LoadingState /></CmsLayout>;
  return (
    <CmsLayout>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Pages', value: d?.totalPages },
          { label: 'Published', value: d?.publishedPages },
          { label: 'Drafts', value: d?.draftPages },
          { label: 'Blog Posts', value: d?.blogPosts },
          { label: 'FAQs', value: d?.faqs },
          { label: 'Banners', value: d?.banners },
          { label: 'Promotions', value: d?.activePromotions },
          { label: 'Scheduled', value: d?.scheduledContent },
        ].map((s) => (
          <div key={s.label} className="card p-5 text-center">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold text-primary-600 mt-1">{String(s.value ?? 0)}</p>
          </div>
        ))}
      </div>
      {last && (
        <div className="card p-4 text-sm text-gray-600">
          Last updated: <strong>{last.title}</strong> — {formatDate(last.updatedAt || '')}
        </div>
      )}
    </CmsLayout>
  );
}

type CrudConfig = {
  endpoint: string;
  title: string;
  columns: { key: string; label: string; render?: (r: Record<string, unknown>) => React.ReactNode }[];
  fields: { key: string; label: string; type?: 'text' | 'textarea' }[];
  empty: Record<string, string>;
  extraActions?: (r: Record<string, unknown>, refetch: () => void) => React.ReactNode;
};

function CrudSection({ config }: { config: CrudConfig }) {
  const qc = useQueryClient();
  const key = ['cms', config.endpoint];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api.get(`/admin/cms/${config.endpoint}`) });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(config.empty);
  const refetch = () => qc.invalidateQueries({ queryKey: key });

  const save = async () => {
    if (editing?.id) await api.patch(`/admin/cms/${config.endpoint}/${editing.id}`, form);
    else await api.post(`/admin/cms/${config.endpoint}`, form);
    setEditing(null); setForm(config.empty); refetch();
  };

  return (
    <CmsLayout>
      <div className="flex justify-between mb-4">
        <h2 className="font-semibold text-lg">{config.title}</h2>
        <button className="btn-primary text-sm" onClick={() => { setEditing({}); setForm(config.empty); }}>+ Add</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          ...config.columns,
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex gap-2">
              <ActionBtn onClick={() => { setEditing(r); const f = { ...config.empty }; config.fields.forEach((fld) => { f[fld.key] = String(r[fld.key] || ''); }); setForm(f); }}>Edit</ActionBtn>
              {config.extraActions?.(r, refetch)}
              <ActionBtn variant="danger" onClick={() => { if (confirm('Delete?')) api.delete(`/admin/cms/${config.endpoint}/${r.id}`).then(refetch); }}>Delete</ActionBtn>
            </div>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold mb-4">{editing.id ? 'Edit' : 'Create'}</h3>
            <div className="space-y-3">
              {config.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500">{f.label}</label>
                  {f.type === 'textarea' ? (
                    <textarea className="input w-full" rows={4} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  ) : (
                    <input className="input w-full" value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-secondary text-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary text-sm" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </CmsLayout>
  );
}

function PagesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['cms', 'pages'], queryFn: () => api.get('/admin/cms/pages') });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ slug: '', title: '', content: '', metaTitle: '', metaDescription: '', keywords: '' });
  const refetch = () => qc.invalidateQueries({ queryKey: ['cms', 'pages'] });

  const save = async () => {
    if (editing?.id) await api.patch(`/admin/cms/pages/${editing.id}`, form);
    else await api.post('/admin/cms/pages', form);
    setEditing(null); refetch();
  };

  return (
    <CmsLayout>
      <div className="flex justify-between mb-4">
        <h2 className="font-semibold text-lg">Pages Management</h2>
        <button className="btn-primary text-sm" onClick={() => { setEditing({}); setForm({ slug: '', title: '', content: '', metaTitle: '', metaDescription: '', keywords: '' }); }}>+ Create Page</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'title', label: 'Page' },
          { key: 'slug', label: 'Slug' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.isPublished ? 'PUBLISHED' : 'DRAFT'} /> },
          { key: 'updatedAt', label: 'Updated', render: (r) => formatDate(r.updatedAt as string) },
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex flex-wrap gap-2">
              <ActionBtn onClick={() => { setEditing(r); setForm({ slug: String(r.slug), title: String(r.title), content: String(r.content), metaTitle: String(r.metaTitle || ''), metaDescription: String(r.metaDescription || ''), keywords: String(r.keywords || '') }); }}>Edit</ActionBtn>
              {!r.isPublished && <ActionBtn variant="success" onClick={() => api.post(`/admin/cms/pages/${r.id}/publish`).then(refetch)}>Publish</ActionBtn>}
              {r.isPublished ? <ActionBtn onClick={() => api.post(`/admin/cms/pages/${r.id}/unpublish`).then(refetch)}>Unpublish</ActionBtn> : null}
              <ActionBtn onClick={() => api.post(`/admin/cms/pages/${r.id}/duplicate`).then(refetch)}>Duplicate</ActionBtn>
            </div>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold mb-4">{editing.id ? 'Edit Page' : 'Create Page'}</h3>
            <div className="grid grid-cols-2 gap-3">
              {(['slug', 'title', 'metaTitle', 'metaDescription', 'keywords'] as const).map((f) => (
                <div key={f} className={f === 'metaDescription' ? 'col-span-2' : ''}>
                  <label className="text-xs text-gray-500">{f}</label>
                  <input className="input w-full" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Content</label>
                <textarea className="input w-full" rows={8} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-secondary text-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary text-sm" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </CmsLayout>
  );
}

function HomepagePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['cms', 'homepage'], queryFn: () => api.get('/admin/cms/homepage') });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [content, setContent] = useState('');
  const refetch = () => qc.invalidateQueries({ queryKey: ['cms', 'homepage'] });

  const toggle = async (id: string, isVisible: boolean) => {
    await api.patch(`/admin/cms/homepage/${id}`, { isVisible: !isVisible });
    refetch();
  };

  return (
    <CmsLayout>
      <p className="text-sm text-gray-500 mb-4">Control homepage sections — edit content, show/hide, and reorder.</p>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'title', label: 'Section' },
          { key: 'key', label: 'Key' },
          { key: 'visible', label: 'Visible', render: (r) => <StatusBadge status={r.isVisible ? 'ACTIVE' : 'CANCELLED'} /> },
          { key: 'order', label: 'Order', render: (r) => String(r.sortOrder) },
          { key: 'actions', label: 'Actions', render: (r) => (
            <div className="flex gap-2">
              <ActionBtn onClick={() => { setEditing(r); setContent(JSON.stringify(r.content || {}, null, 2)); }}>Edit</ActionBtn>
              <ActionBtn onClick={() => toggle(r.id as string, r.isVisible as boolean)}>{r.isVisible ? 'Hide' : 'Show'}</ActionBtn>
            </div>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h3 className="font-semibold mb-4">Edit: {String(editing.title)}</h3>
            <textarea className="input w-full font-mono text-xs" rows={10} value={content} onChange={(e) => setContent(e.target.value)} />
            <div className="flex gap-2 justify-end mt-4">
              <button className="btn-secondary text-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-primary text-sm" onClick={() => {
                try {
                  api.patch(`/admin/cms/homepage/${editing.id}`, { content: JSON.parse(content) }).then(() => { setEditing(null); refetch(); });
                } catch { alert('Invalid JSON'); }
              }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </CmsLayout>
  );
}

function FeaturedPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['cms', 'featured'], queryFn: () => api.get('/admin/cms/featured') });
  const [form, setForm] = useState({ itemType: 'HOSPITAL', refName: '', refId: '' });
  const refetch = () => qc.invalidateQueries({ queryKey: ['cms', 'featured'] });

  return (
    <CmsLayout>
      <div className="card p-4 mb-4 flex flex-wrap gap-2 items-end">
        <select className="input" value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value })}>
          {['HOSPITAL', 'CLINIC', 'DOCTOR', 'SERVICE', 'PACKAGE'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="input flex-1" placeholder="Name" value={form.refName} onChange={(e) => setForm({ ...form, refName: e.target.value })} />
        <input className="input flex-1" placeholder="Reference ID (optional)" value={form.refId} onChange={(e) => setForm({ ...form, refId: e.target.value })} />
        <button className="btn-primary text-sm" onClick={() => api.post('/admin/cms/featured', form).then(refetch)}>Add Featured</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'itemType', label: 'Type' },
          { key: 'refName', label: 'Name' },
          { key: 'actions', label: 'Actions', render: (r) => (
            <ActionBtn variant="danger" onClick={() => api.delete(`/admin/cms/featured/${r.id}`).then(refetch)}>Remove</ActionBtn>
          )},
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </CmsLayout>
  );
}

function VersionsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['cms-versions'], queryFn: () => api.get('/admin/cms/versions') });
  return (
    <CmsLayout>
      <p className="text-sm text-gray-500 mb-4">Audit trail of CMS changes — who changed what and when.</p>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'entity', label: 'Entity', render: (r) => `${r.entityType} / ${String(r.entityId).slice(0, 8)}` },
          { key: 'version', label: 'Version' },
          { key: 'by', label: 'Changed By', render: (r) => String(r.changedBy || 'System') },
          { key: 'note', label: 'Note', render: (r) => String(r.changeNote || '-') },
          { key: 'date', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </CmsLayout>
  );
}

function ScheduledPage() {
  const { data, isLoading } = useQuery({ queryKey: ['cms-scheduled'], queryFn: () => api.get('/admin/cms/scheduled') });
  const d = data?.data as { pages?: Record<string, unknown>[]; blogs?: Record<string, unknown>[] } | undefined;
  return (
    <CmsLayout>
      {isLoading ? <LoadingState /> : (
        <>
          <h3 className="font-medium mb-2">Scheduled Pages</h3>
          <AdminTable columns={[
            { key: 'title', label: 'Title' },
            { key: 'publishAt', label: 'Publish At', render: (r) => r.publishAt ? formatDate(r.publishAt as string) : '-' },
          ]} rows={d?.pages || []} emptyMessage="No scheduled pages" />
          <h3 className="font-medium mb-2 mt-6">Scheduled Blogs</h3>
          <AdminTable columns={[
            { key: 'title', label: 'Title' },
            { key: 'publishAt', label: 'Publish At', render: (r) => r.publishAt ? formatDate(r.publishAt as string) : '-' },
          ]} rows={d?.blogs || []} emptyMessage="No scheduled blogs" />
        </>
      )}
    </CmsLayout>
  );
}

function LegalPage() {
  const { data, isLoading } = useQuery({ queryKey: ['cms-legal'], queryFn: () => api.get('/admin/cms/legal') });
  return (
    <CmsLayout>
      <p className="text-sm text-gray-500 mb-4">Terms, Privacy, Cookie Policy — versioned legal content.</p>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'title', label: 'Document' },
          { key: 'slug', label: 'Slug' },
          { key: 'version', label: 'Version' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.isPublished ? 'PUBLISHED' : 'DRAFT'} /> },
          { key: 'updatedAt', label: 'Updated', render: (r) => formatDate(r.updatedAt as string) },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </CmsLayout>
  );
}

export function AdminCmsPage() {
  return (
    <Routes>
      <Route index element={<DashboardPage />} />
      <Route path="homepage" element={<HomepagePage />} />
      <Route path="pages" element={<PagesPage />} />
      <Route path="blogs" element={<CrudSection config={{
        endpoint: 'blogs', title: 'Blog Management',
        columns: [{ key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> }],
        fields: [{ key: 'title', label: 'Title' }, { key: 'slug', label: 'Slug' }, { key: 'category', label: 'Category' }, { key: 'author', label: 'Author' }, { key: 'content', label: 'Content', type: 'textarea' }],
        empty: { title: '', slug: '', category: '', author: '', content: '' },
        extraActions: (r, ref) => r.status !== 'PUBLISHED' ? <ActionBtn variant="success" onClick={() => api.post(`/admin/cms/blogs/${r.id}/publish`).then(ref)}>Publish</ActionBtn> : null,
      }} />} />
      <Route path="banners" element={<CrudSection config={{
        endpoint: 'banners', title: 'Banner Management',
        columns: [{ key: 'title', label: 'Title' }, { key: 'bannerType', label: 'Type' }, { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'CANCELLED'} /> }],
        fields: [{ key: 'title', label: 'Title' }, { key: 'bannerType', label: 'Type' }, { key: 'imageUrl', label: 'Image URL' }, { key: 'ctaText', label: 'CTA Text' }, { key: 'ctaLink', label: 'CTA Link' }],
        empty: { title: '', bannerType: 'HOMEPAGE', imageUrl: '', ctaText: '', ctaLink: '' },
      }} />} />
      <Route path="featured" element={<FeaturedPage />} />
      <Route path="faqs" element={<CrudSection config={{
        endpoint: 'faqs', title: 'FAQ Management',
        columns: [{ key: 'question', label: 'Question' }, { key: 'category', label: 'Category' }],
        fields: [{ key: 'question', label: 'Question' }, { key: 'answer', label: 'Answer', type: 'textarea' }, { key: 'category', label: 'Category' }],
        empty: { question: '', answer: '', category: 'General' },
      }} />} />
      <Route path="testimonials" element={<CrudSection config={{
        endpoint: 'testimonials', title: 'Testimonials',
        columns: [{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'rating', label: 'Rating' }],
        fields: [{ key: 'name', label: 'Name' }, { key: 'role', label: 'Role' }, { key: 'content', label: 'Testimonial', type: 'textarea' }],
        empty: { name: '', role: '', content: '' },
        extraActions: (r, ref) => <ActionBtn variant="success" onClick={() => api.post(`/admin/cms/testimonials/${r.id}/approve`).then(ref)}>Approve</ActionBtn>,
      }} />} />
      <Route path="promotions" element={<CrudSection config={{
        endpoint: 'promotions', title: 'Promotional Content',
        columns: [{ key: 'title', label: 'Title' }, { key: 'promoType', label: 'Type' }],
        fields: [{ key: 'title', label: 'Title' }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'ctaText', label: 'CTA' }, { key: 'ctaLink', label: 'Link' }],
        empty: { title: '', description: '', ctaText: '', ctaLink: '' },
      }} />} />
      <Route path="media" element={<CrudSection config={{
        endpoint: 'media', title: 'Media Library',
        columns: [{ key: 'filename', label: 'File' }, { key: 'folder', label: 'Folder' }, { key: 'url', label: 'URL', render: (r) => <a href={String(r.url)} target="_blank" rel="noreferrer" className="text-primary-600 text-xs">View</a> }],
        fields: [{ key: 'filename', label: 'Filename' }, { key: 'url', label: 'URL' }, { key: 'folder', label: 'Folder' }, { key: 'altText', label: 'Alt Text' }],
        empty: { filename: '', url: '', folder: 'general', altText: '' },
      }} />} />
      <Route path="menu" element={<CrudSection config={{
        endpoint: 'menu', title: 'Menu Management',
        columns: [{ key: 'label', label: 'Label' }, { key: 'url', label: 'URL' }, { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'CANCELLED'} /> }],
        fields: [{ key: 'label', label: 'Label' }, { key: 'url', label: 'URL' }],
        empty: { label: '', url: '' },
      }} />} />
      <Route path="footer" element={<CrudSection config={{
        endpoint: 'footer', title: 'Footer Management',
        columns: [{ key: 'section', label: 'Section' }, { key: 'label', label: 'Label' }, { key: 'url', label: 'URL' }],
        fields: [{ key: 'section', label: 'Section' }, { key: 'label', label: 'Label' }, { key: 'url', label: 'URL' }],
        empty: { section: 'Company', label: '', url: '' },
      }} />} />
      <Route path="health-articles" element={<CrudSection config={{
        endpoint: 'health-articles', title: 'Health Articles & Tips',
        columns: [{ key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> }],
        fields: [{ key: 'title', label: 'Title' }, { key: 'slug', label: 'Slug' }, { key: 'category', label: 'Category' }, { key: 'content', label: 'Content', type: 'textarea' }],
        empty: { title: '', slug: '', category: 'Wellness', content: '' },
      }} />} />
      <Route path="legal" element={<LegalPage />} />
      <Route path="locations" element={<CrudSection config={{
        endpoint: 'location-pages', title: 'Location-Based Content',
        columns: [{ key: 'title', label: 'Page' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State' }],
        fields: [{ key: 'title', label: 'Title' }, { key: 'slug', label: 'Slug' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'content', label: 'Content', type: 'textarea' }],
        empty: { title: '', slug: '', city: '', state: '', content: '' },
      }} />} />
      <Route path="scheduled" element={<ScheduledPage />} />
      <Route path="versions" element={<VersionsPage />} />
      <Route path="*" element={<Navigate to="/admin/cms" replace />} />
    </Routes>
  );
}
