import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole } from '@healthcare/shared';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: UserRole;
  patient?: { id: string; fullName: string };
  doctor?: { id: string; fullName: string; organizationId: string };
  staff?: { id: string; fullName: string; organizationId: string };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, unknown>) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setUser(JSON.parse(stored));
      api.get<User>('/auth/me').then((res: { success: boolean; data?: User }) => {
        if (res.success && res.data) {
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        }
      });
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', { email, password });
    if (!res.success || !res.data) throw new Error(res.error || 'Login failed');
    api.setTokens(res.data.accessToken, res.data.refreshToken);
    setUser(res.data.user);
    localStorage.setItem('user', JSON.stringify(res.data.user));
  };

  const register = async (data: Record<string, unknown>) => {
    const res = await api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/register/patient', data);
    if (!res.success || !res.data) throw new Error(res.error || 'Registration failed');
    api.setTokens(res.data.accessToken, res.data.refreshToken);
    setUser(res.data.user);
    localStorage.setItem('user', JSON.stringify(res.data.user));
  };

  const logout = () => {
    api.clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, isAuthenticated: !!user }}>
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
