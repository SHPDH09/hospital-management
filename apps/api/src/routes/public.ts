import { Router } from 'express';
import { prisma, readDb } from '../lib/prisma';
import { sendSuccess } from '../lib/response';
import { getEmergencyState, computeSystemStatus, getActiveControls } from '../lib/emergency';
import { mergeWithDefaults, settingsKey } from '../lib/settings';
import { SettingCategory } from '../lib/settings';

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

    const announcements = await prisma.emergencyAnnouncement.findMany({
      where: {
        isActive: true,
        startsAt: { lte: new Date() },
        OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }],
        displayLocations: { has: 'website' },
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });

    sendSuccess(res, {
      systemStatus: status,
      platformName: platform.platformName,
      tagline: platform.tagline,
      logo: branding.primaryLogo || platform.logo,
      favicon: branding.favicon || platform.favicon,
      maintenanceMode,
      maintenanceMessage: synced.maintenanceMessage || website.maintenanceMessage || 'We are currently performing scheduled maintenance.',
      maintenanceType: synced.maintenanceType,
      readOnlyMode: synced.readOnlyMode,
      emergencyModeActive: synced.emergencyModeActive,
      activeControls: getActiveControls(synced),
      registrationEnabled: website.registrationEnabled && modules.patientRegistration !== false && !(synced.security as Record<string, unknown>)?.disableNewRegistrations,
      patientRegistration: website.patientRegistration && modules.patientRegistration !== false,
      hospitalRegistration: website.hospitalRegistration && modules.hospitalRegistration !== false,
      clinicRegistration: website.clinicRegistration && modules.clinicRegistration !== false,
      doctorRegistration: website.doctorRegistration && modules.doctorRegistration !== false,
      searchEnabled: website.searchEnabled && modules.publicSearch !== false,
      appointmentBookingEnabled: website.appointmentBookingEnabled && modules.appointmentBooking !== false,
      paymentsEnabled: modules.onlinePayment !== false,
      advertisementsEnabled: modules.advertisement !== false,
      communicationEnabled: modules.messaging !== false,
      fileUploadEnabled: modules.fileUpload !== false,
      emergencyAnnouncements: announcements,
      emergencyAnnouncement: announcements[0]?.message || (synced.emergencyAnnouncementActive ? synced.emergencyAnnouncement : null),
      mobile: {
        appName: mobile.appName,
        minimumSupportedVersion: mobile.minimumSupportedVersion,
        latestVersion: mobile.latestVersion,
        forceUpdate: mobile.forceUpdate,
        maintenanceMode: mobile.maintenanceMode || maintenanceMode,
        maintenanceMessage: mobile.maintenanceMessage,
        androidAppLink: mobile.androidAppLink,
        iosAppLink: mobile.iosAppLink,
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
