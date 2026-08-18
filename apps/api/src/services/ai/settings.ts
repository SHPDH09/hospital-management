import { prisma } from '../../lib/prisma';
import { AiSettings, DEFAULT_AI_SETTINGS } from './types';

const SETTINGS_KEY = 'global';

export async function getAiSettings(): Promise<AiSettings> {
  const row = await prisma.aiSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return { ...DEFAULT_AI_SETTINGS };

  const stored = row.value as Partial<AiSettings>;
  const merged: AiSettings = {
    ...DEFAULT_AI_SETTINGS,
    ...stored,
    features: { ...DEFAULT_AI_SETTINGS.features, ...stored.features },
    leadScoringWeights: {
      ...DEFAULT_AI_SETTINGS.leadScoringWeights,
      ...stored.leadScoringWeights,
    },
  };

  const hasExternalKey = Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
  if (!hasExternalKey && (merged.provider === 'openai' || merged.provider === 'gemini')) {
    return {
      ...merged,
      enabled: true,
      provider: 'builtin',
      model: 'healthcare-builtin-v1',
    };
  }

  return merged;
}

export async function updateAiSettings(updates: Partial<AiSettings>): Promise<AiSettings> {
  const current = await getAiSettings();
  const merged: AiSettings = {
    ...current,
    ...updates,
    features: { ...current.features, ...updates.features },
    leadScoringWeights: { ...current.leadScoringWeights, ...updates.leadScoringWeights },
  };

  await prisma.aiSetting.upsert({
    where: { key: SETTINGS_KEY },
    create: { key: SETTINGS_KEY, value: merged as object },
    update: { value: merged as object },
  });

  return merged;
}

export async function isAiFeatureEnabled(feature: string): Promise<boolean> {
  const settings = await getAiSettings();
  return settings.enabled && (settings.features[feature] ?? false);
}
