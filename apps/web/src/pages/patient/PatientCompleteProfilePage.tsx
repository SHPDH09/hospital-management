import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Step = 'basic' | 'contact' | 'address' | 'emergency' | 'consent';

const STEPS: { key: Step; label: string }[] = [
  { key: 'basic', label: 'Basic Details' },
  { key: 'contact', label: 'Contact Details' },
  { key: 'address', label: 'Address' },
  { key: 'emergency', label: 'Emergency Contact' },
  { key: 'consent', label: 'Consent' },
];

export function PatientCompleteProfilePage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['patient-profile'],
    queryFn: () => api.get('/patients/me/profile'),
  });

  const profile = data?.data as {
    fullName?: string;
    profilePhoto?: string;
    dateOfBirth?: string;
    gender?: string;
    email?: string;
    emailVerified?: boolean;
    phone?: string;
    phoneVerified?: boolean;
    profileCompleted?: boolean;
    alternatePhone?: string;
    country?: string;
    state?: string;
    city?: string;
    address?: string;
    pinCode?: string;
    bloodGroup?: string;
    emergencyContactName?: string;
    emergencyContact?: string;
    emergencyContactRelation?: string;
    completion?: {
      percent?: number;
      currentStep?: Step;
      steps?: { key: Step; label: string; complete: boolean }[];
      missing?: string[];
    };
  } | undefined;
  const completion = profile?.completion;

  const [step, setStep] = useState<Step>('basic');
  const [form, setForm] = useState({
    fullName: '', profilePhoto: '', dateOfBirth: '', gender: '',
    phone: '', otp: '', alternatePhone: '',
    country: 'India', state: '', city: '', address: '', pinCode: '',
    bloodGroup: '', emergencyContactName: '', emergencyContact: '', emergencyContactRelation: '',
    termsAccepted: false, privacyAccepted: false, healthConsent: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        fullName: String(profile.fullName || ''),
        profilePhoto: String(profile.profilePhoto || ''),
        dateOfBirth: profile.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '',
        gender: String(profile.gender || ''),
        phone: String(profile.phone || ''),
        alternatePhone: String(profile.alternatePhone || ''),
        country: String(profile.country || 'India'),
        state: String(profile.state || ''),
        city: String(profile.city || ''),
        address: String(profile.address || ''),
        pinCode: String(profile.pinCode || ''),
        bloodGroup: String(profile.bloodGroup || ''),
        emergencyContactName: String(profile.emergencyContactName || ''),
        emergencyContact: String(profile.emergencyContact || ''),
        emergencyContactRelation: String(profile.emergencyContactRelation || ''),
      }));
      if (completion?.currentStep) setStep(completion.currentStep);
      if (profile.profileCompleted) setDone(true);
    }
  }, [profile, completion?.currentStep]);

  const saveStep = async (nextStep?: Step) => {
    setError('');
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: form.fullName,
        profilePhoto: form.profilePhoto || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        alternatePhone: form.alternatePhone || undefined,
        country: form.country,
        state: form.state,
        city: form.city,
        address: form.address,
        pinCode: form.pinCode,
        bloodGroup: form.bloodGroup || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContact: form.emergencyContact || undefined,
        emergencyContactRelation: form.emergencyContactRelation || undefined,
        profileCompletionStep: nextStep || step,
      };
      await api.patch('/patients/me/profile', payload);
      qc.invalidateQueries({ queryKey: ['patient-profile'] });
      if (nextStep) setStep(nextStep);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/patients/me/profile/send-mobile-otp', { phone: form.phone });
      if (!res.success) throw new Error(res.error);
      setOtpSent(true);
      if ((res.data as { devOtp?: string })?.devOtp) console.info('Dev OTP:', (res.data as { devOtp: string }).devOtp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/patients/me/profile/verify-mobile-otp', { phone: form.phone, otp: form.otp });
      if (!res.success) throw new Error(res.error);
      qc.invalidateQueries({ queryKey: ['patient-profile'] });
      await saveStep('address');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const acceptConsent = async () => {
    if (!form.termsAccepted || !form.privacyAccepted) {
      setError('You must accept Terms & Conditions and Privacy Policy');
      return;
    }
    setLoading(true);
    try {
      await api.post('/patients/me/profile/accept-consent', {
        termsAccepted: form.termsAccepted,
        privacyAccepted: form.privacyAccepted,
        healthConsent: form.healthConsent,
      });
      await saveStep('consent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const completeProfile = async () => {
    setLoading(true);
    try {
      const res = await api.post('/patients/me/profile/complete');
      if (!res.success) throw new Error(res.error);
      setDone(true);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile incomplete');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center text-gray-500">Loading profile...</div>
      </PublicLayout>
    );
  }

  if (done) {
    return (
      <PublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="card max-w-md p-8 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold mb-2">Profile Completed Successfully</h2>
            <p className="text-gray-500 mb-6">Your account is ready.</p>
            <button type="button" className="btn-primary px-8 py-3" onClick={() => navigate('/patient')}>Go to Dashboard</button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  const percent = completion?.percent ?? 0;

  return (
    <PublicLayout>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold text-center mb-2">Complete Your Profile</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Complete your profile to continue using the platform</p>

        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">{percent}% complete</span>
            <span className="text-gray-500">Step {STEPS.findIndex((s) => s.key === step) + 1} of {STEPS.length}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-primary-600 transition-all" style={{ width: `${percent}%` }} />
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {(completion?.steps || STEPS.map((s) => ({ ...s, complete: false }))).map((s) => (
              <span key={s.key} className={cn('text-xs px-2 py-1 rounded-full', s.complete ? 'bg-green-50 text-green-700' : step === s.key ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-gray-500')}>
                {s.label} {s.complete ? '✓' : '○'}
              </span>
            ))}
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <div className="card p-6">
          {step === 'basic' && (
            <div className="space-y-4">
              <h3 className="font-semibold">👤 Basic Details</h3>
              {form.profilePhoto && <img src={form.profilePhoto} alt="" className="w-16 h-16 rounded-full mx-auto" />}
              <input className="input" placeholder="Full Name *" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              <input type="date" className="input" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
              <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Gender *</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
              <p className="text-xs text-gray-500">Email: {String(profile?.email || '')} {profile?.emailVerified ? '(Google verified)' : ''}</p>
              <button type="button" className="btn-primary w-full" disabled={loading || !form.fullName || !form.dateOfBirth || !form.gender} onClick={() => saveStep('contact')}>Continue</button>
            </div>
          )}

          {step === 'contact' && (
            <div className="space-y-4">
              <h3 className="font-semibold">📱 Mobile Verification</h3>
              <input className="input" placeholder="Mobile Number *" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              {!otpSent ? (
                <button type="button" className="btn-secondary w-full" disabled={loading || form.phone.length < 10} onClick={sendOtp}>Send OTP</button>
              ) : (
                <>
                  <input className="input text-center text-xl tracking-widest" placeholder="Enter OTP" maxLength={6} value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '') })} />
                  <button type="button" className="btn-primary w-full" disabled={loading || form.otp.length !== 6} onClick={verifyOtp}>Verify OTP</button>
                </>
              )}
              {profile?.phoneVerified ? <p className="text-green-600 text-sm">✓ Mobile Verified</p> : null}
              <input className="input" placeholder="Alternate Phone (optional)" value={form.alternatePhone} onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })} />
              {profile?.phoneVerified && (
                <button type="button" className="btn-primary w-full" onClick={() => setStep('address')}>Continue</button>
              )}
            </div>
          )}

          {step === 'address' && (
            <div className="space-y-4">
              <h3 className="font-semibold">📍 Address</h3>
              <input className="input" placeholder="Country *" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" placeholder="State *" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                <input className="input" placeholder="City *" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <textarea className="input" rows={2} placeholder="Address *" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <input className="input" placeholder="PIN Code *" value={form.pinCode} onChange={(e) => setForm({ ...form, pinCode: e.target.value })} />
              <button type="button" className="btn-primary w-full" disabled={loading} onClick={() => saveStep('emergency')}>Continue</button>
            </div>
          )}

          {step === 'emergency' && (
            <div className="space-y-4">
              <h3 className="font-semibold">🏥 Healthcare Information (Optional)</h3>
              <select className="input" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
                <option value="">Blood Group</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <input className="input" placeholder="Emergency Contact Name" value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} />
              <input className="input" placeholder="Emergency Contact Number" value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} />
              <input className="input" placeholder="Relationship" value={form.emergencyContactRelation} onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })} />
              <p className="text-xs text-gray-500">Sensitive health information is optional. Only provide what you are comfortable sharing.</p>
              <button type="button" className="btn-primary w-full" disabled={loading} onClick={() => saveStep('consent')}>Continue</button>
            </div>
          )}

          {step === 'consent' && (
            <div className="space-y-4">
              <h3 className="font-semibold">Terms & Consent</h3>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.termsAccepted} onChange={(e) => setForm({ ...form, termsAccepted: e.target.checked })} className="mt-1" />
                <span>I agree to the <Link to="/terms" className="text-primary-600">Terms & Conditions</Link> *</span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.privacyAccepted} onChange={(e) => setForm({ ...form, privacyAccepted: e.target.checked })} className="mt-1" />
                <span>I agree to the <Link to="/privacy" className="text-primary-600">Privacy Policy</Link> *</span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.healthConsent} onChange={(e) => setForm({ ...form, healthConsent: e.target.checked })} className="mt-1" />
                <span>I consent to the use of my health information as described in the Privacy Policy (optional)</span>
              </label>
              <button type="button" className="btn-primary w-full" disabled={loading} onClick={async () => { await acceptConsent(); await completeProfile(); }}>Complete Profile</button>
            </div>
          )}
        </div>

        {completion?.missing && completion.missing.length > 0 && (
          <p className="text-xs text-amber-600 mt-4 text-center">Missing: {completion.missing.join(', ')}</p>
        )}
      </div>
    </PublicLayout>
  );
}
