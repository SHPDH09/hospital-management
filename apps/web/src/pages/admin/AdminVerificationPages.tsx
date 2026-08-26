import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { PageHeader, StatGrid, AdminTable, StatusBadge, LoadingState } from '@/components/admin/AdminComponents';
import { api } from '@/lib/api';

export function AdminVerificationDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-verification-dashboard'],
    queryFn: () => api.get('/admin/verification/dashboard'),
  });
  const stats = data?.data as Record<string, number> | undefined;

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Verification Center" subtitle="Review and approve provider applications" />
      {isLoading ? <LoadingState /> : stats && (
        <StatGrid stats={[
          { label: 'Total Applications', value: stats.totalApplications || 0 },
          { label: 'Pending', value: stats.pending || 0 },
          { label: 'Under Review', value: stats.underReview || 0 },
          { label: 'Documents Required', value: stats.documentsRequired || 0 },
          { label: 'Approved', value: stats.approved || 0 },
          { label: 'Rejected', value: stats.rejected || 0 },
          { label: 'Re-verification', value: stats.reVerification || 0 },
          { label: 'High Risk', value: stats.highRisk || 0 },
          { label: 'SLA Breached', value: stats.slaBreached || 0 },
        ]} />
      )}
      <div className="mt-6">
        <Link to="/admin/verification/applications" className="btn-primary">View Application Queue</Link>
      </div>
    </DashboardLayout>
  );
}

export function AdminVerificationApplicationsPage() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-verification-apps', status, type],
    queryFn: () => api.get(`/admin/verification/applications?${new URLSearchParams({ ...(status && { status }), ...(type && { type }) }).toString()}`),
  });
  const apps = (data?.data as Record<string, unknown>[]) || [];

  return (
    <DashboardLayout portal="admin">
      <PageHeader title="Application Queue" subtitle="Hospital, clinic, doctor, AASHA and referral applications" />
      <div className="flex flex-wrap gap-3 mb-6">
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['SUBMITTED', 'UNDER_REVIEW', 'DOCUMENTS_REQUIRED', 'APPROVED', 'REJECTED', 'RE_VERIFICATION_REQUIRED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          {['HOSPITAL', 'CLINIC', 'DOCTOR', 'ASHA', 'REFERRAL_PARTNER'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      {isLoading ? <LoadingState /> : (
        <AdminTable
          columns={[
            { key: 'applicationNumber', label: 'Application ID' },
            { key: 'type', label: 'Type' },
            { key: 'name', label: 'Provider', render: (r) => {
              const org = r.organization as { name?: string } | undefined;
              const doc = r.doctor as { fullName?: string } | undefined;
              const asha = r.ashaProfile as { ashaName?: string } | undefined;
              const partner = r.referralPartner as { referralPartnerName?: string } | undefined;
              return String(org?.name || doc?.fullName || asha?.ashaName || partner?.referralPartnerName || '—');
            }},
            { key: 'status', label: 'Status', render: (r) => <StatusBadge status={String(r.status)} /> },
            { key: 'riskLevel', label: 'Risk', render: (r) => <span>{String(r.riskLevel)} ({String(r.riskScore)})</span> },
            { key: 'submittedAt', label: 'Submitted', render: (r) => r.submittedAt ? new Date(String(r.submittedAt)).toLocaleDateString() : '—' },
            { key: 'actions', label: '', render: (r) => <Link to={`/admin/verification/applications/${r.id}`} className="text-primary-600 text-sm">Review</Link> },
          ]}
          rows={apps}
          emptyMessage="No applications found"
        />
      )}
    </DashboardLayout>
  );
}

export function AdminVerificationDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-verification-app', id],
    queryFn: () => api.get(`/admin/verification/applications/${id}`),
    enabled: Boolean(id),
  });
  const { data: verifiers } = useQuery({
    queryKey: ['admin-verifiers'],
    queryFn: () => api.get('/admin/verification/verifiers'),
  });

  const app = data?.data as Record<string, unknown> | undefined;
  const documents = (app?.documents as Record<string, unknown>[]) || [];
  const auditLogs = (app?.auditLogs as Record<string, unknown>[]) || [];
  const checklist = (app?.checklist as Record<string, boolean>) || {};
  const [rejectReason, setRejectReason] = useState('');
  const [docRejectReason, setDocRejectReason] = useState('');
  const [selectedDoc, setSelectedDoc] = useState('');
  const [verifierId, setVerifierId] = useState('');
  const [msg, setMsg] = useState('');

  const assign = async () => {
    await api.post(`/admin/verification/applications/${id}/assign`, { verifierId });
    qc.invalidateQueries({ queryKey: ['admin-verification-app', id] });
    setMsg('Verifier assigned');
  };

  const approve = async () => {
    await api.post(`/admin/verification/applications/${id}/approve`, { checklist });
    qc.invalidateQueries({ queryKey: ['admin-verification-app', id] });
    setMsg('Application approved — account activated');
  };

  const reject = async () => {
    await api.post(`/admin/verification/applications/${id}/reject`, { reason: rejectReason });
    qc.invalidateQueries({ queryKey: ['admin-verification-app', id] });
    setMsg('Application rejected');
  };

  const verifyDoc = async (docId: string) => {
    await api.patch(`/admin/verification/documents/${docId}/verify`, {});
    qc.invalidateQueries({ queryKey: ['admin-verification-app', id] });
  };

  const rejectDoc = async () => {
    await api.patch(`/admin/verification/documents/${selectedDoc}/reject`, { reason: docRejectReason });
    qc.invalidateQueries({ queryKey: ['admin-verification-app', id] });
    setDocRejectReason('');
    setSelectedDoc('');
  };

  if (isLoading) return <DashboardLayout portal="admin"><LoadingState /></DashboardLayout>;
  if (!app) return <DashboardLayout portal="admin"><p>Application not found</p></DashboardLayout>;

  const org = app.organization as Record<string, unknown> | undefined;

  return (
    <DashboardLayout portal="admin">
      <PageHeader
        title={String(app.applicationNumber)}
        subtitle={`${String(app.type)} — ${String(org?.name || '')}`}
        actions={<StatusBadge status={String(app.status)} />}
      />
      {msg && <p className="text-sm text-green-600 mb-4">{msg}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Application Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Risk Score</span><p>{String(app.riskScore)}/100 ({String(app.riskLevel)})</p></div>
              <div><span className="text-gray-500">Submitted</span><p>{app.submittedAt ? new Date(String(app.submittedAt)).toLocaleString() : '—'}</p></div>
              {org && (
                <>
                  <div><span className="text-gray-500">Email</span><p>{String(org.email || '—')}</p></div>
                  <div><span className="text-gray-500">City</span><p>{String(org.city || '—')}</p></div>
                </>
              )}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-4">Documents</h3>
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={String(doc.id)} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <p className="font-medium">{String(doc.documentType)}</p>
                    <a href={String(doc.fileUrl)} target="_blank" rel="noreferrer" className="text-xs text-primary-600">View</a>
                    {Boolean(doc.rejectionReason) && <p className="text-xs text-red-600">{String(doc.rejectionReason)}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={String(doc.status)} />
                    {doc.status === 'PENDING' && (
                      <>
                        <button type="button" className="text-xs text-green-600" onClick={() => verifyDoc(String(doc.id))}>Verify</button>
                        <button type="button" className="text-xs text-red-600" onClick={() => setSelectedDoc(String(doc.id))}>Reject</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {selectedDoc && (
              <div className="mt-4 p-3 border rounded-lg">
                <input className="input mb-2" placeholder="Rejection reason (required)" value={docRejectReason} onChange={(e) => setDocRejectReason(e.target.value)} />
                <button type="button" className="btn-primary text-sm" onClick={rejectDoc}>Confirm Reject</button>
              </div>
            )}
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-4">Verification Checklist</h3>
            <ul className="space-y-2 text-sm">
              {Object.entries(checklist).map(([key, val]) => (
                <li key={key} className="flex items-center gap-2">
                  <span>{val ? '☑' : '☐'}</span> {key.replace(/([A-Z])/g, ' $1')}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-4">Audit Trail</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
              {auditLogs.map((log) => (
                <div key={String(log.id)} className="p-2 bg-gray-50 rounded">
                  <p className="font-medium">{String(log.action)}</p>
                  <p className="text-xs text-gray-500">{new Date(String(log.createdAt)).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-semibold mb-3">Assign Verifier</h3>
            <select className="input mb-3" value={verifierId} onChange={(e) => setVerifierId(e.target.value)}>
              <option value="">Select verifier</option>
              {((verifiers?.data as { id: string; email: string }[]) || []).map((v) => (
                <option key={v.id} value={v.id}>{v.email}</option>
              ))}
            </select>
            <button type="button" className="btn-primary w-full" disabled={!verifierId} onClick={assign}>Assign</button>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold mb-3">Decision</h3>
            <button type="button" className="btn-primary w-full mb-3" onClick={approve}>Approve Application</button>
            <textarea className="input mb-2" rows={3} placeholder="Rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <button type="button" className="btn w-full border border-red-200 text-red-600" disabled={!rejectReason} onClick={reject}>Reject Application</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
