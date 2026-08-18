import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Clock, FileText, AlertTriangle, Upload } from 'lucide-react';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { StatusBadge } from '@/components/admin/AdminComponents';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

interface VerificationApplication {
  id: string;
  applicationNumber: string;
  status: string;
  submittedAt?: string;
  rejectionReason?: string;
  riskScore?: number;
  riskLevel?: string;
  documents?: {
    id: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
    status: string;
    rejectionReason?: string;
  }[];
}

const DOC_LABELS: Record<string, string> = {
  REGISTRATION_CERTIFICATE: 'Registration Certificate',
  LICENSE: 'License',
  ADDRESS_PROOF: 'Address Proof',
  AUTHORIZED_PERSON_ID: 'Authorized Person ID',
};

export function VerificationPendingPage() {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['verification-status'],
    queryFn: () => api.get<{ accountActivated: boolean; application: VerificationApplication }>('/verification/status'),
  });

  const [uploadForm, setUploadForm] = useState({ documentType: 'ADDRESS_PROOF', fileName: '', fileUrl: '' });
  const [reuploadId, setReuploadId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const app = data?.data?.application;
  const activated = data?.data?.accountActivated;

  if (activated) {
    return (
      <PublicLayout>
        <div className="max-w-lg mx-auto py-20 text-center">
          <p className="text-green-600 font-semibold mb-4">Your account is verified!</p>
          <Link to="/crm" className="btn-primary">Go to Dashboard</Link>
        </div>
      </PublicLayout>
    );
  }

  const uploadDoc = async () => {
    try {
      if (reuploadId) {
        await api.post(`/verification/documents/${reuploadId}/reupload`, {
          fileName: uploadForm.fileName,
          fileUrl: uploadForm.fileUrl,
        });
      } else {
        await api.post('/verification/documents', uploadForm);
      }
      setMsg('Document uploaded successfully');
      setReuploadId(null);
      setUploadForm({ documentType: 'ADDRESS_PROOF', fileName: '', fileUrl: '' });
      qc.invalidateQueries({ queryKey: ['verification-status'] });
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const submittedCount = app?.documents?.length || 0;
  const rejectedDocs = app?.documents?.filter((d) => d.status === 'REJECTED' || d.status === 'REUPLOAD_REQUIRED') || [];

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="card p-8">
          <div className="text-center mb-8">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4">
              <Clock className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Your account is under verification</h1>
            <p className="text-gray-500 mt-2">Full dashboard access will be enabled after authorized approval.</p>
          </div>

          {isLoading ? (
            <p className="text-center text-gray-500">Loading application...</p>
          ) : app ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Application ID</p>
                  <p className="font-mono font-semibold">{app.applicationNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500">Status</p>
                  <StatusBadge status={app.status} />
                </div>
                <div>
                  <p className="text-gray-500">Submitted</p>
                  <p>{app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Documents</p>
                  <p>{submittedCount} submitted</p>
                </div>
              </div>

              {app.rejectionReason && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Application Rejected
                  </p>
                  <p className="text-sm text-red-700 mt-1">{app.rejectionReason}</p>
                </div>
              )}

              {app.documents && app.documents.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><FileText className="h-4 w-4" /> Documents</h3>
                  <div className="space-y-2">
                    {app.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                        <div>
                          <p className="font-medium">{DOC_LABELS[doc.documentType] || doc.documentType}</p>
                          <p className="text-xs text-gray-500">{doc.fileName}</p>
                          {doc.rejectionReason && <p className="text-xs text-red-600 mt-1">{doc.rejectionReason}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={doc.status} />
                          {(doc.status === 'REJECTED' || doc.status === 'REUPLOAD_REQUIRED') && (
                            <button type="button" className="text-xs text-primary-600" onClick={() => setReuploadId(doc.id)}>
                              Re-upload
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(reuploadId || app.status === 'DOCUMENTS_REQUIRED' || rejectedDocs.length > 0) && (
                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Upload className="h-4 w-4" /> {reuploadId ? 'Re-upload Document' : 'Upload Document'}
                  </h3>
                  {!reuploadId && (
                    <select className="input mb-3" value={uploadForm.documentType}
                      onChange={(e) => setUploadForm({ ...uploadForm, documentType: e.target.value })}>
                      {Object.entries(DOC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  )}
                  <input className="input mb-3" placeholder="File name" value={uploadForm.fileName}
                    onChange={(e) => setUploadForm({ ...uploadForm, fileName: e.target.value })} />
                  <input className="input mb-3" placeholder="Document URL (https://...)" value={uploadForm.fileUrl}
                    onChange={(e) => setUploadForm({ ...uploadForm, fileUrl: e.target.value })} />
                  <button type="button" className="btn-primary" onClick={uploadDoc}>Upload</button>
                </div>
              )}

              <p className="text-sm text-gray-500 text-center">
                Expected review: Pending verification team review
              </p>
            </div>
          ) : (
            <p className="text-center text-gray-500">No verification application found. Contact support.</p>
          )}

          {msg && <p className="text-sm text-center text-green-600 mt-4">{msg}</p>}

          <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-center">
            <Link to="/support" className="btn-secondary text-center">Contact Support</Link>
            <button type="button" className="btn border border-gray-200" onClick={logout}>Logout</button>
          </div>
          {user?.email && <p className="text-xs text-center text-gray-400 mt-4">Logged in as {user.email}</p>}
        </div>
      </div>
    </PublicLayout>
  );
}
