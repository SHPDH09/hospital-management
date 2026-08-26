import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/auth';
import { sendSuccess, AppError } from '../lib/response';
import { authenticate, requireRoles, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { computeProfileCompletion, profileToResponse } from '../lib/patient-profile';
import { getSecuritySettings } from '../lib/password-reset';

const router = Router();
router.use(authenticate, requireRoles('PATIENT'));

async function getPatientForUser(userId: string) {
  const patient = await prisma.patient.findUnique({
    where: { userId },
    include: { user: { select: { email: true, phone: true, phoneVerified: true, emailVerified: true, profilePhotoUrl: true } } },
  });
  if (!patient) throw new AppError('Patient profile not found', 404);
  return patient;
}

router.get('/profile', async (req: AuthRequest, res, next) => {
  try {
    const patient = await getPatientForUser(req.user!.userId);
    sendSuccess(res, profileToResponse(patient));
  } catch (err) { next(err); }
});

router.get('/profile/status', async (req: AuthRequest, res, next) => {
  try {
    const patient = await getPatientForUser(req.user!.userId);
    const completion = computeProfileCompletion(patient);
    sendSuccess(res, {
      profileCompleted: patient.profileCompleted,
      ...completion,
    });
  } catch (err) { next(err); }
});

router.patch('/profile', validateBody(z.object({
  fullName: z.string().min(2).optional(),
  profilePhoto: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  alternatePhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pinCode: z.string().optional(),
  bloodGroup: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
  profileCompletionStep: z.string().optional(),
}).partial()), async (req: AuthRequest, res, next) => {
  try {
    const body = req.body;
    const patient = await getPatientForUser(req.user!.userId);

    const updated = await prisma.patient.update({
      where: { id: patient.id },
      data: {
        ...(body.fullName && { fullName: body.fullName }),
        ...(body.profilePhoto !== undefined && { profilePhoto: body.profilePhoto }),
        ...(body.dateOfBirth && { dateOfBirth: new Date(body.dateOfBirth) }),
        ...(body.gender && { gender: body.gender }),
        ...(body.alternatePhone !== undefined && { alternatePhone: body.alternatePhone }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.city !== undefined && { city: body.city }),
        ...(body.state !== undefined && { state: body.state }),
        ...(body.country !== undefined && { country: body.country }),
        ...(body.pinCode !== undefined && { pinCode: body.pinCode }),
        ...(body.bloodGroup !== undefined && { bloodGroup: body.bloodGroup }),
        ...(body.emergencyContactName !== undefined && { emergencyContactName: body.emergencyContactName }),
        ...(body.emergencyContact !== undefined && { emergencyContact: body.emergencyContact }),
        ...(body.emergencyContactRelation !== undefined && { emergencyContactRelation: body.emergencyContactRelation }),
        ...(body.profileCompletionStep && { profileCompletionStep: body.profileCompletionStep }),
      },
      include: { user: { select: { email: true, phone: true, phoneVerified: true, emailVerified: true, profilePhotoUrl: true } } },
    });

    const completion = computeProfileCompletion(updated);
    await prisma.patient.update({
      where: { id: updated.id },
      data: { profileCompletionPercent: completion.percent, profileCompletionStep: completion.currentStep },
    });

    const refreshed = await getPatientForUser(req.user!.userId);
    sendSuccess(res, profileToResponse(refreshed));
  } catch (err) { next(err); }
});

router.post('/profile/send-mobile-otp', validateBody(z.object({
  phone: z.string().min(10),
})), async (req: AuthRequest, res, next) => {
  try {
    const { phone } = req.body;
    const settings = await getSecuritySettings();

    const existingPhone = await prisma.user.findFirst({ where: { phone, id: { not: req.user!.userId } } });
    if (existingPhone) throw new AppError('This phone number is already registered', 409);

    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = await hashPassword(otp);
    const expiresAt = new Date(Date.now() + settings.otpExpiryMinutes * 60 * 1000);

    await prisma.patientPhoneOtp.deleteMany({ where: { userId: req.user!.userId, phone } });
    await prisma.patientPhoneOtp.create({
      data: { userId: req.user!.userId, phone, otpHash, expiresAt },
    });

    await prisma.user.update({ where: { id: req.user!.userId }, data: { phone } });

    console.info(`[PATIENT MOBILE OTP] ${phone}: ${otp}`);

    sendSuccess(res, {
      message: 'OTP sent to your mobile number',
      ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
    });
  } catch (err) { next(err); }
});

router.post('/profile/verify-mobile-otp', validateBody(z.object({
  phone: z.string().min(10),
  otp: z.string().length(6),
})), async (req: AuthRequest, res, next) => {
  try {
    const { phone, otp } = req.body;
    const settings = await getSecuritySettings();

    const record = await prisma.patientPhoneOtp.findFirst({
      where: { userId: req.user!.userId, phone, verifiedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw new AppError('No OTP found. Request a new one.', 400);
    if (record.expiresAt < new Date()) throw new AppError('OTP expired', 400);

    const { comparePassword } = await import('../lib/auth');
    const valid = await comparePassword(otp, record.otpHash);

    if (!valid) {
      const attempts = record.attempts + 1;
      await prisma.patientPhoneOtp.update({ where: { id: record.id }, data: { attempts } });
      if (attempts >= settings.otpAttemptLimit) throw new AppError('Too many attempts. Request a new OTP.', 429);
      throw new AppError('Invalid OTP', 400);
    }

    await prisma.$transaction([
      prisma.patientPhoneOtp.update({ where: { id: record.id }, data: { verifiedAt: new Date() } }),
      prisma.user.update({ where: { id: req.user!.userId }, data: { phone, phoneVerified: true } }),
    ]);

    sendSuccess(res, { verified: true, message: 'Mobile verified successfully' });
  } catch (err) { next(err); }
});

router.post('/profile/accept-consent', validateBody(z.object({
  termsAccepted: z.boolean(),
  privacyAccepted: z.boolean(),
  healthConsent: z.boolean().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    if (!req.body.termsAccepted || !req.body.privacyAccepted) {
      throw new AppError('Terms and Privacy Policy acceptance is required', 400);
    }

    const now = new Date();
    const patient = await prisma.patient.update({
      where: { userId: req.user!.userId },
      data: {
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        ...(req.body.healthConsent && { healthConsentAt: now }),
      },
      include: { user: { select: { email: true, phone: true, phoneVerified: true, emailVerified: true, profilePhotoUrl: true } } },
    });

    sendSuccess(res, profileToResponse(patient));
  } catch (err) { next(err); }
});

router.post('/profile/complete', async (req: AuthRequest, res, next) => {
  try {
    const patient = await getPatientForUser(req.user!.userId);
    const completion = computeProfileCompletion(patient);

    if (!completion.isComplete) {
      throw new AppError(`Profile incomplete. Missing: ${completion.missing.join(', ')}`, 400);
    }

    const updated = await prisma.patient.update({
      where: { id: patient.id },
      data: {
        profileCompleted: true,
        profileCompletedAt: new Date(),
        profileCompletionPercent: 100,
      },
      include: { user: { select: { email: true, phone: true, phoneVerified: true, emailVerified: true, profilePhotoUrl: true } } },
    });

    sendSuccess(res, profileToResponse(updated), 'Profile completed successfully');
  } catch (err) { next(err); }
});

export default router;
