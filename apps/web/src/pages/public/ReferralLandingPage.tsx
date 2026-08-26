import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { api } from '@/lib/api';

export function ReferralLandingPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    localStorage.setItem('referral_code', code);
    api.get(`/public/referral/${code}`).then((res) => {
      if (res.success && res.data) {
        setData(res.data as Record<string, unknown>);
        const d = res.data as Record<string, unknown>;
        localStorage.setItem('referral_attribution', JSON.stringify({
          referralCode: d.referralCode,
          campaignId: d.campaignId,
          organizationId: d.organizationId,
          ashaProfileId: d.ashaProfileId,
          referralPartnerId: d.referralPartnerId,
          referralType: d.referralType,
        }));
      } else {
        setError(res.error || 'Invalid referral link');
      }
      setLoading(false);
    });
  }, [code]);

  if (loading) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center text-gray-500">Loading...</div>
      </PublicLayout>
    );
  }

  if (error || !data) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="card p-8 text-center max-w-md">
            <h1 className="text-xl font-bold text-red-600">Invalid Referral Link</h1>
            <p className="text-gray-500 mt-2">{error}</p>
            <Link to="/" className="btn-primary mt-4 inline-block">Go to Homepage</Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const org = data.organization as { name?: string; slug?: string; city?: string; logoUrl?: string; description?: string } | undefined;

  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="card p-8 text-center">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full text-sm mb-6">
            <span>Referred by</span>
            <strong>{String(data.referralName)}</strong>
            <span className="text-xs">({String(data.referralType)})</span>
          </div>

          <h1 className="text-2xl font-bold mb-2">Find Healthcare Near You</h1>
          <p className="text-gray-500 mb-8">Book appointments with trusted healthcare providers</p>

          {org && (
            <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
              {org.logoUrl && <img src={org.logoUrl} alt="" className="h-12 mb-3" />}
              <h2 className="font-semibold text-lg">{org.name}</h2>
              {org.city && <p className="text-sm text-gray-500">{org.city}</p>}
              {org.description && <p className="text-sm text-gray-600 mt-2">{org.description}</p>}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={`/register?ref=${code}&org=${data.organizationId || ''}`}
              className="btn-primary px-8 py-3"
              onClick={() => api.post(`/public/referral/${code}/form-started`, {})}
            >
              Register / Create Account
            </Link>
            {org?.slug && (
              <Link to={`/organizations/${org.slug}`} className="btn-secondary px-8 py-3">
                View Hospital
              </Link>
            )}
            <Link to="/book" className="btn-secondary px-8 py-3">Book Appointment</Link>
          </div>

          <p className="text-xs text-gray-400 mt-6">Your referral source is automatically captured. No manual selection needed.</p>
        </div>
      </div>
    </PublicLayout>
  );
}
