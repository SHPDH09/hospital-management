import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, AdminTable, StatusBadge, LoadingState, ActionBtn } from '@/components/admin/AdminComponents';
import { api, apiBaseUrl } from '@/lib/api';
import { formatDate } from '@/lib/utils';

const RM_BASE = '/admin/review-management';

const REVIEW_STATUSES = [
  'PENDING', 'UNDER_MODERATION', 'APPROVED', 'REJECTED', 'HIDDEN',
  'REPORTED', 'FLAGGED', 'REMOVED', 'RESTORED',
];

const REVIEW_TYPES = ['HOSPITAL', 'CLINIC', 'DOCTOR', 'SERVICE', 'APPOINTMENT'];

function starRating(rating: number) {
  return '⭐'.repeat(Math.min(5, Math.max(0, rating)));
}

function levelColor(level: string) {
  if (level === 'red') return 'text-red-600 bg-red-50';
  if (level === 'orange') return 'text-orange-600 bg-orange-50';
  return 'text-yellow-700 bg-yellow-50';
}

export function ReviewManagementDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['rm-dashboard'],
    queryFn: () => api.get('/admin/reviews/dashboard'),
  });
  const stats = data?.data as Record<string, unknown> | undefined;
  const breakdown = stats?.ratingBreakdown as Record<string, number> | undefined;
  const negativeAlerts = (stats?.negativeAlerts as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Review Management"
        subtitle="Reputation management — moderation, verification, ratings & analytics"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`${RM_BASE}/reviews`} className="btn-primary text-sm">All Reviews</Link>
            <Link to={`${RM_BASE}/pending`} className="btn-secondary text-sm">Pending Moderation</Link>
            <Link to={`${RM_BASE}/reported`} className="btn-secondary text-sm">Reported</Link>
            <Link to={`${RM_BASE}/fraud`} className="btn-secondary text-sm">Fraud Flags</Link>
            <a href={`${apiBaseUrl}/admin/reviews/export`} className="btn-secondary text-sm" target="_blank" rel="noreferrer">Export CSV</a>
          </div>
        }
      />
      {isLoading ? <LoadingState /> : stats && (
        <>
          <StatGrid stats={[
            { label: 'Total Reviews', value: Number(stats.totalReviews || 0) },
            { label: 'Reviews Today', value: Number(stats.reviewsToday || 0) },
            { label: 'This Month', value: Number(stats.reviewsThisMonth || 0) },
            { label: 'Pending Moderation', value: Number(stats.pendingModeration || 0) },
            { label: 'Approved', value: Number(stats.approvedReviews || 0) },
            { label: 'Rejected', value: Number(stats.rejectedReviews || 0) },
            { label: 'Reported', value: Number(stats.reportedReviews || 0) },
            { label: 'Hidden', value: Number(stats.hiddenReviews || 0) },
            { label: 'Flagged', value: Number(stats.flaggedReviews || 0) },
            { label: 'Verified Visits', value: Number(stats.verifiedReviews || 0) },
            { label: 'Avg Platform Rating', value: `${Number(stats.averagePlatformRating || 0).toFixed(1)} ⭐` },
            { label: 'Hospital Rating', value: `${Number(stats.hospitalRating || 0).toFixed(1)} ⭐` },
            { label: 'Clinic Rating', value: `${Number(stats.clinicRating || 0).toFixed(1)} ⭐` },
            { label: 'Doctor Rating', value: `${Number(stats.doctorRating || 0).toFixed(1)} ⭐` },
            { label: '5 Star', value: Number(stats.fiveStarReviews || 0) },
            { label: '4 Star', value: Number(stats.fourStarReviews || 0) },
            { label: '3 Star', value: Number(stats.threeStarReviews || 0) },
            { label: '2 Star', value: Number(stats.twoStarReviews || 0) },
            { label: '1 Star', value: Number(stats.oneStarReviews || 0) },
          ]} />

          {breakdown && (
            <div className="mt-8 card p-6">
              <h3 className="font-semibold mb-4">Rating Breakdown</h3>
              <div className="space-y-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = breakdown[String(star)] || 0;
                  const total = Number(stats.totalReviews) || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={star} className="flex items-center gap-3 text-sm">
                      <span className="w-12">{star} ⭐</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-16 text-right text-gray-500">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {negativeAlerts.length > 0 && (
            <div className="mt-8 card p-6">
              <h3 className="font-semibold mb-4 text-red-700">⚠ Negative Review Alerts</h3>
              <div className="space-y-2">
                {negativeAlerts.map((r) => (
                  <div key={String(r.id)} className="flex justify-between items-center p-3 bg-red-50 rounded-lg text-sm">
                    <div>
                      <span className="font-medium">{(r.organization as { name?: string })?.name}</span>
                      <span className="mx-2">·</span>
                      <span>{starRating(Number(r.rating))}</span>
                      <span className="text-gray-500 ml-2">{(r.patient as { fullName?: string })?.fullName}</span>
                    </div>
                    <Link to={`${RM_BASE}/reviews/${r.id}`} className="text-primary-600 font-medium">Investigate</Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 card p-6 bg-gray-50">
            <h3 className="font-semibold mb-2">Verified Review Rule</h3>
            <p className="text-sm text-gray-600">
              Reviews should be linked to completed appointments/visits. Patient → Appointment → Checked-In → Completed → Review Eligible.
              Only verified interactions reduce fake review risk.
            </p>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

interface ReviewListProps {
  presetStatus?: string;
  reportedOnly?: boolean;
  title?: string;
}

export function ReviewManagementListPage({ presetStatus, reportedOnly, title }: ReviewListProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(presetStatus || '');
  const [type, setType] = useState('');
  const [rating, setRating] = useState('');

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (type) params.set('type', type);
  if (rating) params.set('rating', rating);
  if (reportedOnly) params.set('reported', 'true');
  params.set('limit', '50');

  const { data, isLoading } = useQuery({
    queryKey: ['rm-reviews', params.toString()],
    queryFn: () => api.get(`/admin/reviews?${params.toString()}`),
  });

  const rows = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={title || 'All Reviews'}
        subtitle="Platform-wide review registry"
        actions={<Link to={RM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <input className="input text-sm" placeholder="Review ID, patient, provider..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input text-sm w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Status</option>
          {REVIEW_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="input text-sm w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          {REVIEW_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input text-sm w-auto" value={rating} onChange={(e) => setRating(e.target.value)}>
          <option value="">All Ratings</option>
          {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} Star</option>)}
        </select>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable
          columns={[
            { key: 'review', label: 'Review', render: (r) => (
              <div>
                <p className="font-mono text-xs">{String(r.reviewNumber)}</p>
                <p className="text-sm max-w-xs truncate">{String(r.comment || '—')}</p>
              </div>
            )},
            { key: 'patient', label: 'Patient', render: (r) => {
              const p = r.patient as { fullName?: string; globalPatientId?: string };
              return r.isAnonymous ? 'Anonymous' : (
                <div>
                  <p className="font-medium">{p?.fullName}</p>
                  <p className="text-xs text-gray-500">{p?.globalPatientId}</p>
                </div>
              );
            }},
            { key: 'provider', label: 'Provider', render: (r) => String((r.organization as { name?: string })?.name || '—') },
            { key: 'doctor', label: 'Doctor', render: (r) => String((r.doctor as { fullName?: string })?.fullName || '—') },
            { key: 'rating', label: 'Rating', render: (r) => starRating(Number(r.rating)) },
            { key: 'status', label: 'Status', render: (r) => (
              <div className="flex flex-col gap-1">
                <StatusBadge status={String(r.status)} />
                {Boolean(r.isVerifiedVisit) && <span className="text-xs text-green-600">✓ Verified</span>}
              </div>
            )},
            { key: 'date', label: 'Date', render: (r) => formatDate(r.createdAt as string) },
            { key: 'actions', label: 'Action', render: (r) => (
              <Link to={`${RM_BASE}/reviews/${r.id}`} className="text-xs text-primary-600 font-medium">Manage</Link>
            )},
          ]}
          rows={rows}
          emptyMessage="No reviews found"
        />
      )}
    </DashboardLayout>
  );
}

export function ReviewManagementDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['rm-review', id],
    queryFn: () => api.get(`/admin/reviews/${id}`),
    enabled: Boolean(id),
  });

  const overview = data?.data as {
    review: Record<string, unknown>;
    auditLogs: Record<string, unknown>[];
  } | undefined;

  const review = overview?.review;
  const patient = review?.patient as Record<string, unknown> | undefined;
  const org = review?.organization as Record<string, unknown> | undefined;
  const doctor = review?.doctor as Record<string, unknown> | undefined;
  const appointment = review?.appointment as Record<string, unknown> | undefined;
  const activities = (review?.activities as Record<string, unknown>[]) || [];
  const reports = (review?.reports as Record<string, unknown>[]) || [];

  if (isLoading) return <DashboardLayout portal="admin"><LoadingState /></DashboardLayout>;
  if (!review) return <DashboardLayout portal="admin"><p>Review not found</p></DashboardLayout>;

  const moderate = async (status: string) => {
    const reason = ['REJECTED', 'HIDDEN', 'REMOVED'].includes(status) ? prompt('Moderation reason:') : undefined;
    if (['REJECTED', 'HIDDEN', 'REMOVED'].includes(status) && !reason) return;
    await api.post(`/admin/reviews/${id}/moderate`, { status, reason });
    qc.invalidateQueries({ queryKey: ['rm-review', id] });
  };

  const flagReview = async () => {
    const reason = prompt('Flag reason:');
    if (!reason) return;
    await api.post(`/admin/reviews/${id}/flag`, { reason });
    qc.invalidateQueries({ queryKey: ['rm-review', id] });
  };

  const addResponse = async () => {
    const response = prompt('Provider response:');
    if (!response || response.length < 5) return;
    await api.post(`/admin/reviews/${id}/response`, { response });
    qc.invalidateQueries({ queryKey: ['rm-review', id] });
  };

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={String(review.reviewNumber)}
        subtitle={`${starRating(Number(review.rating))} · ${String(review.type)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => navigate(`${RM_BASE}/reviews`)}>← Back</button>
            {review.status !== 'APPROVED' && <ActionBtn onClick={() => moderate('APPROVED')}>Approve</ActionBtn>}
            {review.status !== 'HIDDEN' && <ActionBtn onClick={() => moderate('HIDDEN')}>Hide</ActionBtn>}
            {review.status !== 'REJECTED' && <ActionBtn variant="danger" onClick={() => moderate('REJECTED')}>Reject</ActionBtn>}
            {review.status === 'HIDDEN' && <ActionBtn onClick={() => moderate('RESTORED')}>Restore</ActionBtn>}
            <ActionBtn onClick={flagReview}>Flag</ActionBtn>
            <ActionBtn onClick={addResponse}>Add Response</ActionBtn>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Patient</h3>
          {review.isAnonymous ? (
            <p className="text-gray-500">Anonymous Patient</p>
          ) : (
            <>
              <p className="font-medium">{String(patient?.fullName)}</p>
              <p className="text-sm text-gray-500 font-mono">{String(patient?.globalPatientId)}</p>
            </>
          )}
          {Boolean(review.isVerifiedVisit) && (
            <span className="inline-block mt-2 text-xs bg-green-50 text-green-700 px-2 py-1 rounded">✓ Verified Visit</span>
          )}
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Provider</h3>
          <p className="font-medium">{String(org?.name || '—')}</p>
          <p className="text-sm text-gray-500">{String(org?.type || '')} · {String(org?.city || '')}</p>
          {Boolean(doctor) && <p className="text-sm mt-2">Dr. {String(doctor?.fullName)}</p>}
          {Boolean(appointment) && (
            <p className="text-sm text-gray-500 mt-1 font-mono">APT: {String(appointment?.appointmentNumber)}</p>
          )}
        </div>
        <div className="card p-6">
          <h3 className="font-semibold mb-3">Moderation</h3>
          <StatusBadge status={String(review.status)} />
          <p className="text-sm text-gray-500 mt-2">Risk: {String(review.riskScore)}</p>
          <p className="text-sm text-gray-500">Sentiment: {String(review.sentiment || '—')}</p>
          <p className="text-sm text-gray-500">Reports: {Number(review.reportCount)}</p>
          {Boolean(review.moderationReason) && (
            <p className="text-sm text-red-600 mt-2">Reason: {String(review.moderationReason)}</p>
          )}
        </div>
      </div>

      <div className="card p-6 mb-8">
        <h3 className="font-semibold mb-3">Review Content</h3>
        <p className="text-lg mb-4">{starRating(Number(review.rating))}</p>
        <p className="text-gray-700">{String(review.comment || 'No comment')}</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          {[
            ['Doctor', review.doctorRating],
            ['Staff', review.staffRating],
            ['Cleanliness', review.cleanlinessRating],
            ['Waiting', review.waitingRating],
            ['Facilities', review.facilitiesRating],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={String(label)} className="bg-gray-50 p-2 rounded">
              <p className="text-gray-500 text-xs">{String(label)}</p>
              <p>{starRating(Number(value))}</p>
            </div>
          ))}
        </div>
        {Boolean(review.response) && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-semibold text-blue-800 mb-1">Provider Response</p>
            <p className="text-sm text-blue-900">{String(review.response)}</p>
          </div>
        )}
      </div>

      {reports.length > 0 && (
        <div className="card p-6 mb-8">
          <h3 className="font-semibold mb-4">Reports</h3>
          <div className="space-y-3">
            {reports.map((rep) => (
              <div key={String(rep.id)} className="border-b pb-2 text-sm">
                <p className="font-medium">{String(rep.reason)}</p>
                <p className="text-gray-500">{String(rep.details || '')}</p>
                <StatusBadge status={String(rep.status)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-6">
        <h3 className="font-semibold mb-4">Activity Timeline</h3>
        {activities.length === 0 ? <p className="text-sm text-gray-500">No activity</p> : (
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={String(a.id)} className="border-l-2 border-primary-200 pl-3 text-sm">
                <p className="font-medium">{String(a.action).replace(/_/g, ' ')}</p>
                {Boolean(a.notes) && <p className="text-gray-600">{String(a.notes)}</p>}
                <p className="text-xs text-gray-400">
                  {(a.user as { email?: string })?.email} · {formatDate(a.createdAt as string)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export function ReviewFraudFlagsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['rm-fraud'],
    queryFn: () => api.get('/admin/reviews/fraud-flags'),
  });
  const flags = (data?.data as { level: string; message: string; reviewId?: string }[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title="Fraud Detection"
        subtitle="Suspicious reviews flagged for investigation"
        actions={<Link to={RM_BASE} className="text-sm text-primary-600">← Dashboard</Link>}
      />
      {isLoading ? <LoadingState /> : flags.length === 0 ? (
        <div className="card p-8 text-center text-gray-500">No fraud flags detected</div>
      ) : (
        <div className="space-y-3">
          {flags.map((f, i) => (
            <div key={i} className={`card p-4 flex justify-between items-center ${levelColor(f.level)}`}>
              <p className="font-medium">{f.message}</p>
              {f.reviewId && (
                <Link to={`${RM_BASE}/reviews/${f.reviewId}`} className="btn-secondary text-xs">Investigate</Link>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
