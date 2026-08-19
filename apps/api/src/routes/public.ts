import { Router } from 'express';
import { prisma, readDb } from '../lib/prisma';
import { sendSuccess } from '../lib/response';
import { getEmergencyState, computeSystemStatus, getActiveControls } from '../lib/emergency';
import { mergeWithDefaults, settingsKey, SettingCategory } from '../lib/settings';

const router = Router();

async function getSettingCategory(category: SettingCategory) {
  const row = await prisma.platformSetting.findUnique({ where: { key: settingsKey(category) } });
  return mergeWithDefaults(category, row?.value as Record<string, unknown> | null);
}

router.get('/platform-status', async (_req, res, next) => {
  try {
    const [website, mobile, emergency, platform, branding] = await Promise.all([
      getSettingCategory('website'),
      getSettingCategory('mobile'),
      getEmergencyState(),
      getSettingCategory('platform'),
      getSettingCategory('branding'),
    ]);

    const synced = emergency;
    const status = computeSystemStatus(synced);
    const modules = (synced.modules || {}) as Record<string, boolean>;
    const maintenanceMode = Boolean(synced.maintenanceMode) && String(synced.maintenanceType) === 'full';

    let announcements: { message: string; title: string; severity: string }[] = [];
    try {
      announcements = await prisma.emergencyAnnouncement.findMany({
        where: {
          isActive: true,
          startsAt: { lte: new Date() },
          OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
          displayLocations: { has: 'website' },
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { message: true, title: true, severity: true },
      });
    } catch {
      announcements = [];
    }

    sendSuccess(res, {
      systemStatus: status,
      platformName: (platform as { platformName?: string }).platformName,
      tagline: (platform as { tagline?: string }).tagline,
      logo: (branding as { primaryLogo?: string }).primaryLogo || (platform as { logo?: string }).logo,
      favicon: (branding as { favicon?: string }).favicon || (platform as { favicon?: string }).favicon,
      maintenanceMode,
      maintenanceMessage: synced.maintenanceMessage || (website as { maintenanceMessage?: string }).maintenanceMessage || 'We are currently performing scheduled maintenance.',
      maintenanceType: synced.maintenanceType,
      readOnlyMode: synced.readOnlyMode,
      emergencyModeActive: synced.emergencyModeActive,
      activeControls: getActiveControls(synced),
      registrationEnabled: (website as { registrationEnabled?: boolean }).registrationEnabled !== false && modules.patientRegistration !== false,
      patientRegistration: (website as { patientRegistration?: boolean }).patientRegistration !== false && modules.patientRegistration !== false,
      hospitalRegistration: (website as { hospitalRegistration?: boolean }).hospitalRegistration !== false && modules.hospitalRegistration !== false,
      clinicRegistration: (website as { clinicRegistration?: boolean }).clinicRegistration !== false && modules.clinicRegistration !== false,
      doctorRegistration: (website as { doctorRegistration?: boolean }).doctorRegistration !== false && modules.doctorRegistration !== false,
      searchEnabled: (website as { searchEnabled?: boolean }).searchEnabled !== false && modules.publicSearch !== false,
      appointmentBookingEnabled: (website as { appointmentBookingEnabled?: boolean }).appointmentBookingEnabled !== false && modules.appointmentBooking !== false,
      paymentsEnabled: modules.onlinePayment !== false,
      advertisementsEnabled: modules.advertisement !== false,
      communicationEnabled: modules.messaging !== false,
      fileUploadEnabled: modules.fileUpload !== false,
      emergencyAnnouncements: announcements,
      emergencyAnnouncement: announcements[0]?.message || (synced.emergencyAnnouncementActive ? synced.emergencyAnnouncement : null),
      mobile: {
        appName: (mobile as { appName?: string }).appName,
        minimumSupportedVersion: (mobile as { minimumSupportedVersion?: string }).minimumSupportedVersion,
        latestVersion: (mobile as { latestVersion?: string }).latestVersion,
        forceUpdate: (mobile as { forceUpdate?: boolean }).forceUpdate,
        maintenanceMode: (mobile as { maintenanceMode?: boolean }).maintenanceMode || maintenanceMode,
        maintenanceMessage: (mobile as { maintenanceMessage?: string }).maintenanceMessage,
        androidAppLink: (mobile as { androidAppLink?: string }).androidAppLink,
        iosAppLink: (mobile as { iosAppLink?: string }).iosAppLink,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/advertisements', async (req, res, next) => {
  try {
    const type = req.query.type as string | undefined;
    const ads = await prisma.advertisement.findMany({
      where: {
        status: 'ACTIVE',
        ...(type && { type: type as never }),
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, ads);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (_req, res, next) => {
  try {
    const db = readDb();
    const [hospitals, clinics, doctors, patients] = await Promise.all([
      db.organization.count({ where: { type: 'HOSPITAL', verificationStatus: 'APPROVED', isPubliclyListed: true } }),
      db.organization.count({ where: { type: 'CLINIC', verificationStatus: 'APPROVED', isPubliclyListed: true } }),
      db.doctor.count({ where: { isActive: true, organization: { verificationStatus: 'APPROVED' } } }),
      db.patient.count(),
    ]);

    sendSuccess(res, { hospitals, clinics, doctors, patients });
  } catch (err) {
    next(err);
  }
});

export default router;
