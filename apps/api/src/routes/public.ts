import { Router } from 'express';
import { prisma, readDb } from '../lib/prisma';
import { sendSuccess } from '../lib/response';
import { getEmergencyState, computeSystemStatus, getActiveControls } from '../lib/emergency';
import { getMaintenancePublicInfo, processScheduledMaintenances } from '../lib/maintenance-scheduler';
import { mergeWithDefaults, settingsKey } from '../lib/settings';
import { SettingCategory } from '../lib/settings';
import { paramId } from '../lib/params';

const router = Router();

async function getSettingCategory(category: SettingCategory) {
  const row = await prisma.platformSetting.findUnique({ where: { key: settingsKey(category) } });
  return mergeWithDefaults(category, row?.value as Record<string, unknown> | null);
}

router.get('/maintenance-status', async (_req, res, next) => {
  try {
    sendSuccess(res, await getMaintenancePublicInfo());
  } catch (err) {
    next(err);
  }
});

router.get('/platform-status', async (_req, res, next) => {
  try {
    const maintenance = await processScheduledMaintenances();

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
      maintenance,
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
    const city = req.query.city as string | undefined;
    const platform = (req.query.platform as string) || 'website';

    const emergency = await getEmergencyState();
    const modules = (emergency.modules || {}) as Record<string, boolean>;
    if (modules.advertisement === false) {
      sendSuccess(res, []);
      return;
    }

    const now = new Date();
    const ads = await prisma.advertisement.findMany({
      where: {
        status: 'ACTIVE',
        isPaused: false,
        platforms: { has: platform },
        ...(type && { type: type as never }),
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ...(city ? [{ OR: [{ targetCities: { isEmpty: true } }, { targetCities: { has: city } }] }] : []),
        ],
      },
      take: 20,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: { organization: { select: { name: true, slug: true, logoUrl: true } } },
    });
    sendSuccess(res, ads);
  } catch (err) {
    next(err);
  }
});

router.post('/advertisements/:id/impression', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    await prisma.advertisement.update({
      where: { id },
      data: { impressions: { increment: 1 }, uniqueImpressions: { increment: 1 } },
    });
    sendSuccess(res, { tracked: true });
  } catch (err) { next(err); }
});

router.post('/advertisements/:id/click', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const eventType = (req.body?.eventType as string) || 'click';
    const data: Record<string, { increment: number }> = { clicks: { increment: 1 } };
    if (eventType === 'profile_view') data.profileViews = { increment: 1 };
    if (eventType === 'call') data.callClicks = { increment: 1 };
    if (eventType === 'whatsapp') data.whatsappClicks = { increment: 1 };
    if (eventType === 'conversion') data.conversions = { increment: 1 };
    await prisma.advertisement.update({ where: { id }, data });
    sendSuccess(res, { tracked: true });
  } catch (err) { next(err); }
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
