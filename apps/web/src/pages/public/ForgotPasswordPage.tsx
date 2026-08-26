import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { api } from '@/lib/api';

type Step = 'identifier' | 'otp' | 'password' | 'success';

const LOGIN_RETURN: Record<string, string> = {
  patient: '/login/patient',
  doctor: '/login/doctor',
  hospital: '/login/hospital',
  staff: '/login/staff',
  admin: '/login/admin',
};

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const portal = searchParams.get('portal') || 'patient';
  const loginPath = LOGIN_RETURN[portal] || '/login/patient';

  const [step, setStep] = useState<Step>('identifier');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [hints, setHints] = useState<{
    minPasswordLength?: number;
    requireUppercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
    otpExpiryMinutes?: number;
  }>({});

  useEffect(() => {
    api.get('/auth/forgot-password/security-hints').then((res) => {
      if (res.success && res.data) setHints(res.data as typeof hints);
    });
  }, []);

  const sendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post<{ message?: string; devOtp?: string }>('/auth/forgot-password/send-otp', { identifier });
      if (!res.success) throw new Error(res.error || 'Failed to send OTP');
      if (res.data?.devOtp) {
        console.info('Dev OTP:', res.data.devOtp);
      }
      setStep('otp');
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
      const res = await api.post<{ resetToken: string }>('/auth/forgot-password/verify-otp', { identifier, otp });
      if (!res.success || !res.data?.resetToken) throw new Error(res.error || 'Invalid OTP');
      setResetToken(res.data.resetToken);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/reset', {
        identifier,
        resetToken,
        newPassword,
        confirmPassword,
        ...(currentPassword ? { currentPassword } : {}),
      });
      if (!res.success) throw new Error(res.error || 'Password reset failed');
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  const passwordRules = [
    hints.minPasswordLength ? `At least ${hints.minPasswordLength} characters` : null,
    hints.requireUppercase ? 'One uppercase letter' : null,
    hints.requireNumbers ? 'One number' : null,
    hints.requireSpecialChars ? 'One special character' : null,
  ].filter(Boolean);

  return (
    <PublicLayout>
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <div className="card w-full max-w-md p-8">
          <h1 className="text-2xl font-bold text-center mb-2">Forgot Password</h1>
          <p className="text-center text-gray-500 text-sm mb-6">
            {step === 'identifier' && 'Enter your registered email or phone number'}
            {step === 'otp' && `Enter the OTP sent to your email/phone (expires in ${hints.otpExpiryMinutes || 5} min)`}
            {step === 'password' && 'Create your new password'}
            {step === 'success' && 'Your password has been updated'}
          </p>

          {/* Progress */}
          {step !== 'success' && (
            <div className="flex gap-2 mb-6">
              {(['identifier', 'otp', 'password'] as const).map((s, i) => (
                <div key={s} className={`flex-1 h-1 rounded ${['identifier', 'otp', 'password'].indexOf(step) >= i ? 'bg-primary-600' : 'bg-gray-200'}`} />
              ))}
            </div>
          )}

          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {step === 'identifier' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email or Phone</label>
                <input
                  className="input"
                  placeholder="you@example.com or +91XXXXXXXXXX"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <button type="button" className="btn-primary w-full py-3" disabled={loading || identifier.length < 3} onClick={sendOtp}>
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">OTP Code</label>
                <input
                  className="input text-center text-2xl tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <button type="button" className="btn-primary w-full py-3" disabled={loading || otp.length !== 6} onClick={verifyOtp}>
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>
              <button type="button" className="text-sm text-primary-600 w-full" onClick={() => { setStep('identifier'); setOtp(''); }}>
                Resend OTP
              </button>
            </div>
          )}

          {step === 'password' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </div>
              {portal === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password (Super Admin required)</label>
                  <input type="password" className="input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Re-authenticate for security" />
                </div>
              )}
              {passwordRules.length > 0 && (
                <ul className="text-xs text-gray-500 space-y-1">
                  {passwordRules.map((r) => <li key={r}>• {r}</li>)}
                </ul>
              )}
              <button type="button" className="btn-primary w-full py-3" disabled={loading || !newPassword || !confirmPassword} onClick={resetPassword}>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center space-y-4">
              <div className="text-5xl">✓</div>
              <p className="text-gray-600">Password updated successfully. All existing sessions have been logged out.</p>
              <Link to={loginPath} className="btn-primary inline-block px-8 py-3">Back to Login</Link>
            </div>
          )}

          {step !== 'success' && (
            <p className="mt-6 text-center text-sm text-gray-500">
              <Link to={loginPath} className="text-primary-600 hover:text-primary-700 font-medium">← Back to Login</Link>
            </p>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
