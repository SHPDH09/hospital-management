export type AiProviderName = 'openai' | 'gemini' | 'builtin' | 'none';

export interface AiCompleteParams {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AiCompleteResult {
  text: string;
  model: string;
  provider: AiProviderName;
}

export interface AiProvider {
  name: AiProviderName;
  complete(params: AiCompleteParams): Promise<AiCompleteResult>;
}

export interface AiSettings {
  enabled: boolean;
  provider: AiProviderName;
  model: string;
  maxTokens: number;
  temperature: number;
  features: Record<string, boolean>;
  leadScoringWeights: Record<string, number>;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: process.env.AI_ENABLED !== 'false',
  provider: (process.env.AI_PROVIDER as AiProviderName) || 'builtin',
  model: process.env.AI_DEFAULT_MODEL || 'healthcare-builtin-v1',
  maxTokens: Number(process.env.AI_MAX_TOKENS) || 1024,
  temperature: 0.3,
  features: {
    copilot: true,
    leadScoring: true,
    leadSummary: true,
    reviewSentiment: true,
    ticketClassification: true,
    appointmentReminders: true,
    documentVerification: true,
    patientTimeline: true,
    fraudDetection: true,
    communicationAi: true,
  },
  leadScoringWeights: {
    source: 15,
    verifiedContact: 20,
    appointmentIntent: 25,
    interestedStatus: 20,
    recentActivity: 10,
    followUpDue: 10,
  },
};

export const MEDICAL_DISCLAIMER =
  'I am a platform assistant, not a doctor. I cannot diagnose conditions or prescribe medicines. Please consult a qualified healthcare professional for medical advice.';
