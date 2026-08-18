import { MEDICAL_DISCLAIMER } from './types';

const MEDICAL_KEYWORDS = [
  'diagnose', 'diagnosis', 'prescribe', 'prescription', 'medicine', 'medication',
  'symptom', 'disease', 'treatment', 'dosage', 'cure', 'cancer', 'fever',
];

export function isMedicalQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return MEDICAL_KEYWORDS.some((kw) => lower.includes(kw));
}

export function medicalSafetyResponse(): string {
  return MEDICAL_DISCLAIMER;
}

export function redactSensitive(text: string): string {
  return text
    .replace(/\b\d{10}\b/g, '[PHONE]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]');
}

export const COPILOT_SYSTEM_PROMPT = `You are a healthcare platform operations assistant.
You help users navigate the platform and understand operational data.
You must NEVER diagnose patients, prescribe medicines, or provide medical treatment advice.
If asked medical questions, clearly state you are not a doctor and recommend consulting a professional.
Only use the factual data provided in the context. Never invent statistics, appointments, or payment statuses.
Be concise and professional.`;
