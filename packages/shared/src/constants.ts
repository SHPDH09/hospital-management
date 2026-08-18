export const SUBSCRIPTION_PLANS = {
  STARTER: {
    name: 'Starter',
    price: 999,
    currency: 'INR',
    features: ['Patient Management', 'Appointment Management', 'Basic Dashboard'],
  },
  PROFESSIONAL: {
    name: 'Professional',
    price: 2499,
    currency: 'INR',
    features: [
      'Everything in Starter',
      'Billing',
      'Staff Management',
      'Reports',
      'Communication',
      'Inventory',
    ],
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: null,
    currency: 'INR',
    features: [
      'Multi-branch',
      'Advanced Analytics',
      'API Access',
      'Custom Branding',
      'Advanced Permissions',
      'Dedicated Support',
    ],
  },
} as const;

export const APPOINTMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_CONSULTATION',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export const DEFAULT_PAGE_SIZE = 20;
