import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@healthcare/shared';

const PROVIDER_ROLES: UserRole[] = [
  'HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE',
  'ACCOUNTANT', 'PHARMACIST', 'LAB_STAFF', 'MANAGER', 'ASHA', 'REFERRAL_PARTNER',
];

interface VerificationGateProps {
  children: ReactNode;
}

/** Redirects unverified providers to pending verification page */
export function VerificationGate({ children }: VerificationGateProps) {
  const { user } = useAuth();

  if (!user) return <>{children}</>;

  if (PROVIDER_ROLES.includes(user.role)) {
    const activated = (user as { accountActivated?: boolean }).accountActivated;
    if (activated === false) {
      return <Navigate to="/verification/pending" replace />;
    }
  }

  return <>{children}</>;
}
