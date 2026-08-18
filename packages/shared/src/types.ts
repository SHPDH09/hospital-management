export type UserRole =
  | 'SUPER_ADMIN'
  | 'PLATFORM_STAFF'
  | 'HOSPITAL_ADMIN'
  | 'BRANCH_ADMIN'
  | 'DOCTOR'
  | 'RECEPTIONIST'
  | 'NURSE'
  | 'ACCOUNTANT'
  | 'PHARMACIST'
  | 'LAB_STAFF'
  | 'MANAGER'
  | 'PATIENT'
  | 'ASHA'
  | 'REFERRAL_PARTNER';

export type OrganizationType = 'HOSPITAL' | 'CLINIC' | 'DIAGNOSTIC_CENTER' | 'PHARMACY';

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'CORRECTION_REQUESTED';

export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type BillStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export type SubscriptionPlanTier = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'TRIAL';

export type AdvertisementStatus = 'PENDING' | 'APPROVED' | 'ACTIVE' | 'EXPIRED' | 'REJECTED';

export type AdvertisementType =
  | 'HOMEPAGE_BANNER'
  | 'SEARCH_PROMOTION'
  | 'FEATURED_HOSPITAL'
  | 'FEATURED_DOCTOR'
  | 'FEATURED_CLINIC'
  | 'HEALTH_PACKAGE';

export type LeadStatus = 'NEW' | 'CONTACTED' | 'INTERESTED' | 'APPOINTMENT_BOOKED' | 'CONVERTED' | 'LOST';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  branchId?: string;
}

export interface SearchFilters {
  query?: string;
  city?: string;
  state?: string;
  specialty?: string;
  type?: OrganizationType;
  minRating?: number;
  maxFee?: number;
  emergencyAvailable?: boolean;
  page?: number;
  limit?: number;
}
