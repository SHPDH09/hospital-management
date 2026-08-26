import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, comparePassword, signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/auth';
import { sendSuccess, sendError, AppError } from '../lib/response';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { logLogin } from '../lib/audit';
import {
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPasswordWithToken,
} from '../lib/password-reset';
import { verifyGoogleIdToken, resolveGoogleClientId } from '../lib/google-auth';
import { computeProfileCompletion, profileToResponse } from '../lib/patient-profile';

const router = Router();

const registerPatientSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  emergencyContact: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().min(3),
  password: z.string(),
});

router.post('/register/patient', validateBody(registerPatientSchema), async (req, res, next) => {
  try {
    const data = req.body;
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError('Email already registered', 409);

    const passwordHash = await hashPassword(data.password);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        passwordHash,
        role: 'PATIENT',
        patient: {
          create: {
            fullName: data.fullName,
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
            gender: data.gender,
            address: data.address,
            city: data.city,
            state: data.state,
            emergencyContact: data.emergencyContact,
          },
        },
      },
      include: { patient: true },
    });

    const tokens = await issueTokens(user.id, user.email, user.role);
    sendSuccess(res, { user: sanitizeUser(user), ...tokens }, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
});

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email: identifier, password } = req.body;
    const { findUserByIdentifier } = await import('../lib/password-reset');
    const user = await findUserByIdentifier(identifier);
    if (user) {
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { patient: true, doctor: true, staff: true },
      });
      if (!fullUser || !fullUser.isActive) {
        await logLogin(identifier, false, undefined, 'Invalid credentials', req);
        throw new AppError('Invalid credentials', 401);
      }
      let valid = false;
      try {
        valid = await comparePassword(password, fullUser.passwordHash);
      } catch {
        await logLogin(identifier, false, fullUser.id, 'Invalid password hash', req);
        throw new AppError('Invalid credentials', 401);
      }
      if (!valid) {
        await logLogin(identifier, false, fullUser.id, 'Wrong password', req);
        throw new AppError('Invalid credentials', 401);
      }

      await prisma.user.update({ where: { id: fullUser.id }, data: { lastLoginAt: new Date() } });
      await logLogin(fullUser.email, true, fullUser.id, undefined, req);

      const tokens = await issueTokens(fullUser.id, fullUser.email, fullUser.role);
      const safe = sanitizeUser(fullUser);
      let profileCompleted = false;
      if (fullUser.role === 'PATIENT' && fullUser.patient) {
        const profile = profileToResponse(fullUser.patient as never);
        (safe as Record<string, unknown>).patient = profile;
        profileCompleted = profile.profileCompleted;
        (safe as Record<string, unknown>).profileCompleted = profileCompleted;
      }
      sendSuccess(res, { user: safe, ...tokens, profileCompleted }, 'Login successful');
      return;
    }

    await logLogin(identifier, false, undefined, 'Invalid credentials', req);
    throw new AppError('Invalid credentials', 401);
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw new AppError('Refresh token required', 400);

    const payload = verifyRefreshToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) throw new AppError('Invalid refresh token', 401);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) throw new AppError('User not found', 401);

    await prisma.refreshToken.delete({ where: { id: stored.id } });
    const tokens = await issueTokens(user.id, user.email, user.role);
    sendSuccess(res, tokens);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    sendSuccess(res, null, 'Logged out');
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        patient: { include: { user: { select: { email: true, phone: true, phoneVerified: true, emailVerified: true, profilePhotoUrl: true } } } },
        doctor: true,
        staff: true,
      },
    });
    if (!user) return sendError(res, 'User not found', 404);

    const safe = sanitizeUser(user);
    if (user.patient && user.role === 'PATIENT') {
      const profile = profileToResponse(user.patient as never);
      (safe as Record<string, unknown>).patient = profile;
      (safe as Record<string, unknown>).profileCompleted = profile.profileCompleted;
    }
    sendSuccess(res, safe);
  } catch (err) {
    next(err);
  }
});

// ─── Google Authentication (Patients) ────────────────────────────────────────

router.get('/google/config', async (_req, res, next) => {
  try {
    const config = await resolveGoogleClientId();
    sendSuccess(res, {
      enabled: config.enabled,
      clientId: config.clientId,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/google', validateBody(z.object({
  credential: z.string().min(1),
})), async (req, res, next) => {
  try {
    const googleUser = await verifyGoogleIdToken(req.body.credential);

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: googleUser.googleId }, { email: googleUser.email }] },
      include: {
        patient: { include: { user: { select: { email: true, phone: true, phoneVerified: true, emailVerified: true, profilePhotoUrl: true } } } },
      },
    });

    if (user && user.role !== 'PATIENT') {
      throw new AppError('This Google account is linked to a non-patient account. Use the correct login portal.', 403);
    }

    if (!user) {
      const randomPassword = await hashPassword(crypto.randomBytes(32).toString('hex'));
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          passwordHash: randomPassword,
          role: 'PATIENT',
          authProvider: 'google',
          googleId: googleUser.googleId,
          profilePhotoUrl: googleUser.profilePhoto,
          emailVerified: googleUser.emailVerified,
          patient: {
            create: {
              fullName: googleUser.fullName,
              profilePhoto: googleUser.profilePhoto,
              profileCompleted: false,
              profileCompletionStep: 'basic',
            },
          },
        },
        include: {
          patient: { include: { user: { select: { email: true, phone: true, phoneVerified: true, emailVerified: true, profilePhotoUrl: true } } } },
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.googleId,
          authProvider: user.authProvider === 'local' ? 'google' : user.authProvider,
          profilePhotoUrl: googleUser.profilePhoto || user.profilePhotoUrl,
          emailVerified: googleUser.emailVerified || user.emailVerified,
        },
        include: {
          patient: { include: { user: { select: { email: true, phone: true, phoneVerified: true, emailVerified: true, profilePhotoUrl: true } } } },
        },
      });

      if (!user.patient) {
        await prisma.patient.create({
          data: {
            userId: user.id,
            fullName: googleUser.fullName,
            profilePhoto: googleUser.profilePhoto,
            profileCompleted: false,
          },
        });
        user = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            patient: { include: { user: { select: { email: true, phone: true, phoneVerified: true, emailVerified: true, profilePhotoUrl: true } } } },
          },
        }) as typeof user;
      } else if (!user.patient.fullName || user.patient.fullName === googleUser.email.split('@')[0]) {
        await prisma.patient.update({
          where: { id: user.patient.id },
          data: { fullName: googleUser.fullName, profilePhoto: googleUser.profilePhoto || user.patient.profilePhoto },
        });
      }
    }

    if (!user) throw new AppError('Failed to create account', 500);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await logLogin(googleUser.email, true, user.id, 'Google login', req);

    const tokens = await issueTokens(user.id, user.email, user.role);
    const safe = sanitizeUser(user);
    const profile = user.patient ? profileToResponse(user.patient as never) : null;
    if (profile) {
      (safe as Record<string, unknown>).patient = profile;
      (safe as Record<string, unknown>).profileCompleted = profile.profileCompleted;
    }

    sendSuccess(res, { user: safe, ...tokens, profileCompleted: profile?.profileCompleted ?? false }, 'Google login successful');
  } catch (err) { next(err); }
});

// ─── Forgot Password ─────────────────────────────────────────────────────────

router.post('/forgot-password/send-otp', validateBody(z.object({
  identifier: z.string().min(3),
})), async (req, res, next) => {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;
    const result = await sendPasswordResetOtp(req.body.identifier, ip);
    sendSuccess(res, result, result.message);
  } catch (err) { next(err); }
});

router.post('/forgot-password/verify-otp', validateBody(z.object({
  identifier: z.string().min(3),
  otp: z.string().length(6),
})), async (req, res, next) => {
  try {
    const result = await verifyPasswordResetOtp(req.body.identifier, req.body.otp);
    sendSuccess(res, result, 'OTP verified');
  } catch (err) {
    const code = err instanceof Error ? err.message : 'INVALID';
    if (code === 'LOCKED') return sendError(res, 'Too many failed attempts. Try again later.', 429);
    if (code === 'EXPIRED') return sendError(res, 'OTP has expired. Request a new one.', 400);
    if (code === 'INVALID_OTP') return sendError(res, 'Invalid OTP. Please try again.', 400);
    return sendError(res, 'Invalid or expired OTP', 400);
  }
});

router.post('/forgot-password/reset', validateBody(z.object({
  identifier: z.string().min(3),
  resetToken: z.string().min(1),
  newPassword: z.string().min(8),
  confirmPassword: z.string().min(8),
  currentPassword: z.string().optional(),
})), async (req, res, next) => {
  try {
    if (req.body.newPassword !== req.body.confirmPassword) {
      return sendError(res, 'Passwords do not match', 400);
    }
    const result = await resetPasswordWithToken(
      req.body.identifier,
      req.body.resetToken,
      req.body.newPassword,
      { currentPassword: req.body.currentPassword },
    );
    sendSuccess(res, result, result.message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'RESET_FAILED';
    if (msg === 'PASSWORD_REUSED') return sendError(res, 'Cannot reuse a recent password', 400);
    if (msg === 'TOKEN_EXPIRED') return sendError(res, 'Reset token expired. Start again.', 400);
    if (msg === 'ADMIN_REAUTH_REQUIRED') return sendError(res, 'Super Admin accounts require current password verification', 403);
    if (msg === 'ADMIN_REAUTH_FAILED') return sendError(res, 'Current password verification failed', 401);
    if (msg.includes('Password must')) return sendError(res, msg, 400);
    return sendError(res, 'Password reset failed', 400);
  }
});

router.get('/forgot-password/security-hints', async (_req, res, next) => {
  try {
    const { getSecuritySettings } = await import('../lib/password-reset');
    const s = await getSecuritySettings();
    sendSuccess(res, {
      minPasswordLength: s.minPasswordLength,
      requireUppercase: s.requireUppercase,
      requireNumbers: s.requireNumbers,
      requireSpecialChars: s.requireSpecialChars,
      otpExpiryMinutes: s.otpExpiryMinutes,
    });
  } catch (err) { next(err); }
});

async function issueTokens(userId: string, email: string, role: string) {
  const doctor = await prisma.doctor.findUnique({ where: { userId }, select: { organizationId: true, branchId: true } });
  const staff = await prisma.staff.findUnique({ where: { userId }, select: { organizationId: true, branchId: true } });

  const organizationId = doctor?.organizationId || staff?.organizationId || undefined;
  const branchId = doctor?.branchId || staff?.branchId || undefined;

  const accessToken = signAccessToken({ userId, email, role: role as never, organizationId, branchId });
  const refreshToken = signRefreshToken({ userId });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({ data: { token: refreshToken, userId, expiresAt } });

  return { accessToken, refreshToken };
}

function sanitizeUser(user: {
  id: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  patient?: unknown;
  doctor?: unknown;
  staff?: unknown;
}) {
  const { passwordHash: _, ...safe } = user as typeof user & { passwordHash?: string };
  return safe;
}

export default router;
