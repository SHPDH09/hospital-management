import { useState, ReactNode, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserRole } from '@healthcare/shared';
import { PublicLayout } from '@/components/layouts/PublicLayout';
import { useAuth, getPortalPath } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

export interface LoginPortalConfig {
  title: string;
  subtitle: string;
  allowedRoles: UserRole[];
  icon?: ReactNode;
  registerLink?: { to: string; label: string };
  alternateLinks?: { to: string; label: string }[];
  showDemo?: boolean;
  portalKey?: string;
}

export function RoleLoginPage({ config }: { config: LoginPortalConfig }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  const storageKey = `remember_${config.portalKey || 'default'}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, [storageKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      if (rememberMe) {
        localStorage.setItem(storageKey, email);
      } else {
        localStorage.removeItem(storageKey);
      }
      const meRes = await api.get<{ role: UserRole; accountActivated?: boolean }>('/auth/me');
      const user = meRes.data || JSON.parse(localStorage.getItem('user') || '{}') as { role: UserRole; accountActivated?: boolean };

      if (!config.allowedRoles.includes(user.role)) {
        logout();
        throw new Error(`This account is not authorized for ${config.title}. Please use the correct login page.`);
      }

      const providerRoles: UserRole[] = ['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR', 'ASHA', 'REFERRAL_PARTNER',
        'RECEPTIONIST', 'NURSE', 'ACCOUNTANT', 'PHARMACIST', 'LAB_STAFF', 'MANAGER'];
      if (providerRoles.includes(user.role) && user.accountActivated === false) {
        navigate('/verification/pending');
        return;
      }

      navigate(getPortalPath(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
        <div className="card w-full max-w-md p-8">
          {config.icon && <div className="flex justify-center mb-4">{config.icon}</div>}
          <h1 className="text-2xl font-bold text-center mb-2">{config.title}</h1>
          <p className="text-center text-gray-500 text-sm mb-8">{config.subtitle}</p>

          {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email / Phone</label>
              <input
                type="text"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="Email or phone number"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <Link
                  to={`/forgot-password?portal=${config.portalKey || 'patient'}`}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300"
              />
              Remember Me
            </label>
            <button type="submit" className="btn-primary w-full py-3" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {config.registerLink && (
            <p className="mt-6 text-center text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to={config.registerLink.to} className="text-primary-600 hover:text-primary-700 font-medium">
                {config.registerLink.label}
              </Link>
            </p>
          )}

          {config.alternateLinks && config.alternateLinks.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center mb-3">Other login portals</p>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
                {config.alternateLinks.map((link) => (
                  <Link key={link.to} to={link.to} className="text-primary-600 hover:text-primary-700">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {config.showDemo && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-xs text-gray-500">
              <p className="font-medium mb-1">Demo: patient@example.com / Password123!</p>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
