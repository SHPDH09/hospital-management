import crypto from 'crypto';
import { prisma } from './prisma';
import { hashPassword, comparePassword } from './auth';
import { mergeWithDefaults, settingsKey, SettingCategory } from './settings';

export type SecuritySettings = {
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  otpExpiryMinutes: number;
  otpAttemptLimit: number;
  resetTokenExpiryMinutes: number;
  passwordReuseLimit: number;
  passwordResetRateLimitPerHour: number;
  invalidateSessionsOnReset: boolean;
  twoFactorRequiredForAdmin: boolean;
};

const GENERIC_MSG = 'If an account exists with this email or phone, an OTP has been sent.';

export async function getSecuritySettings(): Promise<SecuritySettings> {
  const row = await prisma.platformSetting.findUnique({ where: { key: settingsKey('security' as SettingCategory) } });
  const merged = mergeWithDefaults('security', row?.value as Record<string, unknown> | null);
  return {
    minPasswordLength: Number(merged.minPasswordLength) || 8,
    requireUppercase: Boolean(merged.requireUppercase),
    requireNumbers: Boolean(merged.requireNumbers),
    requireSpecialChars: Boolean(merged.requireSpecialChars),
    otpExpiryMinutes: Number(merged.otpExpiryMinutes) || 5,
    otpAttemptLimit: Number(merged.otpAttemptLimit) || 5,
    resetTokenExpiryMinutes: Number(merged.resetTokenExpiryMinutes) || 15,
    passwordReuseLimit: Number(merged.passwordReuseLimit) || 5,
    passwordResetRateLimitPerHour: Number(merged.passwordResetRateLimitPerHour) || 3,
    invalidateSessionsOnReset: merged.invalidateSessionsOnReset !== false,
    twoFactorRequiredForAdmin: merged.twoFactorRequiredForAdmin !== false,
  };
}

export function normalizeIdentifier(input: string): string {
  return input.trim().toLowerCase();
}

export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999));
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function validatePasswordStrength(password: string, settings: SecuritySettings): string | null {
  if (password.length < settings.minPasswordLength) {
    return `Password must be at least ${settings.minPasswordLength} characters`;
  }
  if (settings.requireUppercase && !/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (settings.requireNumbers && !/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  if (settings.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
}

export async function findUserByIdentifier(identifier: string) {
  const normalized = normalizeIdentifier(identifier);
  if (isEmail(normalized)) {
    return prisma.user.findUnique({ where: { email: normalized } });
  }
  return prisma.user.findFirst({
    where: { phone: identifier.trim() },
  });
}

export async function checkRateLimit(identifier: string, ipAddress?: string, limitPerHour = 3) {
  const ip = ipAddress || 'unknown';
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  let record = await prisma.passwordResetRateLimit.findUnique({
    where: { identifier_ipAddress: { identifier: normalizeIdentifier(identifier), ipAddress: ip } },
  });

  if (!record) {
    record = await prisma.passwordResetRateLimit.create({
      data: { identifier: normalizeIdentifier(identifier), ipAddress: ip, sendCount: 1, windowStart: now },
    });
    return { allowed: true };
  }

  if (record.lockedUntil && record.lockedUntil > now) {
    return { allowed: false, lockedUntil: record.lockedUntil };
  }

  if (record.windowStart < oneHourAgo) {
    await prisma.passwordResetRateLimit.update({
      where: { id: record.id },
      data: { sendCount: 1, windowStart: now, lockedUntil: null },
    });
    return { allowed: true };
  }

  if (record.sendCount >= limitPerHour) {
    const lockedUntil = new Date(now.getTime() + 60 * 60 * 1000);
    await prisma.passwordResetRateLimit.update({
      where: { id: record.id },
      data: { lockedUntil },
    });
    return { allowed: false, lockedUntil };
  }

  await prisma.passwordResetRateLimit.update({
    where: { id: record.id },
    data: { sendCount: record.sendCount + 1 },
  });
  return { allowed: true };
}

export async function sendPasswordResetOtp(identifier: string, ipAddress?: string) {
  const settings = await getSecuritySettings();
  const rateCheck = await checkRateLimit(identifier, ipAddress, settings.passwordResetRateLimitPerHour);
  if (!rateCheck.allowed) {
    return { success: true, message: GENERIC_MSG };
  }

  const user = await findUserByIdentifier(identifier);
  if (!user || !user.isActive) {
    return { success: true, message: GENERIC_MSG };
  }

  // Super Admin: block automated OTP — require manual/security team process
  if (user.role === 'SUPER_ADMIN' && settings.twoFactorRequiredForAdmin) {
    console.warn(`[SECURITY] Password reset blocked for Super Admin: ${user.email}`);
    return { success: true, message: GENERIC_MSG };
  }

  const otp = generateOtp();
  const otpHash = await hashPassword(otp);
  const otpExpiresAt = new Date(Date.now() + settings.otpExpiryMinutes * 60 * 1000);

  await prisma.passwordResetRequest.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetRequest.create({
    data: {
      userId: user.id,
      identifier: normalizeIdentifier(identifier),
      otpHash,
      otpExpiresAt,
      ipAddress,
    },
  });

  // OTP delivery — integrate email/SMS provider in production
  console.info(`[PASSWORD RESET] OTP for ${user.email}: ${otp} (expires in ${settings.otpExpiryMinutes} min)`);

  return {
    success: true,
    message: GENERIC_MSG,
    ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
  };
}

export async function verifyPasswordResetOtp(identifier: string, otp: string) {
  const settings = await getSecuritySettings();
  const user = await findUserByIdentifier(identifier);
  if (!user) throw new Error('INVALID');

  const request = await prisma.passwordResetRequest.findFirst({
    where: { userId: user.id, usedAt: null, verifiedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!request) throw new Error('INVALID');
  if (request.lockedUntil && request.lockedUntil > new Date()) throw new Error('LOCKED');
  if (request.otpExpiresAt < new Date()) throw new Error('EXPIRED');

  const attempts = request.otpAttempts + 1;
  const valid = await comparePassword(otp, request.otpHash);

  if (!valid) {
    const lockedUntil = attempts >= settings.otpAttemptLimit
      ? new Date(Date.now() + 30 * 60 * 1000)
      : null;
    await prisma.passwordResetRequest.update({
      where: { id: request.id },
      data: { otpAttempts: attempts, lockedUntil },
    });
    throw new Error(lockedUntil ? 'LOCKED' : 'INVALID_OTP');
  }

  const resetToken = generateResetToken();
  const resetExpiresAt = new Date(Date.now() + settings.resetTokenExpiryMinutes * 60 * 1000);

  await prisma.passwordResetRequest.update({
    where: { id: request.id },
    data: { verifiedAt: new Date(), resetToken, resetExpiresAt },
  });

  return { resetToken, expiresInMinutes: settings.resetTokenExpiryMinutes };
}

export async function resetPasswordWithToken(
  identifier: string,
  resetToken: string,
  newPassword: string,
  options?: { currentPassword?: string },
) {
  const settings = await getSecuritySettings();
  const strengthError = validatePasswordStrength(newPassword, settings);
  if (strengthError) throw new Error(strengthError);

  const user = await findUserByIdentifier(identifier);
  if (!user) throw new Error('INVALID');

  if (user.role === 'SUPER_ADMIN' && settings.twoFactorRequiredForAdmin) {
    if (!options?.currentPassword) throw new Error('ADMIN_REAUTH_REQUIRED');
    const valid = await comparePassword(options.currentPassword, user.passwordHash);
    if (!valid) throw new Error('ADMIN_REAUTH_FAILED');
  }

  const request = await prisma.passwordResetRequest.findFirst({
    where: { userId: user.id, resetToken, usedAt: null, verifiedAt: { not: null } },
    orderBy: { createdAt: 'desc' },
  });

  if (!request || !request.resetExpiresAt || request.resetExpiresAt < new Date()) {
    throw new Error('TOKEN_EXPIRED');
  }

  const history = await prisma.passwordHistory.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: settings.passwordReuseLimit,
  });

  for (const h of history) {
    if (await comparePassword(newPassword, h.passwordHash)) {
      throw new Error('PASSWORD_REUSED');
    }
  }
  if (await comparePassword(newPassword, user.passwordHash)) {
    throw new Error('PASSWORD_REUSED');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.passwordHistory.create({ data: { userId: user.id, passwordHash: user.passwordHash } });
    await tx.passwordResetRequest.update({ where: { id: request.id }, data: { usedAt: new Date() } });
    if (settings.invalidateSessionsOnReset) {
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
    }
  });

  return { success: true, message: 'Password updated successfully' };
}

export { GENERIC_MSG };
