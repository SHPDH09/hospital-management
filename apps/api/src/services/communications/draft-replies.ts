import { aiComplete, isAiFeatureEnabled } from '../ai';

export async function draftCommunicationReply(params: {
  subject: string;
  body: string;
  tone?: 'professional' | 'empathetic' | 'concise';
  channel?: string;
  userId?: string;
}) {
  const tone = params.tone || 'professional';
  const fallback = `Thank you for contacting us regarding "${params.subject}". We have received your message and our team will respond shortly.`;

  if (!(await isAiFeatureEnabled('communicationAi'))) {
    return { draft: fallback, fromAi: false, disclaimer: 'Draft requires human approval before sending.' };
  }

  const ai = await aiComplete({
    module: 'communications',
    feature: 'reply_draft',
    userId: params.userId,
    system: `Draft a ${tone} reply for a healthcare platform support team. Be helpful but do not provide medical advice. Mark as draft only.`,
    user: `Channel: ${params.channel || 'email'}\nSubject: ${params.subject}\nMessage:\n${params.body}\n\nWrite a reply draft.`,
  });

  return {
    draft: ai.fromAi && ai.text ? ai.text : fallback,
    fromAi: ai.fromAi,
    disclaimer: 'AI-generated draft — requires human approval before sending.',
  };
}

export async function translateMessage(params: {
  text: string;
  targetLanguage: string;
  userId?: string;
}) {
  if (!(await isAiFeatureEnabled('communicationAi'))) {
    return {
      translated: params.text,
      fromAi: false,
      targetLanguage: params.targetLanguage,
      note: 'Translation unavailable — enable AI in settings.',
    };
  }

  const ai = await aiComplete({
    module: 'communications',
    feature: 'translate',
    userId: params.userId,
    system: 'Translate the message accurately. Preserve medical terms. Output only the translation.',
    user: `Translate to ${params.targetLanguage}:\n${params.text}`,
  });

  return {
    translated: ai.fromAi && ai.text ? ai.text : params.text,
    fromAi: ai.fromAi,
    targetLanguage: params.targetLanguage,
  };
}
