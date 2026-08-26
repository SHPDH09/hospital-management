import { Router } from 'express';
import { prisma, readDb } from '../lib/prisma';
import { sendSuccess } from '../lib/response';
import { getEmergencyState, computeSystemStatus, getActiveControls } from '../lib/emergency';
import { mergeWithDefaults, settingsKey, SettingCategory } from '../lib/settings';
import { paramId } from '../lib/params';

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

    const websiteSettings = website as Record<string, unknown>;
    const platformSettings = platform as Record<string, unknown>;
    const brandingSettings = branding as Record<string, unknown>;
    const mobileSettings = mobile as Record<string, unknown>;
    const securitySettings = (synced.security || {}) as Record<string, unknown>;

    sendSuccess(res, {
      systemStatus: status,
      platformName: platformSettings.platformName,
      tagline: platformSettings.tagline,
      logo: brandingSettings.primaryLogo || platformSettings.logo,
      favicon: brandingSettings.favicon || platformSettings.favicon,
      maintenanceMode,
      maintenanceMessage: synced.maintenanceMessage || websiteSettings.maintenanceMessage || 'We are currently performing scheduled maintenance.',
      maintenanceType: synced.maintenanceType,
      readOnlyMode: synced.readOnlyMode,
      emergencyModeActive: synced.emergencyModeActive,
      activeControls: getActiveControls(synced),
      registrationEnabled: websiteSettings.registrationEnabled !== false && modules.patientRegistration !== false && !securitySettings.disableNewRegistrations,
      patientRegistration: websiteSettings.patientRegistration !== false && modules.patientRegistration !== false,
      hospitalRegistration: websiteSettings.hospitalRegistration !== false && modules.hospitalRegistration !== false,
      clinicRegistration: websiteSettings.clinicRegistration !== false && modules.clinicRegistration !== false,
      doctorRegistration: websiteSettings.doctorRegistration !== false && modules.doctorRegistration !== false,
      searchEnabled: websiteSettings.searchEnabled !== false && modules.publicSearch !== false,
      appointmentBookingEnabled: websiteSettings.appointmentBookingEnabled !== false && modules.appointmentBooking !== false,
      paymentsEnabled: modules.onlinePayment !== false,
      advertisementsEnabled: modules.advertisement !== false,
      communicationEnabled: modules.messaging !== false,
      fileUploadEnabled: modules.fileUpload !== false,
      emergencyAnnouncements: announcements,
      emergencyAnnouncement: announcements[0]?.message || (synced.emergencyAnnouncementActive ? synced.emergencyAnnouncement : null),
      mobile: {
        appName: mobileSettings.appName,
        minimumSupportedVersion: mobileSettings.minimumSupportedVersion,
        latestVersion: mobileSettings.latestVersion,
        forceUpdate: mobileSettings.forceUpdate,
        maintenanceMode: mobileSettings.maintenanceMode || maintenanceMode,
        maintenanceMessage: mobileSettings.maintenanceMessage,
        androidAppLink: mobileSettings.androidAppLink,
        iosAppLink: mobileSettings.iosAppLink,
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
