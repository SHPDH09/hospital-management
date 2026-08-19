import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@healthcare/shared';

interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
  /** Allow access before patient profile is complete (e.g. profile wizard). */
  allowIncompleteProfile?: boolean;
}

export function ProtectedRoute({ children, roles, allowIncompleteProfile = false }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login/patient" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  const isPatient = user?.role === 'PATIENT';
  const profileCompleted = user?.profileCompleted ?? user?.patient?.profileCompleted ?? false;
  const onCompleteProfile = location.pathname === '/patient/complete-profile';

  if (isPatient && !allowIncompleteProfile && !profileCompleted && !onCompleteProfile) {
    return <Navigate to="/patient/complete-profile" replace state={{ from: location }} />;
  }

  if (isPatient && onCompleteProfile && profileCompleted) {
    return <Navigate to="/patient" replace />;
  }

  return <>{children}</>;
}
