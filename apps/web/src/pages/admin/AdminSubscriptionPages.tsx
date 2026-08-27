import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, AdminTable, StatusBadge, LoadingState, ActionBtn, AdminModal } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';

const subNav = [
  { to: '/admin/subscriptions', label: 'Overview', end: true },
  { to: '/admin/subscriptions/all', label: 'All Subscriptions' },
  { to: '/admin/subscriptions/plans', label: 'Plans' },
  { to: '/admin/subscriptions/default', label: 'Default Plan' },
  { to: '/admin/subscriptions/expiring', label: 'Expiring Soon' },
  { to: '/admin/subscriptions/suspended', label: 'Suspended' },
  { to: '/admin/subscriptions/payments', label: 'Payment History' },
  { to: '/admin/subscriptions/history', label: 'History' },
  { to: '/admin/subscriptions/settings', label: 'Settings' },
];

function SubscriptionLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Subscription Management" subtitle="Plans, billing, and organization subscriptions" />
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

function useSubList(params = '') {
  return useQuery({ queryKey: ['subs', params], queryFn: () => api.get(`/admin/subscriptions/list${params}`) });
}

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewPage() {
  const { data, isLoading } = useQuery({ queryKey: ['sub-overview'], queryFn: () => api.get('/admin/subscriptions/overview') });
  const o = data?.data as Record<string, unknown> | undefined;
  const defaultPlan = o?.defaultPlan as { name?: string } | null;

  if (isLoading) return <SubscriptionLayout><LoadingState /></SubscriptionLayout>;

  return (
    <SubscriptionLayout>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active', value: o?.active, color: 'text-green-600' },
          { label: 'Trial', value: o?.trial, color: 'text-blue-600' },
          { label: 'Suspended', value: o?.suspended, color: 'text-red-600' },
          { label: 'Expired', value: o?.expired, color: 'text-gray-600' },
          { label: 'Expiring Soon', value: o?.expiringSoon, color: 'text-orange-600' },
          { label: 'Active Plans', value: o?.totalPlans, color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="card p-5 text-center">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{String(s.value ?? 0)}</p>
          </div>
        ))}
      </div>
      <div className="card p-6">
        <h3 className="font-semibold mb-2">Default Subscription Plan</h3>
        <p className="text-gray-600">{defaultPlan?.name || 'Not configured'} — new registrations get this plan automatically.</p>
        <Link to="/admin/subscriptions/default" className="text-sm text-primary-600 hover:underline mt-2 inline-block">Change default plan →</Link>
      </div>
    </SubscriptionLayout>
  );
}

// ─── All Subscriptions ───────────────────────────────────────────────────────

function SubscriptionActions({ sub, onDone }: { sub: Record<string, unknown>; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<'view' | 'edit' | 'suspend' | 'extend' | 'expiry' | 'payments' | null>(null);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(30);
  const [planId, setPlanId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ status: '', billingCycle: 'MONTHLY', price: '', discount: '', startDate: '', endDate: '' });
  const { data: plans } = useQuery({ queryKey: ['sub-plans'], queryFn: () => api.get('/admin/subscriptions/plans') });
  const planList = (plans?.data as { id: string; name: string }[]) || [];
  const id = sub.id as string;
  const orgId = (sub.organization as { id?: string })?.id || '';

  const { data: detail } = useQuery({
    queryKey: ['sub-detail', id],
    queryFn: () => api.get(`/admin/subscriptions/${id}`),
    enabled: modal === 'view' || modal === 'edit',
  });
  const { data: payData } = useQuery({
    queryKey: ['sub-payments', orgId],
    queryFn: () => api.get(`/admin/subscriptions/organization/${orgId}/payments`),
    enabled: modal === 'payments' && !!orgId,
  });
  const detailSub = detail?.data as Record<string, unknown> | undefined;
  const payments = (payData?.data as Record<string, unknown>[]) || [];

  const act = async (path: string, body?: unknown) => { await api.post(path, body); onDone(); setOpen(false); setModal(null); };
  const close = () => { setModal(null); setOpen(false); setSaveError(null); };

  const orgName = String((sub.organization as { name?: string })?.name || 'Organization');

  const openEdit = () => {
    setOpen(false);
    setSaveError(null);
    setPlanId((sub.plan as { id?: string })?.id || '');
    setEditForm({
      status: String(sub.status || 'ACTIVE'),
      billingCycle: String(sub.billingCycle || 'MONTHLY'),
      price: String(sub.price ?? ''),
      discount: String(sub.discount ?? ''),
      startDate: sub.startDate ? String(sub.startDate).slice(0, 10) : '',
      endDate: sub.endDate ? String(sub.endDate).slice(0, 10) : '',
    });
    setModal('edit');
  };

  const saveEdit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await api.patch(`/admin/subscriptions/${id}`, {
        planId,
        status: editForm.status,
        billingCycle: editForm.billingCycle,
        price: editForm.price ? Number(editForm.price) : undefined,
        discount: editForm.discount ? Number(editForm.discount) : undefined,
        startDate: editForm.startDate || undefined,
        endDate: editForm.endDate || undefined,
        reason: reason || 'Manual update by admin',
      });
      onDone();
      close();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-block">
      <button type="button" className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded" onClick={() => setOpen(!open)}>Actions ▾</button>
      {open && !modal && (
        <div className="absolute right-0 z-50 mt-1 w-52 bg-white border rounded-lg shadow-lg py-1 text-xs flex flex-col">
          <button type="button" className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => setModal('view')}>View Subscription</button>
          <button type="button" className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={openEdit}>Edit Subscription</button>
          <button type="button" className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={openEdit}>Update Plan</button>
          <button type="button" className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => act(`/admin/subscriptions/${id}/renew`, { reason: 'Admin renewal' })}>Renew Subscription</button>
          <button type="button" className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => setModal('extend')}>Extend Subscription</button>
          <button type="button" className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => { setEditForm((f) => ({ ...f, endDate: sub.endDate ? String(sub.endDate).slice(0, 10) : '' })); setModal('expiry'); }}>Change Expiry</button>
          {sub.status !== 'SUSPENDED' && <button type="button" className="block w-full text-left px-3 py-1.5 hover:bg-gray-50 text-red-600" onClick={() => setModal('suspend')}>Suspend Subscription</button>}
          {sub.status === 'SUSPENDED' && <button type="button" className="block w-full text-left px-3 py-1.5 hover:bg-gray-50 text-green-600" onClick={() => act(`/admin/subscriptions/${id}/activate`)}>Activate Subscription</button>}
          <button type="button" className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => act(`/admin/subscriptions/${id}/cancel`, { reason: 'Admin cancelled' })}>Cancel Subscription</button>
          <button type="button" className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => act(`/admin/subscriptions/${id}/reset-default`)}>Reset to Default Plan</button>
          <button type="button" className="block w-full text-left px-3 py-1.5 hover:bg-gray-50" onClick={() => setModal('payments')}>View Payment History</button>
        </div>
      )}
      {modal === 'suspend' && (
        <AdminModal
          open
          onClose={() => setModal(null)}
          title="Suspend Subscription"
          subtitle={orgName}
          footer={
            <>
              <button type="button" className="btn-secondary text-sm" onClick={() => setModal(null)}>Cancel</button>
              <button type="button" className="btn-admin text-sm" disabled={reason.length < 3} onClick={() => act(`/admin/subscriptions/${id}/suspend`, { reason })}>Suspend</button>
            </>
          }
        >
          <p className="mb-3 text-sm text-slate-500">Reason is required. User will see restricted access in CRM.</p>
          <input className="input w-full" placeholder="e.g. Payment overdue" value={reason} onChange={(e) => setReason(e.target.value)} />
        </AdminModal>
      )}
      {modal === 'extend' && (
        <AdminModal
          open
          onClose={() => setModal(null)}
          title="Extend Subscription"
          subtitle={orgName}
          footer={
            <>
              <button type="button" className="btn-secondary text-sm" onClick={() => setModal(null)}>Cancel</button>
              <button type="button" className="btn-admin text-sm" onClick={() => act(`/admin/subscriptions/${id}/extend`, { days, reason: `Extended ${days} days` })}>Extend {days} days</button>
            </>
          }
        >
          <label className="mb-1 block text-xs font-semibold text-slate-500">Number of days to extend</label>
          <input type="number" className="input w-full" min={1} value={days} onChange={(e) => setDays(Number(e.target.value))} />
        </AdminModal>
      )}
      {modal === 'edit' && (
        <AdminModal
          open
          onClose={close}
          title="Edit Subscription"
          subtitle={orgName}
          size="xl"
          footer={
            <>
              <button type="button" className="btn-secondary text-sm" onClick={close} disabled={saving}>Cancel</button>
              <button type="button" className="btn-admin text-sm" onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Update Subscription'}</button>
            </>
          }
        >
          {saveError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 ring-1 ring-red-100">{saveError}</p>}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Plan</label>
              <select className="input w-full" value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {planList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Status</label>
              <select className="input w-full" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                {['ACTIVE', 'TRIAL', 'SUSPENDED', 'EXPIRED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Billing Cycle</label>
              <select className="input w-full" value={editForm.billingCycle} onChange={(e) => setEditForm({ ...editForm, billingCycle: e.target.value })}>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Price (₹)</label>
              <input type="number" className="input w-full" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Discount (₹)</label>
              <input type="number" className="input w-full" value={editForm.discount} onChange={(e) => setEditForm({ ...editForm, discount: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Start Date</label>
              <input type="date" className="input w-full" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Expiry Date</label>
              <input type="date" className="input w-full" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Reason for change</label>
              <input className="input w-full" placeholder="e.g. Manual upgrade by admin" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
        </AdminModal>
      )}
      {modal === 'expiry' && (
        <AdminModal
          open
          onClose={close}
          title="Change Expiry Date"
          subtitle={orgName}
          footer={
            <>
              <button type="button" className="btn-secondary text-sm" onClick={close}>Cancel</button>
              <button type="button" className="btn-admin text-sm" onClick={() => api.patch(`/admin/subscriptions/${id}`, { endDate: editForm.endDate, reason: reason || 'Expiry changed by admin' }).then(onDone).then(close)}>Save</button>
            </>
          }
        >
          <label className="mb-1 block text-xs font-semibold text-slate-500">New expiry date</label>
          <input type="date" className="input mb-4 w-full" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
          <label className="mb-1 block text-xs font-semibold text-slate-500">Reason</label>
          <input className="input w-full" placeholder="Reason for change" value={reason} onChange={(e) => setReason(e.target.value)} />
        </AdminModal>
      )}
      {modal === 'view' && (
        <AdminModal
          open
          onClose={close}
          title="Subscription Details"
          subtitle={orgName}
          size="xl"
          footer={<button type="button" className="btn-secondary text-sm" onClick={close}>Close</button>}
        >
          {detailSub ? (
            <div className="space-y-3 rounded-xl bg-slate-50/80 p-4 text-sm ring-1 ring-slate-100">
              <p><span className="font-semibold text-slate-500">Organization:</span> {(detailSub.organization as { name?: string })?.name}</p>
              <p><span className="font-semibold text-slate-500">Plan:</span> {(detailSub.plan as { name?: string })?.name}</p>
              <p><span className="font-semibold text-slate-500">Status:</span> <StatusBadge status={String(detailSub.status)} /></p>
              <p><span className="font-semibold text-slate-500">Billing:</span> {String(detailSub.billingCycle)} — {formatCurrency((detailSub.price as number) || 0)}</p>
              <p><span className="font-semibold text-slate-500">Period:</span> {formatDate(detailSub.startDate as string)} → {detailSub.endDate ? formatDate(detailSub.endDate as string) : 'No expiry'}</p>
              <p><span className="font-semibold text-slate-500">Change Source:</span> {String(detailSub.changeSource)}</p>
              {detailSub.suspendReason ? <p className="text-red-600">Suspend reason: {String(detailSub.suspendReason)}</p> : null}
              <h4 className="pt-2 font-semibold text-slate-800">History</h4>
              <ul className="max-h-48 space-y-2 overflow-y-auto">
                {((detailSub.history as Record<string, unknown>[]) || []).map((h) => (
                  <li key={h.id as string} className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600">
                    {(h.previousPlan as { name?: string })?.name || '?'} → {(h.newPlan as { name?: string })?.name || '?'} · {formatDate(h.createdAt as string)} · {String(h.reason || '')}
                  </li>
                ))}
              </ul>
            </div>
          ) : <LoadingState />}
        </AdminModal>
      )}
      {modal === 'payments' && (
        <AdminModal
          open
          onClose={close}
          title="Payment History"
          subtitle={orgName}
          footer={<button type="button" className="btn-secondary text-sm" onClick={close}>Close</button>}
        >
          {payments.length === 0 ? <p className="text-sm text-slate-500">No payment records found.</p> : (
            <ul className="space-y-2 text-sm">
              {payments.map((p) => (
                <li key={p.id as string} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <span className="font-medium">{formatCurrency(p.amount as number)} · <StatusBadge status={String(p.status)} /></span>
                  <span className="text-slate-500">{formatDate(p.createdAt as string)}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminModal>
      )}
    </div>
  );
}

function AllSubscriptionsPage({ filter = '' }: { filter?: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useSubList(`?limit=50${filter}`);
  const refetch = () => qc.invalidateQueries({ queryKey: ['subs'] });

  return (
    <SubscriptionLayout>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'org', label: 'Organization', render: (r) => String((r.organization as { name?: string })?.name) },
          { key: 'type', label: 'Type', render: (r) => String((r.organization as { type?: string })?.type) },
          { key: 'plan', label: 'Plan', render: (r) => String((r.plan as { name?: string })?.name) },
          { key: 'startDate', label: 'Start', render: (r) => formatDate(r.startDate as string) },
          { key: 'endDate', label: 'Expiry', render: (r) => r.endDate ? formatDate(r.endDate as string) : '-' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'source', label: 'Source', render: (r) => <span className="text-xs text-gray-500">{r.changeSource as string}</span> },
          { key: 'actions', label: 'Actions', nowrap: false, render: (r) => <SubscriptionActions sub={r} onDone={refetch} /> },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </SubscriptionLayout>
  );
}

// ─── Plans ─────────────────────────────────────────────────────────────────────

const emptyPlan = { code: '', name: '', description: '', monthlyPrice: 0, yearlyPrice: 0, trialDays: 14, features: '', userLimit: 10, doctorLimit: 5, patientLimit: 100, branchLimit: 1, appointmentLimit: 500 };

function PlansPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['sub-plans'], queryFn: () => api.get('/admin/subscriptions/plans') });
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(emptyPlan);
  const refetch = () => qc.invalidateQueries({ queryKey: ['sub-plans'] });

  const save = async () => {
    const payload = { ...form, features: form.features.split(',').map((f) => f.trim()).filter(Boolean), monthlyPrice: Number(form.monthlyPrice), yearlyPrice: Number(form.yearlyPrice) };
    if (editing?.id) await api.patch(`/admin/subscriptions/plans/${editing.id}`, payload);
    else await api.post('/admin/subscriptions/plans', payload);
    setEditing(null); setForm(emptyPlan); refetch();
  };

  return (
    <SubscriptionLayout>
      <div className="flex justify-end mb-4">
        <button className="btn-primary text-sm" onClick={() => { setEditing({}); setForm(emptyPlan); }}>+ Create Plan</button>
      </div>
      {isLoading ? <LoadingState /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(data?.data as Record<string, unknown>[])?.map((plan) => (
            <div key={plan.id as string} className={cn('card p-6 relative', plan.isDefault ? 'ring-2 ring-primary-500' : undefined)}>
              {plan.isDefault ? <span className="absolute top-2 right-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">⭐ Default</span> : null}
              <h3 className="font-semibold text-lg">{plan.name as string}</h3>
              <p className="text-2xl font-bold text-primary-600 mt-1">{formatCurrency((plan.monthlyPrice as number) || 0)}<span className="text-sm font-normal text-gray-400">/mo</span></p>
              {(plan.yearlyPrice as number) > 0 && <p className="text-sm text-gray-500">{formatCurrency(plan.yearlyPrice as number)}/yr</p>}
              <p className="text-xs text-gray-400 mt-1">{plan.trialDays as number} day trial</p>
              <ul className="mt-3 space-y-1">{(plan.features as string[])?.slice(0, 4).map((f) => <li key={f} className="text-sm text-gray-500">✓ {f}</li>)}</ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <ActionBtn onClick={() => { setEditing(plan); setForm({ ...plan, features: (plan.features as string[]).join(', ') } as typeof emptyPlan); }}>Edit</ActionBtn>
                {!plan.isDefault && <ActionBtn onClick={() => api.put(`/admin/subscriptions/plans/${plan.id}/set-default`).then(refetch)}>Set Default</ActionBtn>}
                {plan.isActive ? <ActionBtn variant="danger" onClick={() => api.patch(`/admin/subscriptions/plans/${plan.id}/deactivate`).then(refetch)}>Deactivate</ActionBtn>
                  : <ActionBtn variant="success" onClick={() => api.patch(`/admin/subscriptions/plans/${plan.id}/activate`).then(refetch)}>Activate</ActionBtn>}
                {!plan.isDefault && <ActionBtn variant="danger" onClick={() => { if (confirm('Delete this plan?')) api.delete(`/admin/subscriptions/plans/${plan.id}`).then(refetch); }}>Delete</ActionBtn>}
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <AdminModal
          open
          onClose={() => setEditing(null)}
          title={editing.id ? 'Edit Plan' : 'Create Plan'}
          size="xl"
          footer={
            <>
              <button type="button" className="btn-secondary text-sm" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn-admin text-sm" onClick={save}>{editing.id ? 'Update' : 'Create'}</button>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(['code', 'name', 'description'] as const).map((f) => (
              <div key={f} className={f === 'description' ? 'sm:col-span-2' : ''}>
                <label className="mb-1 block text-xs font-semibold capitalize text-slate-500">{f}</label>
                <input className="input w-full" value={String(form[f] || '')} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
              </div>
            ))}
            {(['monthlyPrice', 'yearlyPrice', 'trialDays', 'userLimit', 'doctorLimit', 'patientLimit', 'branchLimit', 'appointmentLimit'] as const).map((f) => (
              <div key={f}>
                <label className="mb-1 block text-xs font-semibold text-slate-500">{f}</label>
                <input type="number" className="input w-full" value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Features (comma-separated)</label>
              <input className="input w-full" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
            </div>
          </div>
        </AdminModal>
      )}
    </SubscriptionLayout>
  );
}

// ─── Default Plan ────────────────────────────────────────────────────────────

function DefaultPlanPage() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ['default-plan'], queryFn: () => api.get('/admin/subscriptions/settings/default-plan') });
  const { data: plans } = useQuery({ queryKey: ['sub-plans'], queryFn: () => api.get('/admin/subscriptions/plans') });
  const current = data?.data as { id?: string; name?: string } | null;
  const planList = (plans?.data as { id: string; name: string; isDefault?: boolean }[]) || [];

  return (
    <SubscriptionLayout>
      <div className="card p-6 max-w-xl">
        <h3 className="font-semibold mb-2">Default Subscription Plan</h3>
        <p className="text-sm text-gray-500 mb-4">New hospitals/clinics automatically receive this plan on registration.</p>
        {isLoading ? <LoadingState /> : (
          <>
            <p className="text-lg font-medium text-primary-700 mb-4">Current: {current?.name || 'Not set'}</p>
            <div className="space-y-2">
              {planList.filter((p) => p.isDefault !== true || p.id === current?.id).map((p) => (
                <button key={p.id} className="w-full text-left px-4 py-3 border rounded-lg hover:bg-gray-50 flex justify-between items-center"
                  onClick={() => api.put(`/admin/subscriptions/plans/${p.id}/set-default`).then(() => refetch())}>
                  <span>{p.name}</span>
                  {p.id === current?.id && <StatusBadge status="ACTIVE" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </SubscriptionLayout>
  );
}

// ─── History ─────────────────────────────────────────────────────────────────

function PaymentHistoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ['sub-payments-all'], queryFn: () => api.get('/admin/subscriptions/payments/all?limit=100') });
  return (
    <SubscriptionLayout>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'org', label: 'Organization', render: (r) => String((r.bill as { organization?: { name?: string } })?.organization?.name || '-') },
          { key: 'type', label: 'Type', render: (r) => String((r.bill as { organization?: { type?: string } })?.organization?.type || '-') },
          { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount as number) },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'bill', label: 'Bill', render: (r) => String((r.bill as { billNumber?: string })?.billNumber || '-') },
          { key: 'date', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </SubscriptionLayout>
  );
}

function HistoryPage() {
  const { data, isLoading } = useQuery({ queryKey: ['sub-history'], queryFn: () => api.get('/admin/subscriptions/history/all?limit=100') });
  return (
    <SubscriptionLayout>
      {isLoading ? <LoadingState /> : (
        <AdminTable columns={[
          { key: 'change', label: 'Change', render: (r) => `${(r.previousPlan as { name?: string })?.name || '?'} → ${(r.newPlan as { name?: string })?.name || '?'}` },
          { key: 'status', label: 'Status', render: (r) => `${r.previousStatus || '?'} → ${r.newStatus || '?'}` },
          { key: 'price', label: 'Price', render: (r) => `${r.previousPrice ?? '-'} → ${r.newPrice ?? '-'}` },
          { key: 'by', label: 'Changed By', render: (r) => String(r.changedByEmail || 'System') },
          { key: 'source', label: 'Source', render: (r) => <StatusBadge status={r.changeSource as string} /> },
          { key: 'reason', label: 'Reason', render: (r) => <span className="max-w-xs truncate block">{String(r.reason || '-')}</span> },
          { key: 'date', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
        ]} rows={(data?.data as Record<string, unknown>[]) || []} />
      )}
    </SubscriptionLayout>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

function SettingsPage() {
  return (
    <SubscriptionLayout>
      <div className="card p-6 max-w-xl space-y-4">
        <h3 className="font-semibold">Subscription Settings</h3>
        <p className="text-sm text-gray-500">Manual admin changes are tracked separately from payment gateway changes. All subscription history records the change source (MANUAL vs PAYMENT).</p>
        <ul className="text-sm space-y-2 text-gray-600">
          <li>✓ Admin upgrades apply immediately without waiting for payment</li>
          <li>✓ Every change logged in Subscription History with reason</li>
          <li>✓ Suspended users see restricted CRM access message</li>
          <li>✓ Default plan auto-assigned on new registration</li>
        </ul>
      </div>
    </SubscriptionLayout>
  );
}

// ─── Main export with nested routes ──────────────────────────────────────────

export function AdminSubscriptionsPage() {
  return (
    <Routes>
      <Route index element={<OverviewPage />} />
      <Route path="all" element={<AllSubscriptionsPage />} />
      <Route path="plans" element={<PlansPage />} />
      <Route path="default" element={<DefaultPlanPage />} />
      <Route path="expiring" element={<AllSubscriptionsPage filter="&expiring=true" />} />
      <Route path="suspended" element={<AllSubscriptionsPage filter="&status=SUSPENDED" />} />
      <Route path="payments" element={<PaymentHistoryPage />} />
      <Route path="history" element={<HistoryPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/admin/subscriptions" replace />} />
    </Routes>
  );
}
