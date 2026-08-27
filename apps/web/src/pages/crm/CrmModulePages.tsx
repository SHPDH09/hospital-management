import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

function CrmPage({ title, subtitle, endpoint, columns, emptyMessage = 'No data found' }: {
  title: string;
  subtitle?: string;
  endpoint: string;
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => React.ReactNode }[];
  emptyMessage?: string;
}) {
  const { data, isLoading } = useQuery({ queryKey: [endpoint], queryFn: () => api.get(endpoint) });
  const rows = (data?.data as Record<string, unknown>[] | undefined) || (data?.data as { items?: Record<string, unknown>[] })?.items || [];
  const list = Array.isArray(rows) ? rows : [];

  return (
    <DashboardLayout portal="crm">
      <PageHeader title={title} subtitle={subtitle} />
      {isLoading ? <LoadingState /> : <AdminTable columns={columns} rows={list} emptyMessage={emptyMessage} />}
    </DashboardLayout>
  );
}

// ─── Hospital Profile ────────────────────────────────────────────────────────

export function CrmProfilePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-profile'], queryFn: () => api.get('/crm/profile') });
  const org = data?.data as Record<string, unknown> | undefined;
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const field = (key: string, label: string, type = 'text') => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} className="input" defaultValue={String(org?.[key] || '')}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/crm/profile', form);
      setMsg('Profile saved');
      qc.invalidateQueries({ queryKey: ['crm-profile'] });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed');
    } finally { setSaving(false); }
  };

  if (isLoading) return <DashboardLayout portal="crm"><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Hospital Profile" subtitle="Manage your hospital information" />
      <div className="mb-4 flex items-center gap-3">
        <StatusBadge status={String(org?.verificationStatus || 'PENDING')} />
        {org?.verificationStatus === 'APPROVED' && <span className="text-sm text-green-600 font-medium">✓ Verified Badge</span>}
        <span className="text-xs text-gray-500">Verification status is managed by platform admin</span>
      </div>
      {msg && <div className="mb-4 text-sm text-green-600">{msg}</div>}
      <div className="card p-6 space-y-6">
        <div><h3 className="font-semibold mb-4">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('name', 'Hospital Name')}
            {field('registrationNumber', 'Registration Number')}
            {field('establishmentYear', 'Establishment Year', 'number')}
            {field('email', 'Email', 'email')}
            {field('phone', 'Phone')}
            {field('emergencyContact', 'Emergency Contact')}
            {field('website', 'Website')}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">About Hospital</label>
            <textarea className="input" rows={3} defaultValue={String(org?.aboutHospital || org?.description || '')}
              onChange={(e) => setForm({ ...form, aboutHospital: e.target.value })} />
          </div>
        </div>
        <div><h3 className="font-semibold mb-4">Location</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {field('country', 'Country')}
            {field('state', 'State')}
            {field('city', 'City')}
            {field('pinCode', 'PIN Code')}
          </div>
          <div className="mt-4">{field('address', 'Address')}</div>
        </div>
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving ? 'Saving...' : 'Save Profile'}</button>
      </div>
    </DashboardLayout>
  );
}

// ─── Branches ────────────────────────────────────────────────────────────────

export function CrmBranchesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-branches'], queryFn: () => api.get('/crm/branches') });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', city: '', phone: '', managerName: '' });

  const branches = (data?.data as Record<string, unknown>[]) || [];

  const create = async () => {
    await api.post('/crm/branches', form);
    qc.invalidateQueries({ queryKey: ['crm-branches'] });
    setShowForm(false);
    setForm({ name: '', city: '', phone: '', managerName: '' });
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Branch Management" subtitle="Manage hospital branches"
        actions={<button type="button" className="btn-primary" onClick={() => setShowForm(!showForm)}>Add Branch</button>} />
      {showForm && (
        <div className="card p-4 mb-4 grid grid-cols-2 gap-3">
          <input className="input" placeholder="Branch Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Branch Manager" value={form.managerName} onChange={(e) => setForm({ ...form, managerName: e.target.value })} />
          <button type="button" className="btn-primary col-span-2" onClick={create}>Create Branch</button>
        </div>
      )}
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Branch' },
          { key: 'city', label: 'City' },
          { key: 'managerName', label: 'Manager' },
          { key: 'phone', label: 'Contact' },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
        ]} rows={branches} emptyMessage="No branches yet" />
      )}
    </DashboardLayout>
  );
}

// ─── Departments ─────────────────────────────────────────────────────────────

export function CrmDepartmentsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-departments'], queryFn: () => api.get('/crm/departments') });
  const [name, setName] = useState('');
  const depts = (data?.data as Record<string, unknown>[]) || [];

  const create = async () => {
    if (!name) return;
    await api.post('/crm/departments', { name });
    qc.invalidateQueries({ queryKey: ['crm-departments'] });
    setName('');
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Departments" subtitle="Manage hospital departments"
        actions={<div className="flex gap-2"><input className="input" placeholder="Department name" value={name} onChange={(e) => setName(e.target.value)} /><button type="button" className="btn-primary" onClick={create}>Add</button></div>} />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Department' },
          { key: 'branch', label: 'Branch', render: (r) => String((r.branch as { name?: string })?.name || 'All') },
          { key: 'doctors', label: 'Doctors', render: (r) => String((r._count as { doctors?: number })?.doctors || 0) },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
        ]} rows={depts} />
      )}
    </DashboardLayout>
  );
}

// ─── Staff ───────────────────────────────────────────────────────────────────

export function CrmStaffPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-staff'], queryFn: () => api.get('/crm/staff') });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: 'Password123!', fullName: '', role: 'RECEPTIONIST' });
  const staff = (data?.data as Record<string, unknown>[]) || [];

  const create = async () => {
    await api.post('/crm/staff', form);
    qc.invalidateQueries({ queryKey: ['crm-staff'] });
    setShowForm(false);
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Staff Management" subtitle="Manage hospital internal staff"
        actions={<button type="button" className="btn-primary" onClick={() => setShowForm(!showForm)}>Add Staff</button>} />
      {showForm && (
        <div className="card p-4 mb-4 grid grid-cols-2 gap-3">
          <input className="input" placeholder="Full Name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {['RECEPTIONIST', 'NURSE', 'ACCOUNTANT', 'PHARMACIST', 'LAB_STAFF', 'MANAGER', 'BRANCH_ADMIN'].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="button" className="btn-primary" onClick={create}>Create Staff</button>
        </div>
      )}
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'fullName', label: 'Name' },
          { key: 'role', label: 'Role', render: (r) => <StatusBadge status={String(r.role)} /> },
          { key: 'department', label: 'Department' },
          { key: 'branch', label: 'Branch', render: (r) => String((r.branch as { name?: string })?.name || '-') },
          { key: 'email', label: 'Email', render: (r) => String((r.user as { email?: string })?.email || '-') },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
        ]} rows={staff} />
      )}
    </DashboardLayout>
  );
}

export function CrmRolesPage() {
  const roles = [
    { role: 'Hospital Admin', patients: 'Full', appointments: 'Full', billing: 'Full', records: 'Full' },
    { role: 'Branch Manager', patients: 'Branch', appointments: 'Branch', billing: 'Branch', records: 'View' },
    { role: 'Receptionist', patients: 'View/Create', appointments: 'Create/Edit', billing: 'Limited', records: 'No access' },
    { role: 'Nurse', patients: 'View', appointments: 'View/Update', billing: 'No access', records: 'View' },
    { role: 'Accountant', patients: 'View', appointments: 'View', billing: 'Full', records: 'No access' },
  ];
  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Roles & Permissions" subtitle="Hospital-level role permissions (custom RBAC coming soon)" />
      <AdminTable columns={[
        { key: 'role', label: 'Role' },
        { key: 'patients', label: 'Patients' },
        { key: 'appointments', label: 'Appointments' },
        { key: 'billing', label: 'Billing' },
        { key: 'records', label: 'Medical Records' },
      ]} rows={roles} />
      <p className="text-xs text-gray-500 mt-4">Fine-grained custom permissions will be configurable in a future release. Medical data access is strictly role-based.</p>
    </DashboardLayout>
  );
}

// ─── Services & Packages ─────────────────────────────────────────────────────

export function CrmServicesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-services'], queryFn: () => api.get('/crm/services') });
  const [form, setForm] = useState({ name: '', category: '', price: '', duration: '' });
  const services = (data?.data as Record<string, unknown>[]) || [];

  const create = async () => {
    await api.post('/crm/services', { ...form, price: parseFloat(form.price), duration: form.duration ? parseInt(form.duration) : undefined });
    qc.invalidateQueries({ queryKey: ['crm-services'] });
    setForm({ name: '', category: '', price: '', duration: '' });
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Services" subtitle="Manage hospital services catalog" />
      <div className="card p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <input className="input" placeholder="Service Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input className="input" placeholder="Price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <input className="input" placeholder="Duration (min)" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
        <button type="button" className="btn-primary" onClick={create}>Add Service</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Service' },
          { key: 'category', label: 'Category' },
          { key: 'price', label: 'Price', render: (r) => formatCurrency(Number(r.price)) },
          { key: 'duration', label: 'Duration', render: (r) => r.duration ? `${r.duration} min` : '-' },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
        ]} rows={services} />
      )}
    </DashboardLayout>
  );
}

export function CrmHealthPackagesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-packages'], queryFn: () => api.get('/crm/health-packages') });
  const [form, setForm] = useState({ name: '', originalPrice: '', offerPrice: '', description: '' });
  const packages = (data?.data as Record<string, unknown>[]) || [];

  const create = async () => {
    await api.post('/crm/health-packages', { ...form, originalPrice: parseFloat(form.originalPrice), offerPrice: parseFloat(form.offerPrice), includedServices: [] });
    qc.invalidateQueries({ queryKey: ['crm-packages'] });
    setForm({ name: '', originalPrice: '', offerPrice: '', description: '' });
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Health Packages" subtitle="Create and manage health checkup packages" />
      <div className="card p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <input className="input" placeholder="Package Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Original Price" value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
        <input className="input" placeholder="Offer Price" value={form.offerPrice} onChange={(e) => setForm({ ...form, offerPrice: e.target.value })} />
        <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button type="button" className="btn-primary" onClick={create}>Create Package</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Package' },
          { key: 'originalPrice', label: 'Original', render: (r) => formatCurrency(Number(r.originalPrice)) },
          { key: 'offerPrice', label: 'Offer', render: (r) => formatCurrency(Number(r.offerPrice)) },
          { key: 'validityDays', label: 'Validity', render: (r) => r.validityDays ? `${r.validityDays} days` : '-' },
          { key: 'isActive', label: 'Status', render: (r) => <StatusBadge status={r.isActive ? 'ACTIVE' : 'INACTIVE'} /> },
        ]} rows={packages} />
      )}
    </DashboardLayout>
  );
}

// ─── Leads, Reviews, Ads ─────────────────────────────────────────────────────

export function CrmLeadsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-leads'], queryFn: () => api.get('/crm/leads') });
  const leads = (data?.data as Record<string, unknown>[]) || [];

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/crm/leads/${id}`, { status });
    qc.invalidateQueries({ queryKey: ['crm-leads'] });
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Leads Management" subtitle="Leads from marketplace and advertisements" />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'name', label: 'Name' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
          { key: 'source', label: 'Source' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'createdAt', label: 'Date', render: (r) => new Date(String(r.createdAt)).toLocaleDateString() },
          { key: 'actions', label: 'Actions', render: (r) => (
            <select className="text-xs border rounded px-1" defaultValue={String(r.status)}
              onChange={(e) => updateStatus(String(r.id), e.target.value)}>
              {['NEW', 'CONTACTED', 'INTERESTED', 'APPOINTMENT_BOOKED', 'CONVERTED', 'LOST'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )},
        ]} rows={leads} />
      )}
    </DashboardLayout>
  );
}

export function CrmReviewsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-reviews'], queryFn: () => api.get('/crm/reviews') });
  const reviews = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Reviews & Ratings" subtitle="View and respond to patient reviews" />
      {isLoading ? <LoadingState /> : (
        <div className="space-y-4">
          {reviews.length === 0 ? <div className="card p-12 text-center text-gray-500">No reviews yet</div> : reviews.map((r) => (
            <div key={String(r.id)} className="card p-4">
              <div className="flex justify-between">
                <div>
                  <p className="font-medium">{(r.patient as { fullName?: string })?.fullName} — {'★'.repeat(Number(r.rating))}</p>
                  <p className="text-sm text-gray-600 mt-1">{String(r.comment || '')}</p>
                  {Boolean(r.doctor) && <p className="text-xs text-gray-400 mt-1">Doctor: {(r.doctor as { fullName?: string })?.fullName}</p>}
                </div>
                <span className="text-xs text-gray-400">{new Date(String(r.createdAt)).toLocaleDateString()}</span>
              </div>
              {r.response ? <p className="text-sm text-primary-600 mt-2 bg-primary-50 p-2 rounded">Response: {String(r.response)}</p> : (
                <button type="button" className="text-xs text-primary-600 mt-2 hover:underline"
                  onClick={async () => {
                    const response = prompt('Enter your response:');
                    if (response) { await api.patch(`/crm/reviews/${r.id}`, { response }); qc.invalidateQueries({ queryKey: ['crm-reviews'] }); }
                  }}>Respond</button>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export function CrmAdvertisementsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-ads'], queryFn: () => api.get('/crm/advertisements') });
  const [form, setForm] = useState({ title: '', type: 'HOMEPAGE_BANNER', budget: '' });
  const ads = (data?.data as Record<string, unknown>[]) || [];

  const create = async () => {
    await api.post('/crm/advertisements', { ...form, budget: form.budget ? parseFloat(form.budget) : undefined });
    qc.invalidateQueries({ queryKey: ['crm-ads'] });
    setForm({ title: '', type: 'HOMEPAGE_BANNER', budget: '' });
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Advertisement Management" subtitle="Create campaigns — approval by platform admin required" />
      <div className="card p-4 mb-4 grid grid-cols-3 gap-3">
        <input className="input" placeholder="Campaign Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className="input" placeholder="Budget" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
        <button type="button" className="btn-primary" onClick={create}>Submit for Approval</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'title', label: 'Campaign' },
          { key: 'type', label: 'Type' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'budget', label: 'Budget', render: (r) => r.budget ? formatCurrency(Number(r.budget)) : '-' },
          { key: 'impressions', label: 'Impressions' },
          { key: 'clicks', label: 'Clicks' },
        ]} rows={ads} />
      )}
    </DashboardLayout>
  );
}

// ─── Communications, Subscription, Support ───────────────────────────────────

export function CrmCommunicationsPage() {
  const [form, setForm] = useState({ channel: 'EMAIL', recipientType: 'PATIENT', message: '', subject: '' });
  const [sent, setSent] = useState(false);

  const send = async () => {
    await api.post('/crm/communications/send', { ...form, recipientIds: ['broadcast'] });
    setSent(true);
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Communication Center" subtitle="Send messages to patients, staff, and doctors" />
      <div className="card p-6 max-w-2xl space-y-4">
        <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
          {['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input" value={form.recipientType} onChange={(e) => setForm({ ...form, recipientType: e.target.value })}>
          {['PATIENT', 'STAFF', 'DOCTOR'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="input" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <textarea className="input" rows={4} placeholder="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <p className="text-xs text-gray-500">Marketing messages require applicable consent/opt-in rules.</p>
        <button type="button" className="btn-primary" onClick={send}>Send Communication</button>
        {sent && <p className="text-green-600 text-sm">Communication queued successfully</p>}
      </div>
    </DashboardLayout>
  );
}

export function CrmSupportPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-support'], queryFn: () => api.get('/crm/support') });
  const [form, setForm] = useState({ subject: '', description: '' });
  const tickets = (data?.data as Record<string, unknown>[]) || [];

  const create = async () => {
    await api.post('/crm/support', form);
    qc.invalidateQueries({ queryKey: ['crm-support'] });
    setForm({ subject: '', description: '' });
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Support & Complaints" subtitle="Raise tickets to platform support" />
      <div className="card p-4 mb-4 space-y-3 max-w-xl">
        <input className="input" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <textarea className="input" rows={3} placeholder="Describe your issue" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button type="button" className="btn-primary" onClick={create}>Create Ticket</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'ticketId', label: 'Ticket ID' },
          { key: 'subject', label: 'Subject' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
          { key: 'priority', label: 'Priority', render: (r) => <StatusBadge status={String(r.priority)} /> },
          { key: 'createdAt', label: 'Date', render: (r) => new Date(String(r.createdAt)).toLocaleDateString() },
        ]} rows={tickets} />
      )}
    </DashboardLayout>
  );
}

// ─── Analytics, Documents, Notifications, Audit ──────────────────────────────

export function CrmAnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['crm-analytics'], queryFn: () => api.get('/crm/analytics') });
  const analytics = data?.data as Record<string, unknown> | undefined;

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Analytics & Reports" subtitle="Hospital performance insights" />
      {isLoading ? <LoadingState /> : analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Patients', value: (analytics.patients as { total?: number })?.total },
              { label: 'New This Month', value: (analytics.patients as { newThisMonth?: number })?.newThisMonth },
              { label: 'Returning', value: (analytics.patients as { returning?: number })?.returning },
              { label: 'Total Appointments', value: (analytics.appointments as { total?: number })?.total },
            ].map((s) => (
              <div key={s.label} className="card p-4"><p className="text-xs text-gray-500">{s.label}</p><p className="text-2xl font-bold">{s.value}</p></div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Daily Revenue', value: formatCurrency(Number((analytics.revenue as { daily?: number })?.daily || 0)) },
              { label: 'Weekly Revenue', value: formatCurrency(Number((analytics.revenue as { weekly?: number })?.weekly || 0)) },
              { label: 'Monthly Revenue', value: formatCurrency(Number((analytics.revenue as { monthly?: number })?.monthly || 0)) },
            ].map((s) => (
              <div key={s.label} className="card p-4"><p className="text-xs text-gray-500">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
            ))}
          </div>
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Marketing Performance</h3>
            <div className="grid grid-cols-5 gap-4 text-center">
              {Object.entries(analytics.marketing as Record<string, number> || {}).map(([k, v]) => (
                <div key={k}><p className="text-xs text-gray-500 capitalize">{k}</p><p className="text-lg font-bold">{v}</p></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export function CrmDocumentsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-documents'], queryFn: () => api.get('/crm/documents') });
  const docs = (data?.data as Record<string, unknown>[]) || [];

  const upload = async () => {
    const fileName = prompt('Document name:');
    if (!fileName) return;
    await api.post('/crm/documents', { fileName, fileKey: `docs/${Date.now()}-${fileName}` });
    qc.invalidateQueries({ queryKey: ['crm-documents'] });
  };

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Documents & Media" subtitle="Hospital certificates, licenses, and media files"
        actions={<button type="button" className="btn-primary" onClick={upload}>Upload Document</button>} />
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'fileName', label: 'File' },
          { key: 'mimeType', label: 'Type' },
          { key: 'uploadedBy', label: 'Uploaded By' },
          { key: 'createdAt', label: 'Date', render: (r) => new Date(String(r.createdAt)).toLocaleDateString() },
        ]} rows={docs} />
      )}
    </DashboardLayout>
  );
}

export function CrmNotificationsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['crm-notifications'], queryFn: () => api.get('/crm/notifications') });
  const notifications = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Notifications" subtitle="Hospital dashboard notifications" />
      {isLoading ? <LoadingState /> : notifications.length === 0 ? (
        <div className="card p-12 text-center text-gray-500">No notifications</div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={String(n.id)} className={`card p-4 ${n.isRead ? 'opacity-60' : 'border-l-4 border-l-primary-500'}`}>
              <p className="font-medium">{String(n.title)}</p>
              <p className="text-sm text-gray-600">{String(n.message)}</p>
              <p className="text-xs text-gray-400 mt-1">{new Date(String(n.createdAt)).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export function CrmAuditLogsPage() {
  return (
    <CrmPage title="Audit Logs" subtitle="Track staff actions within your organization"
      endpoint="/crm/audit-logs"
      columns={[
        { key: 'staffName', label: 'Staff' },
        { key: 'action', label: 'Action' },
        { key: 'entityType', label: 'Entity' },
        { key: 'entityId', label: 'Entity ID' },
        { key: 'createdAt', label: 'Date', render: (r) => new Date(String(r.createdAt)).toLocaleString() },
      ]} />
  );
}


export function CrmSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['crm-settings'], queryFn: () => api.get('/crm/settings') });
  const settings = data?.data as Record<string, unknown> | undefined;

  const toggle = async (key: string, value: boolean) => {
    await api.patch('/crm/settings', { [key]: value });
    qc.invalidateQueries({ queryKey: ['crm-settings'] });
  };

  if (isLoading) return <DashboardLayout portal="crm"><LoadingState /></DashboardLayout>;

  return (
    <DashboardLayout portal="crm">
      <PageHeader title="Hospital Settings" subtitle="Organization-level settings" />
      <div className="card p-6 max-w-lg space-y-4">
        <label className="flex items-center justify-between">
          <span className="text-sm">Emergency Services Available</span>
          <input type="checkbox" defaultChecked={Boolean(settings?.emergencyAvailable)} onChange={(e) => toggle('emergencyAvailable', e.target.checked)} />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm">Publicly Listed on Marketplace</span>
          <input type="checkbox" defaultChecked={Boolean(settings?.isPubliclyListed)} onChange={(e) => toggle('isPubliclyListed', e.target.checked)} />
        </label>
        <p className="text-xs text-gray-500">Global platform settings are managed by Super Admin.</p>
      </div>
    </DashboardLayout>
  );
}
