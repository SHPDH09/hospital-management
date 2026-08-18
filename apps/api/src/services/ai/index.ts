import { logAiOperation } from './audit';
import { GeminiProvider } from './gemini-provider';
import { NoopAiProvider } from './noop-provider';
import { OpenAiProvider } from './openai-provider';
import { getAiSettings } from './settings';
import { AiCompleteParams, AiCompleteResult, AiProvider } from './types';

function resolveProvider(settings: Awaited<ReturnType<typeof getAiSettings>>): AiProvider {
  if (!settings.enabled || settings.provider === 'none') {
    return new NoopAiProvider();
  }
  if (settings.provider === 'openai') {
    const key = process.env.OPENAI_API_KEY;
    if (!key) return new NoopAiProvider();
    return new OpenAiProvider(key, settings.model);
  }
  if (settings.provider === 'gemini') {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return new NoopAiProvider();
    return new GeminiProvider(key, settings.model);
  }
  return new NoopAiProvider();
}

export async function aiComplete(
  params: AiCompleteParams & {
    userId?: string;
    organizationId?: string;
    module: string;
    feature: string;
    inputRef?: string;
  }
): Promise<AiCompleteResult & { fromAi: boolean }> {
  const settings = await getAiSettings();
  const provider = resolveProvider(settings);

  if (provider.name === 'none') {
    await logAiOperation({
      userId: params.userId,
      organizationId: params.organizationId,
      module: params.module,
      feature: params.feature,
      inputRef: params.inputRef,
      status: 'skipped',
      outputSummary: 'AI disabled or no provider configured',
    });
    return { text: '', model: 'none', provider: 'none', fromAi: false };
  }

  try {
    const result = await provider.complete({
      ...params,
      maxTokens: params.maxTokens ?? settings.maxTokens,
      temperature: params.temperature ?? settings.temperature,
    });
    await logAiOperation({
      userId: params.userId,
      organizationId: params.organizationId,
      module: params.module,
      feature: params.feature,
      inputRef: params.inputRef,
      outputSummary: result.text.slice(0, 500),
      model: result.model,
      status: 'success',
    });
    return { ...result, fromAi: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    await logAiOperation({
      userId: params.userId,
      organizationId: params.organizationId,
      module: params.module,
      feature: params.feature,
      inputRef: params.inputRef,
      status: 'error',
      error: message,
    });
    throw err;
  }
}

export { getAiSettings, updateAiSettings, isAiFeatureEnabled } from './settings';
export { logAiOperation } from './audit';
export { isMedicalQuery, medicalSafetyResponse, COPILOT_SYSTEM_PROMPT } from './safety';
export type { AiSettings } from './types';
