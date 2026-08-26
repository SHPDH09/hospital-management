import { Patient, User } from '@prisma/client';

export type ProfileStep = 'basic' | 'contact' | 'address' | 'emergency' | 'consent';

export type ProfileCompletionStatus = {
  percent: number;
  isComplete: boolean;
  currentStep: ProfileStep;
  steps: {
    key: ProfileStep;
    label: string;
    complete: boolean;
    required: boolean;
  }[];
  missing: string[];
};

type PatientWithUser = Patient & { user: Pick<User, 'email' | 'phone' | 'phoneVerified' | 'emailVerified' | 'profilePhotoUrl'> };

export function computeProfileCompletion(patient: PatientWithUser): ProfileCompletionStatus {
  const u = patient.user;

  const basicComplete = Boolean(
    patient.fullName && patient.dateOfBirth && patient.gender,
  );
  const contactComplete = Boolean(u.phone && u.phoneVerified);
  const addressComplete = Boolean(
    patient.country && patient.state && patient.city && patient.address && patient.pinCode,
  );
  const emergencyComplete = Boolean(
    patient.emergencyContactName && patient.emergencyContact,
  );
  const consentComplete = Boolean(
    patient.termsAcceptedAt && patient.privacyAcceptedAt,
  );

  const steps = [
    { key: 'basic' as const, label: 'Basic Details', complete: basicComplete, required: true },
    { key: 'contact' as const, label: 'Contact Details', complete: contactComplete, required: true },
    { key: 'address' as const, label: 'Address', complete: addressComplete, required: true },
    { key: 'emergency' as const, label: 'Emergency Contact', complete: emergencyComplete, required: false },
    { key: 'consent' as const, label: 'Consent', complete: consentComplete, required: true },
  ];

  const requiredSteps = steps.filter((s) => s.required);
  const completedRequired = requiredSteps.filter((s) => s.complete).length;
  const optionalBonus = emergencyComplete ? 10 : 0;
  const percent = Math.min(100, Math.round((completedRequired / requiredSteps.length) * 90 + optionalBonus));

  const isComplete = basicComplete && contactComplete && addressComplete && consentComplete;

  const missing: string[] = [];
  if (!patient.fullName) missing.push('Full Name');
  if (!patient.dateOfBirth) missing.push('Date of Birth');
  if (!patient.gender) missing.push('Gender');
  if (!u.phone) missing.push('Mobile Number');
  if (u.phone && !u.phoneVerified) missing.push('Mobile Verification');
  if (!patient.country) missing.push('Country');
  if (!patient.state) missing.push('State');
  if (!patient.city) missing.push('City');
  if (!patient.address) missing.push('Address');
  if (!patient.pinCode) missing.push('PIN Code');
  if (!patient.termsAcceptedAt) missing.push('Terms & Conditions');
  if (!patient.privacyAcceptedAt) missing.push('Privacy Policy');

  let currentStep: ProfileStep = 'basic';
  if (basicComplete && !contactComplete) currentStep = 'contact';
  else if (basicComplete && contactComplete && !addressComplete) currentStep = 'address';
  else if (basicComplete && contactComplete && addressComplete && !consentComplete) currentStep = 'consent';
  else if (isComplete && !emergencyComplete) currentStep = 'emergency';
  else if (isComplete) currentStep = 'consent';

  return { percent, isComplete, currentStep, steps, missing };
}

export function profileToResponse(patient: PatientWithUser) {
  const completion = computeProfileCompletion(patient);
  return {
    id: patient.id,
    fullName: patient.fullName,
    profilePhoto: patient.profilePhoto || patient.user.profilePhotoUrl,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    email: patient.user.email,
    emailVerified: patient.user.emailVerified,
    phone: patient.user.phone,
    phoneVerified: patient.user.phoneVerified,
    alternatePhone: patient.alternatePhone,
    address: patient.address,
    city: patient.city,
    state: patient.state,
    country: patient.country,
    pinCode: patient.pinCode,
    bloodGroup: patient.bloodGroup,
    emergencyContactName: patient.emergencyContactName,
    emergencyContact: patient.emergencyContact,
    emergencyContactRelation: patient.emergencyContactRelation,
    profileCompleted: patient.profileCompleted,
    profileCompletionStep: patient.profileCompletionStep || completion.currentStep,
    completion,
  };
}
