import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, comparePassword, signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/auth';
import { sendSuccess, sendError, AppError } from '../lib/response';
import { authenticate, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

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
  email: z.string().email(),
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
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { patient: true, doctor: true, staff: true },
    });

    if (!user || !user.isActive) throw new AppError('Invalid credentials', 401);
    let valid = false;
    try {
      valid = await comparePassword(password, user.passwordHash);
    } catch {
      throw new AppError('Invalid credentials', 401);
    }
    if (!valid) throw new AppError('Invalid credentials', 401);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokens = await issueTokens(user.id, user.email, user.role);
    sendSuccess(res, { user: sanitizeUser(user), ...tokens }, 'Login successful');
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
      include: { patient: true, doctor: true, staff: true },
    });
    if (!user) return sendError(res, 'User not found', 404);
    sendSuccess(res, sanitizeUser(user));
  } catch (err) {
    next(err);
  }
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
