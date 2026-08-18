import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api, apiBaseUrl } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

const PM_BASE = '/admin/payment-management';

const PAYMENT_STATUSES = [
  'INITIATED', 'PROCESSING', 'AUTHORIZED', 'PENDING', 'CAPTURED', 'COMPLETED',
  'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIAL_REFUND', 'DISPUTED',
];

const PAYMENT_PURPOSES = [
  'APPOINTMENT', 'CONSULTATION', 'FOLLOW_UP', 'ONLINE_CONSULTATION', 'EMERGENCY',
  'HOME_VISIT', 'SERVICE', 'DIAGNOSTIC', 'HEALTH_PACKAGE', 'PROCEDURE', 'TREATMENT',
  'SUBSCRIPTION', 'ADVERTISEMENT', 'REFERRAL_COMMISSION', 'OTHER',
];

const PAYMENT_METHODS = [
  'UPI', 'CREDIT_CARD', 'DEBIT_CARD', 'NET_BANKING', 'WALLET',
  'PAYMENT_LINK', 'CASH', 'POS', 'BANK_TRANSFER',
];

function levelColor(level: string) {
  if (level === 'red') return 'text-red-600 bg-red-50';
  if (level === 'orange') return 'text-orange-600 bg-orange-50';
  return 'text-yellow-700 bg-yellow-50';
}

export function PaymentManagementDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['pay-dashboard'],
    queryFn: () => api.get('/admin/payments/dashboard'),
  });
  const stats = data?.data as Record<string, unknown> | undefined;
  const exceptions = (stats?.exceptions as { level: string; message: string; paymentId?: string }[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Payment Management"
        subtitle="Centralized financial control — payments, refunds, settlements & reconciliation"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`${PM_BASE}/payments`} className="btn-primary text-sm">All Payments</Link>
            <Link to={`${PM_BASE}/exceptions`} className="btn-secondary text-sm">Exceptions</Link>
            <a href={`${apiBaseUrl}/admin/payments/export`} className="btn-secondary text-sm" target="_blank" rel="noreferrer">Export CSV</a>
          </div>
        }
      />
      {isLoading ? <LoadingState /> : stats && (
        <>
          <StatGrid stats={[
            { label: 'Gross Revenue', value: formatCurrency(Number(stats.grossRevenue || 0)) },
            { label: 'Net Revenue', value: formatCurrency(Number(stats.netRevenue || 0)) },
            { label: "Today's Revenue", value: formatCurrency(Number(stats.todayRevenue || 0)) },
            { label: 'This Week', value: formatCurrency(Number(stats.weekRevenue || 0)) },
            { label: 'This Month', value: formatCurrency(Number(stats.monthRevenue || 0)) },
            { label: 'Platform Revenue', value: formatCurrency(Number(stats.platformRevenue || 0)) },
            { label: 'Provider Revenue', value: formatCurrency(Number(stats.providerRevenue || 0)) },
            { label: 'Pending Payments', value: formatCurrency(Number(stats.pendingAmount || 0)) },
            { label: 'Successful', value: Number(stats.successfulPayments || 0) },
            { label: 'Failed', value: Number(stats.failedPayments || 0) },
            { label: 'Refunded', value: formatCurrency(Number(stats.refundedAmount || 0)) },
            { label: 'Partial Refunds', value: Number(stats.partialRefunds || 0) },
            { label: 'Disputed', value: Number(stats.disputedPayments || 0) },
            { label: 'Hospital Revenue', value: formatCurrency(Number(stats.hospitalRevenue || 0)) },
            { label: 'Clinic Revenue', value: formatCurrency(Number(stats.clinicRevenue || 0)) },
            { label: 'Subscription Revenue', value: formatCurrency(Number(stats.subscriptionRevenue || 0)) },
            { label: 'Advertisement Revenue', value: formatCurrency(Number(stats.advertisementRevenue || 0)) },
            { label: 'Referral Commission', value: Number(stats.referralCommission || 0) },
            { label: 'Settlement Pending', value: formatCurrency(Number(stats.settlementPending || 0)) },
            { label: 'Exceptions', value: Number(stats.exceptionCount || 0) },
          ]} />

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 border-l-4 border-primary-500">
              <p className="text-sm text-gray-500">Gross Revenue</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(Number(stats.grossRevenue || 0))}</p>
            </div>
            <div className="card p-6 border-l-4 border-green-500">
              <p className="text-sm text-gray-500">Platform Revenue</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(Number(stats.platformRevenue || 0))}</p>
            </div>
            <div className="card p-6 border-l-4 border-blue-500">
              <p className="text-sm text-gray-500">Provider Revenue</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(Number(stats.providerRevenue || 0))}</p>
            </div>
          </div>

          {exceptions.length > 0 && (
            <div className="mt-8 card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Payment Exceptions</h3>
                <Link to={`${PM_BASE}/exceptions`} className="text-sm text-primary-600">View all →</Link>
              </div>
              <div className="space-y-2">
                {exceptions.map((ex, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-lg text-sm ${levelColor(ex.level)}`}>
                    <span>{ex.message}</span>
                    {ex.paymentId && (
                      <Link to={`${PM_BASE}/payments/${ex.paymentId}`} className="font-medium underline">Investigate</Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 card p-6 bg-gray-50">
            <h3 className="font-semibold mb-2">Payment Verification Rule</h3>
            <p className="text-sm text-gray-600">
              Frontend success pages are not the source of truth. Payments are confirmed only after gateway webhook
              + server-side verification + idempotent processing. Then appointment, invoice, commission, and settlement update.
            </p>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

export function PaymentManagementListPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [purpose, setPurpose] = useState('');
  const [method, setMethod] = useState('');
  const [orgType, setOrgType] = useState('');

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (purpose) params.set('purpose', purpose);
  if (method) params.set('method', method);
  if (orgType) params.set('organizationType', orgType);
  params.set('limit', '50');

  const { data, isLoading } = useQuery({
    queryKey: ['pay-payments', params.toString()],
    queryFn: () => api.get(`/admin/payments?${params.toString()}`),
  });

  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="All Payments"
        subtitle="Complete platform payment registry"
        actions={<Link to={PM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <input className="input text-sm" placeholder="Payment ID, patient, transaction..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input text-sm w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input text-sm w-auto" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
          <option value="">All Purpose</option>
          {PAYMENT_PURPOSES.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input text-sm w-auto" value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="">All Methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input text-sm w-auto" value={orgType} onChange={(e) => setOrgType(e.target.value)}>
          <option value="">All Providers</option>
          <option value="HOSPITAL">Hospital</option>
          <option value="CLINIC">Clinic</option>
        </select>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable
          columns={[
            { key: 'payId', label: 'Payment ID', render: (r) => (
              <div>
                <p className="font-mono text-xs font-medium">{String(r.paymentNumber)}</p>
                <p className="text-xs text-gray-500">{String(r.transactionId || '—')}</p>
              </div>
            )},
            { key: 'patient', label: 'Patient', render: (r) => {
              const bill = r.bill as { patient?: { fullName?: string; globalPatientId?: string } };
              return (
                <div>
                  <p className="font-medium">{bill?.patient?.fullName}</p>
                  <p className="text-xs text-gray-500">{bill?.patient?.globalPatientId}</p>
                </div>
              );
            }},
            { key: 'purpose', label: 'Purpose', render: (r) => String(r.purpose).replace(/_/g, ' ') },
            { key: 'provider', label: 'Provider', render: (r) => {
              const org = (r.bill as { organization?: { name?: string; type?: string } })?.organization;
              return org ? `${org.name} (${org.type})` : '—';
            }},
            { key: 'amount', label: 'Amount', render: (r) => formatCurrency(r.amount as number) },
            { key: 'method', label: 'Method', render: (r) => String(r.method).replace(/_/g, ' ') },
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
            { key: 'date', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
            { key: 'actions', label: 'Action', render: (r) => (
              <Link to={`${PM_BASE}/payments/${r.id}`} className="text-xs text-primary-600 font-medium">Manage</Link>
            )},
          ]}
          rows={rows}
          emptyMessage="No payments found"
        />
      )}
    </DashboardLayout>
  );
}

export function PaymentManagementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['pay-payment', id],
    queryFn: () => api.get(`/admin/payments/${id}`),
    enabled: Boolean(id),
  });

  const overview = data?.data as {
    payment: Record<string, unknown>;
    auditLogs: Record<string, unknown>[];
  } | undefined;

  const payment = overview?.payment;
  const bill = payment?.bill as Record<string, unknown> | undefined;
  const patient = bill?.patient as Record<string, unknown> | undefined;
  const org = bill?.organization as Record<string, unknown> | undefined;
  const appointment = bill?.appointment as Record<string, unknown> | undefined;

  if (isLoading) return <DashboardLayout portal="admin"><LoadingState /></DashboardLayout>;
  if (!payment) return <DashboardLayout portal="admin"><p>Payment not found</p></DashboardLayout>;

  const verifyWebhook = async () => {
    await api.post(`/admin/payments/${id}/verify`, {});
    qc.invalidateQueries({ queryKey: ['pay-payment', id] });
  };

  const processRefund = async (fullRefund: boolean) => {
    const reason = prompt('Refund reason (min 5 chars):');
    if (!reason || reason.length < 5) return;
    let amount: number | undefined;
    if (!fullRefund) {
      const amt = prompt('Partial refund amount:');
      if (!amt) return;
      amount = Number(amt);
      if (!amount || amount <= 0) return;
    }
    await api.post(`/admin/payments/${id}/refund`, { reason, fullRefund, amount });
    qc.invalidateQueries({ queryKey: ['pay-payment', id] });
  };

  const canVerify = !payment.webhookVerified && ['PENDING', 'AUTHORIZED', 'CAPTURED', 'COMPLETED'].includes(String(payment.status));
  const canRefund = ['COMPLETED', 'CAPTURED', 'PARTIAL_REFUND'].includes(String(payment.status));

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={String(payment.paymentNumber)}
        subtitle={`${formatCurrency(payment.amount as number)} · ${String(payment.purpose).replace(/_/g, ' ')}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => navigate(`${PM_BASE}/payments`)}>← Back</button>
            {Boolean(canVerify) && (
              <ActionBtn onClick={verifyWebhook}>Verify Webhook</ActionBtn>
            )}
            {Boolean(canRefund) && (
              <>
                <ActionBtn onClick={() => processRefund(true)}>Full Refund</ActionBtn>
                <ActionBtn variant="danger" onClick={() => processRefund(false)}>Partial Refund</ActionBtn>
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Patient</h3>
          <p className="font-medium">{String(patient?.fullName)}</p>
          <p className="text-sm text-gray-500 font-mono">{String(patient?.globalPatientId)}</p>
          <p className="text-sm text-gray-500 mt-1">{(patient?.user as { email?: string })?.email}</p>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Provider</h3>
          <p className="font-medium">{String(org?.name)}</p>
          <p className="text-sm text-gray-500">{String(org?.type)} · {String(org?.city)}</p>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Status</h3>
          <StatusBadge status={String(payment.status)} />
          <p className="text-sm text-gray-500 mt-2">Risk: {String(payment.riskLevel)}</p>
          <p className="text-sm text-gray-500">Reconciliation: {String(payment.reconciliationStatus || '—')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Transaction Details</h3>
          <dl className="space-y-2 text-sm">
            {[
              ['Transaction ID', payment.transactionId],
              ['Gateway', payment.gateway],
              ['Gateway Order ID', payment.gatewayOrderId],
              ['Gateway Payment ID', payment.gatewayPaymentId],
              ['Payment Method', String(payment.method).replace(/_/g, ' ')],
              ['Currency', payment.currency],
              ['Platform Fee', formatCurrency(Number(payment.platformFee || 0))],
              ['Provider Share', formatCurrency(Number(payment.providerShare || 0))],
              ['Created', formatDate(payment.createdAt as string)],
              ['Captured', payment.capturedAt ? formatDate(payment.capturedAt as string) : '—'],
              ['Paid', payment.paidAt ? formatDate(payment.paidAt as string) : '—'],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex justify-between">
                <dt className="text-gray-500">{String(label)}</dt>
                <dd className="font-medium text-right">{String(value ?? '—')}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Webhook & Verification</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={payment.webhookVerified ? 'text-green-600' : 'text-gray-400'}>
                {payment.webhookVerified ? '✓' : '○'} Verified
              </span>
              <span className="text-gray-500">· Status: {String(payment.webhookStatus || 'PENDING')}</span>
            </div>
            {Boolean(appointment) && (
              <div>
                <p className="text-gray-500">Linked Appointment</p>
                <p className="font-mono">{String(appointment?.appointmentNumber)}</p>
                <p className="text-gray-500 text-xs mt-1">Bill: {String(bill?.billNumber)}</p>
              </div>
            )}
            {Number(payment.refundAmount) > 0 && (
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="font-medium text-red-700">Refund: {formatCurrency(Number(payment.refundAmount))}</p>
                <p className="text-red-600 text-xs mt-1">{String(payment.refundReason)}</p>
                <p className="text-red-600 text-xs">Refund ID: {String(payment.refundId || '—')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {overview?.auditLogs && overview.auditLogs.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Audit Trail</h3>
          <div className="space-y-2">
            {overview.auditLogs.map((log) => (
              <div key={String(log.id)} className="flex justify-between text-sm border-b border-gray-100 pb-2">
                <span>{String(log.action)}</span>
                <span className="text-gray-500">{(log.user as { email?: string })?.email} · {formatDate(log.createdAt as string)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export function PaymentExceptionsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['pay-exceptions'],
    queryFn: () => api.get('/admin/payments/exceptions'),
  });
  const exceptions = (data?.data as { level: string; message: string; paymentId?: string }[]) || [];

  const retryVerify = async (paymentId: string) => {
    await api.post(`/admin/payments/${paymentId}/verify`, {});
    qc.invalidateQueries({ queryKey: ['pay-exceptions'] });
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Payment Exceptions"
        subtitle="Auto-flagged mismatches — resolve, retry, or investigate"
        actions={<Link to={PM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      {isLoading ? <LoadingState /> : exceptions.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No payment exceptions detected</div>
      ) : (
        <div className="space-y-3">
          {exceptions.map((ex, i) => (
            <div key={i} className={`card p-4 flex flex-wrap items-center justify-between gap-3 ${levelColor(ex.level)}`}>
              <div>
                <p className="font-medium">{ex.message}</p>
              </div>
              <div className="flex gap-2">
                {ex.paymentId && (
                  <>
                    <Link to={`${PM_BASE}/payments/${ex.paymentId}`} className="btn-secondary text-xs">Investigate</Link>
                    <ActionBtn onClick={() => retryVerify(ex.paymentId!)}>Retry Verify</ActionBtn>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
