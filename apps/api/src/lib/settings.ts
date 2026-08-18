import crypto from 'crypto';

export const SETTING_CATEGORIES = [
  'platform',
  'branding',
  'website',
  'mobile',
  'currency-tax',
  'payment',
  'email',
  'sms',
  'whatsapp',
  'notifications',
  'appointment',
  'hospital-clinic',
  'doctor',
  'patient',
  'security',
  'privacy',
  'storage',
  'search',
  'reviews',
  'advertisements',
  'subscriptions',
  'analytics',
  'localization',
  'api-integration',
  'emergency',
  'legal',
] as const;

export type SettingCategory = (typeof SETTING_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<SettingCategory, string> = {
  platform: 'Platform Information',
  branding: 'Branding',
  website: 'Website',
  mobile: 'Mobile App',
  'currency-tax': 'Currency & Tax',
  payment: 'Payment Gateway',
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  notifications: 'Notifications',
  appointment: 'Appointment',
  'hospital-clinic': 'Hospital & Clinic',
  doctor: 'Doctor',
  patient: 'Patient',
  security: 'Security',
  privacy: 'Privacy & Data',
  storage: 'File & Storage',
  search: 'Search',
  reviews: 'Reviews',
  advertisements: 'Advertisements',
  subscriptions: 'Subscriptions',
  analytics: 'Analytics',
  localization: 'Localization',
  'api-integration': 'API & Integrations',
  emergency: 'Emergency Controls',
  legal: 'Legal & Compliance',
};

const NOTIFICATION_CHANNELS = ['email', 'sms', 'whatsapp', 'push', 'inApp'] as const;

function notificationDefaults(enabled = true) {
  return Object.fromEntries(NOTIFICATION_CHANNELS.map((c) => [c, enabled]));
}

export const DEFAULT_SETTINGS: Record<SettingCategory, Record<string, unknown>> = {
  platform: {
    platformName: 'Healthcare Platform',
    shortName: 'HealthCare',
    logo: '',
    favicon: '',
    tagline: 'Find the Right Healthcare, Near You.',
    description: 'Discover trusted hospitals, clinics, doctors and healthcare services in one place.',
    supportEmail: 'support@healthcare.platform',
    supportPhone: '+91-1800-000-000',
    businessEmail: 'business@healthcare.platform',
    businessAddress: '',
    websiteUrl: 'https://healthcare.platform',
    defaultLanguage: 'en',
    defaultCountry: 'IN',
    defaultCurrency: 'INR',
    timeZone: 'Asia/Kolkata',
  },
  branding: {
    primaryLogo: '',
    darkLogo: '',
    favicon: '',
    loginPageLogo: '',
    appLogo: '',
    primaryColor: '#2563eb',
    secondaryColor: '#0d9488',
    accentColor: '#f59e0b',
    buttonStyle: 'rounded',
    emailLogo: '',
    defaultProfileImage: '',
  },
  website: {
    websiteStatus: 'active',
    maintenanceMode: false,
    maintenanceMessage: 'We are currently performing scheduled maintenance.',
    registrationEnabled: true,
    patientRegistration: true,
    hospitalRegistration: true,
    clinicRegistration: true,
    doctorRegistration: true,
    searchEnabled: true,
    appointmentBookingEnabled: true,
  },
  mobile: {
    appName: 'Healthcare Platform',
    appVersion: '1.0.0',
    minimumSupportedVersion: '1.0.0',
    latestVersion: '1.0.0',
    forceUpdate: false,
    androidAppLink: '',
    iosAppLink: '',
    maintenanceMode: false,
    maintenanceMessage: 'App is under maintenance. Please try again later.',
  },
  'currency-tax': {
    currency: 'INR',
    currencySymbol: '₹',
    decimalPlaces: 2,
    taxEnabled: true,
    taxName: 'GST',
    taxPercentage: 18,
    platformFeePercent: 5,
    serviceFeePercent: 0,
    convenienceFeePercent: 0,
    minimumTransaction: 1,
    maximumTransaction: 1000000,
    taxJurisdictions: [{ name: 'India GST', code: 'IN-GST', rate: 18 }],
  },
  payment: {
    razorpay: { enabled: false, testMode: true, apiKey: '', secretKey: '', webhookSecret: '', currency: 'INR', methods: ['card', 'upi', 'netbanking'] },
    stripe: { enabled: false, testMode: true, apiKey: '', secretKey: '', webhookSecret: '', currency: 'INR', methods: ['card'] },
    otherGateways: [],
  },
  email: {
    provider: 'smtp',
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    senderName: 'Healthcare Platform',
    senderEmail: 'noreply@healthcare.platform',
    replyTo: 'support@healthcare.platform',
    apiProvider: '',
    apiKey: '',
    enabled: true,
  },
  sms: {
    provider: '',
    apiKey: '',
    senderId: '',
    enabled: false,
    otpEnabled: true,
    deliveryReports: true,
    templates: [],
  },
  whatsapp: {
    enabled: false,
    businessAccountId: '',
    apiProvider: '',
    apiCredentials: '',
    phoneNumber: '',
    webhookUrl: '',
    templates: [],
  },
  notifications: {
    emailNotifications: true,
    smsNotifications: true,
    whatsappNotifications: true,
    pushNotifications: true,
    inAppNotifications: true,
    types: {
      appointmentConfirmation: notificationDefaults(),
      appointmentReminder: notificationDefaults(),
      appointmentCancellation: notificationDefaults(),
      paymentReceipt: notificationDefaults(),
      registrationWelcome: notificationDefaults(true),
      passwordReset: notificationDefaults(true),
      subscriptionExpiry: notificationDefaults(),
      reviewRequest: notificationDefaults(),
    },
  },
  appointment: {
    bookingEnabled: true,
    advanceBookingDays: 30,
    minimumCancellationHours: 24,
    reschedulingAllowed: true,
    noShowPolicy: 'Mark as no-show after 15 minutes',
    defaultDurationMinutes: 30,
    bufferTimeMinutes: 10,
    maxAppointmentsPerSlot: 1,
  },
  'hospital-clinic': {
    hospitalApprovalRequired: true,
    clinicApprovalRequired: true,
    doctorApprovalRequired: true,
    verificationRequired: true,
    documentVerificationRequired: true,
    autoApproval: false,
    organizationListingVisibility: 'public',
  },
  doctor: {
    verificationRequired: true,
    registrationApproval: true,
    profileVisibility: 'public',
    reviewEligibility: true,
    consultationFeeRequired: false,
    availabilityRequired: true,
  },
  patient: {
    emailVerification: true,
    phoneVerification: true,
    otpRequired: true,
    profileCompletionRequired: false,
    accountDeletionAllowed: true,
    accountDeactivationAllowed: true,
    reviewEligibility: true,
  },
  security: {
    minPasswordLength: 8,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    maxLoginAttempts: 5,
    accountLockDurationMinutes: 30,
    sessionTimeoutMinutes: 30,
    twoFactorRequired: false,
    twoFactorRequiredForAdmin: true,
    otpExpiryMinutes: 5,
    otpAttemptLimit: 5,
    ipBlockingEnabled: false,
    deviceSessionManagement: true,
    adminLoginSecurity: true,
  },
  privacy: {
    dataRetentionDays: 2555,
    accountDeletionGraceDays: 30,
    documentRetentionDays: 2555,
    consentRequired: true,
    privacyControlsEnabled: true,
    dataExportEnabled: true,
    dataAccessLogging: true,
    auditLogRetentionDays: 365,
  },
  storage: {
    provider: 'local',
    maxFileSizeMb: 10,
    allowedImageTypes: ['jpg', 'jpeg', 'png', 'webp'],
    allowedDocumentTypes: ['pdf'],
    imageCompression: true,
    documentStoragePath: 'documents',
    medicalReportStoragePath: 'medical-reports',
    prescriptionStoragePath: 'prescriptions',
    profileImageStoragePath: 'profiles',
    signedUrlExpiryMinutes: 15,
  },
  search: {
    searchEnabled: true,
    locationSearch: true,
    defaultRadiusKm: 10,
    defaultSorting: 'relevance',
    ratingSorting: true,
    distanceSorting: true,
    featuredListingPriority: true,
    searchResultLimit: 50,
  },
  reviews: {
    reviewEnabled: true,
    ratingRequired: true,
    afterCompletedAppointmentOnly: true,
    reviewModeration: true,
    hospitalResponseAllowed: true,
    doctorResponseAllowed: true,
    reportReviewAllowed: true,
  },
  advertisements: {
    advertisementEnabled: true,
    adminApprovalRequired: true,
    autoPublish: false,
    maxCampaignDurationDays: 90,
    bannerSizes: ['728x90', '300x250', '970x250'],
    featuredListingEnabled: true,
    trackingEnabled: true,
  },
  subscriptions: {
    subscriptionEnabled: true,
    defaultPlan: 'Basic',
    trialPeriodDays: 14,
    gracePeriodDays: 3,
    autoRenewal: true,
    expiryBehavior: 'suspend',
    suspensionBehavior: 'read_only',
    upgradeAllowed: true,
    downgradeAllowed: true,
  },
  analytics: {
    googleAnalyticsId: '',
    googleAnalyticsEnabled: false,
    googleTagManagerId: '',
    googleTagManagerEnabled: false,
    metaPixelId: '',
    metaPixelEnabled: false,
    conversionTrackingEnabled: false,
  },
  localization: {
    language: 'en',
    country: 'IN',
    currency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    timeZone: 'Asia/Kolkata',
    numberFormat: 'en-IN',
  },
  'api-integration': {
    googleMapsApiKey: '',
    webhooks: [],
    thirdPartyIntegrations: [],
  },
  emergency: {
    systemStatus: 'normal',
    emergencyModeActive: false,
    activatedBy: null as string | null,
    activatedByEmail: null as string | null,
    activatedAt: null as string | null,
    reason: '',
    expectedResolutionAt: null as string | null,
    maintenanceMode: false,
    maintenanceType: 'full',
    maintenanceModules: [] as string[],
    maintenanceMessage: 'We are currently performing scheduled maintenance.',
    modules: {
      patientRegistration: true,
      hospitalRegistration: true,
      clinicRegistration: true,
      doctorRegistration: true,
      appointmentBooking: true,
      onlinePayment: true,
      advertisement: true,
      messaging: true,
      fileUpload: true,
      publicSearch: true,
    },
    payment: {
      onlinePaymentDisabled: false,
      razorpayDisabled: false,
      stripeDisabled: false,
      subscriptionPurchaseDisabled: false,
      appointmentPaymentDisabled: false,
      refundProcessingRestricted: false,
      backupGatewayEnabled: false,
    },
    appointment: {
      newAppointmentsDisabled: false,
      reschedulingDisabled: false,
      cancellationDisabled: false,
      disabledOrganizationIds: [] as string[],
      disabledDoctorIds: [] as string[],
    },
    api: {
      globallyDisabled: false,
      appointmentApi: true,
      paymentApi: true,
      searchApi: true,
      webhookApi: true,
      registrationApi: true,
      rateLimitMultiplier: 1,
    },
    communication: {
      email: true,
      sms: true,
      whatsapp: true,
      push: true,
      queuedMessageAction: 'pause',
    },
    security: {
      disableNewRegistrations: false,
      disableApiAccess: false,
      blockedIps: [] as string[],
      require2fa: false,
      lockAffectedAccounts: false,
    },
    readOnlyMode: false,
    readOnlyBlockedActions: ['add', 'edit', 'delete', 'payment', 'booking'],
    lastDisabledModules: [] as string[],
    // Legacy compat fields
    disableRegistration: false,
    disableAppointmentBooking: false,
    disablePayments: false,
    disableAdvertisements: false,
    disableCommunication: false,
    emergencyAnnouncement: '',
    emergencyAnnouncementActive: false,
  },
  legal: {
    termsUrl: '/terms',
    privacyPolicyUrl: '/privacy',
    cookiePolicyUrl: '/cookies',
    refundPolicyUrl: '/refund',
    patientConsentUrl: '/patient-consent',
    hospitalAgreementUrl: '/hospital-agreement',
    doctorAgreementUrl: '/doctor-agreement',
    advertisementPolicyUrl: '/advertisement-policy',
    policyVersions: { terms: '1.0', privacy: '1.0', cookie: '1.0' },
  },
};

/** Dot-paths for secret fields per category */
export const SECRET_PATHS: Record<string, string[]> = {
  payment: ['razorpay.apiKey', 'razorpay.secretKey', 'razorpay.webhookSecret', 'stripe.apiKey', 'stripe.secretKey', 'stripe.webhookSecret'],
  email: ['smtpPassword', 'apiKey'],
  sms: ['apiKey'],
  whatsapp: ['apiCredentials'],
  'api-integration': ['googleMapsApiKey'],
};

const MASK = '********';
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY || process.env.JWT_SECRET || 'dev-settings-key';
  return crypto.scryptSync(secret, 'platform-settings', 32);
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(value: string): string {
  if (!value || !value.startsWith('enc:')) return value;
  const parts = value.split(':');
  if (parts.length !== 4) return value;
  const iv = Buffer.from(parts[1], 'hex');
  const tag = Buffer.from(parts[2], 'hex');
  const data = Buffer.from(parts[3], 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setNested(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
}

export function settingsKey(category: SettingCategory): string {
  return `settings.${category}`;
}

export function mergeWithDefaults(category: SettingCategory, value: Record<string, unknown> | null): Record<string, unknown> {
  const defaults = DEFAULT_SETTINGS[category];
  if (!value) return { ...defaults };
  return deepMerge(defaults, value);
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && base[k] && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

export function maskSecrets(category: SettingCategory, data: Record<string, unknown>): Record<string, unknown> {
  const paths = SECRET_PATHS[category] || [];
  const out = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  for (const path of paths) {
    const val = getNested(out, path);
    if (typeof val === 'string' && val.length > 0) setNested(out, path, MASK);
  }
  return out;
}

export function applySecretUpdates(
  category: SettingCategory,
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const paths = SECRET_PATHS[category] || [];
  const merged = deepMerge(existing, incoming);
  for (const path of paths) {
    const newVal = getNested(incoming, path);
    if (newVal === undefined || newVal === MASK || newVal === '') continue;
    if (typeof newVal === 'string') {
      setNested(merged, path, encryptSecret(newVal));
    }
  }
  return merged;
}

export function encryptSecretsInPlace(category: SettingCategory, data: Record<string, unknown>): Record<string, unknown> {
  const paths = SECRET_PATHS[category] || [];
  const out = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
  for (const path of paths) {
    const val = getNested(out, path);
    if (typeof val === 'string' && val && !val.startsWith('enc:') && val !== MASK) {
      setNested(out, path, encryptSecret(val));
    }
  }
  return out;
}

export function diffSettings(oldVal: Record<string, unknown>, newVal: Record<string, unknown>): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
  for (const key of allKeys) {
    const o = oldVal[key];
    const n = newVal[key];
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      changes[key] = { old: o, new: n };
    }
  }
  return changes;
}

export { MASK };
