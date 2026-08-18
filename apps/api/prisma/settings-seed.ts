import { PrismaClient } from '@prisma/client';
import { DEFAULT_SETTINGS, SETTING_CATEGORIES, settingsKey } from '../src/lib/settings';

export async function seedPlatformSettings(prisma: PrismaClient) {
  for (const category of SETTING_CATEGORIES) {
    const key = settingsKey(category);
    await prisma.platformSetting.upsert({
      where: { key },
      update: {},
      create: {
        key,
        category: 'settings',
        value: DEFAULT_SETTINGS[category],
      },
    });
  }
  console.log(`  Platform settings: ${SETTING_CATEGORIES.length} categories seeded`);
}
