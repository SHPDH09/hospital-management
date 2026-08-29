import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole } from '@healthcare/shared';
import { api } from '@/lib/api';
import { saveSessionInfo, clearSessionInfo, type SessionInfo } from '@/lib/session';

interface User {
  id: string;
  email: string;
  role: UserRole;
  profileCompleted?: boolean;
  patient?: { id: string; fullName: string; profileCompleted?: boolean };
  doctor?: { id: string; fullName: string; organizationId: string };
  staff?: { id: string; fullName: string; organizationId: string };
}

interface AuthTokens {
  user: User;
  accessToken: string;
  refreshToken: string;
  profileCompleted?: boolean;
  session?: SessionInfo;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  googleLogin: (credential: string) => Promise<boolean>;
  register: (data: Record<string, unknown>) => Promise<boolean>;
  refreshUser: () => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

function resolveProfileCompleted(user: User, explicit?: boolean): boolean {
  if (typeof explicit === 'boolean') return explicit;
  if (typeof user.profileCompleted === 'boolean') return user.profileCompleted;
  return user.patient?.profileCompleted ?? false;
}

function withProfileCompleted(user: User, explicit?: boolean): User {
  const profileCompleted = resolveProfileCompleted(user, explicit);
  return { ...user, profileCompleted };
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistUser = (user: User) => {
    setUser(user);
    localStorage.setItem('user', JSON.stringify(user));
  };

  const applyAuthResponse = (data: AuthTokens): boolean => {
    api.setTokens(data.accessToken, data.refreshToken);
    if (data.session) saveSessionInfo(data.session);
    const user = withProfileCompleted(data.user, data.profileCompleted);
    persistUser(user);
    return user.profileCompleted ?? false;
  };

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setUser(JSON.parse(stored));
      api.get<User>('/auth/me').then((res: { success: boolean; data?: User }) => {
        if (res.success && res.data) {
          persistUser(withProfileCompleted(res.data));
        }
      });
    }
    setIsLoading(false);
  }, []);

  const refreshUser = async () => {
    const res = await api.get<User>('/auth/me');
    if (res.success && res.data) {
      persistUser(withProfileCompleted(res.data));
    }
  };

  const login = async (email: string, password: string) => {
    const res = await api.post<AuthTokens>('/auth/login', { email, password });
    if (!res.success || !res.data) throw new Error(res.error || 'Login failed');
    return applyAuthResponse(res.data);
  };

  const googleLogin = async (credential: string) => {
    const res = await api.post<AuthTokens>('/auth/google', { credential });
    if (!res.success || !res.data) throw new Error(res.error || 'Google login failed');
    return applyAuthResponse(res.data);
  };

  const register = async (data: Record<string, unknown>) => {
    const res = await api.post<AuthTokens>('/auth/register/patient', data);
    if (!res.success || !res.data) throw new Error(res.error || 'Registration failed');
    return applyAuthResponse({ ...res.data, profileCompleted: res.data.profileCompleted ?? false });
  };

  const logout = () => {
    api.clearTokens();
    clearSessionInfo();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, googleLogin, register, refreshUser, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getPortalPath(role: UserRole): string {
  const map: Partial<Record<UserRole, string>> = {
    SUPER_ADMIN: '/admin',
    PLATFORM_STAFF: '/admin',
    HOSPITAL_ADMIN: '/crm',
    BRANCH_ADMIN: '/crm',
    DOCTOR: '/crm',
    RECEPTIONIST: '/crm',
    NURSE: '/crm',
    ACCOUNTANT: '/crm',
    PHARMACIST: '/crm',
    LAB_STAFF: '/crm',
    MANAGER: '/crm',
    PATIENT: '/patient',
  };
  return map[role] || '/';
}
