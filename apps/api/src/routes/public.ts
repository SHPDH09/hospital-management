import { Router } from 'express';
import { prisma, readDb } from '../lib/prisma';
import { sendSuccess } from '../lib/response';
import { SettingCategory, mergeWithDefaults, settingsKey } from '../lib/settings';

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
      getSettingCategory('emergency'),
      getSettingCategory('platform'),
      getSettingCategory('branding'),
    ]);

    const maintenanceMode = Boolean(website.maintenanceMode) || Boolean(emergency.maintenanceMode);

    sendSuccess(res, {
      platformName: platform.platformName,
      tagline: platform.tagline,
      logo: branding.primaryLogo || platform.logo,
      favicon: branding.favicon || platform.favicon,
      maintenanceMode,
      maintenanceMessage: website.maintenanceMessage || 'We are currently performing scheduled maintenance.',
      websiteStatus: website.websiteStatus,
      registrationEnabled: website.registrationEnabled && !emergency.disableRegistration,
      patientRegistration: website.patientRegistration,
      hospitalRegistration: website.hospitalRegistration,
      clinicRegistration: website.clinicRegistration,
      doctorRegistration: website.doctorRegistration,
      searchEnabled: website.searchEnabled,
      appointmentBookingEnabled: website.appointmentBookingEnabled && !emergency.disableAppointmentBooking,
      paymentsEnabled: !emergency.disablePayments,
      advertisementsEnabled: !emergency.disableAdvertisements,
      communicationEnabled: !emergency.disableCommunication,
      readOnlyMode: emergency.readOnlyMode,
      emergencyAnnouncement: emergency.emergencyAnnouncementActive ? emergency.emergencyAnnouncement : null,
      mobile: {
        appName: mobile.appName,
        minimumSupportedVersion: mobile.minimumSupportedVersion,
        latestVersion: mobile.latestVersion,
        forceUpdate: mobile.forceUpdate,
        maintenanceMode: mobile.maintenanceMode,
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
