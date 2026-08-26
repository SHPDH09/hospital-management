import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { useAuth } from '@/contexts/AuthContext';

const PLATFORM_NAME = import.meta.env.VITE_PLATFORM_NAME || 'HealthCare Platform';

export function PatientLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  const storageKey = 'remember_patient';

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const afterAuth = (profileCompleted?: boolean) => {
    if (profileCompleted) navigate('/patient');
    else navigate('/patient/complete-profile');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const profileCompleted = await login(email, password);
      if (rememberMe) localStorage.setItem(storageKey, email);
      else localStorage.removeItem(storageKey);
      afterAuth(profileCompleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential: string) => {
    setError('');
    setLoading(true);
    try {
      const profileCompleted = await googleLogin(credential);
      afterAuth(profileCompleted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <div className="card w-full max-w-md p-8">
          <div className="flex justify-center mb-4">
            <User className="h-10 w-10 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-1">Welcome to {PLATFORM_NAME}</h1>
          <p className="text-center text-gray-500 text-sm mb-8">Sign in to book appointments and manage your health</p>

          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email / Phone</label>
              <input type="text" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="Email or phone number" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Link to="/forgot-password?portal=patient" className="text-xs text-primary-600 hover:text-primary-700">Forgot Password?</Link>
              </div>
              <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-gray-300" />
              Remember Me
            </label>
            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 border-t border-gray-200" />
            <span className="text-xs text-gray-400 uppercase">or</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          <GoogleLoginButton onSuccess={handleGoogle} onError={setError} />

          <p className="mt-6 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">Create Account</Link>
          </p>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">Other login portals</p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
              <Link to="/login/doctor" className="text-primary-600 hover:text-primary-700">Doctor</Link>
              <Link to="/login/hospital" className="text-primary-600 hover:text-primary-700">Hospital</Link>
              <Link to="/login/staff" className="text-primary-600 hover:text-primary-700">Staff</Link>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
            <p className="font-medium mb-1">Demo: patient@example.com / Password123!</p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
