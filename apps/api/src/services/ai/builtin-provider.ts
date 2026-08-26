import { AiCompleteParams, AiCompleteResult, AiProvider } from './types';

const MODEL_ID = 'healthcare-builtin-v1';

export class BuiltinAiProvider implements AiProvider {
  name = 'builtin' as const;

  async complete(params: AiCompleteParams): Promise<AiCompleteResult> {
    const text = generateBuiltinResponse(params.system, params.user);
    return { text, model: MODEL_ID, provider: 'builtin' };
  }
}

function polishFactualText(factual: string): string {
  const lines = factual.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'No data available for this query.';
  const intro = 'Here is what the platform data shows:';
  const body = lines.map((l) => (l.startsWith('•') ? l : `• ${l}`)).join('\n');
  return `${intro}\n${body}`;
}

function summarizeText(user: string): string {
  const content = user.replace(/^[^:]+:\s*/m, '').trim();
  const sentences = content.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
  if (!sentences.length) return content.slice(0, 200) || 'No content to summarize.';
  return sentences.slice(0, 2).join('. ') + '.';
}

function draftReply(user: string): string {
  const subject = user.match(/Subject:\s*(.+)/i)?.[1]?.trim() || 'your inquiry';
  const messageMatch = user.match(/Message:\s*([\s\S]+?)(?:\n\nWrite|$)/i);
  const incoming = messageMatch?.[1]?.trim() || '';

  return `Dear Customer,

Thank you for reaching out regarding "${subject}".

We have received your message${incoming ? ` and understand your concern` : ''}. Our team is reviewing the details and will respond with a follow-up shortly.

If this is urgent, please contact our support line directly.

Best regards,
Healthcare Platform Support Team`;
}

function buildVerificationJson(user: string): string {
  const name = user.match(/Organization:\s*([^\n(]+)/i)?.[1]?.trim() || 'Organization';
  const scoreMatch = user.match(/Completeness score:\s*(\d+)%/i);
  const score = scoreMatch ? Number(scoreMatch[1]) : 50;
  const missing = user.match(/Missing doc types:\s*([^\n]+)/i)?.[1]?.trim();
  const docCount = user.match(/Documents \((\d+)\)/i)?.[1] || '0';

  let recommendation = 'NEEDS_REVIEW';
  if (score >= 80 && (!missing || missing === 'none')) recommendation = 'RECOMMEND_APPROVE';
  else if (score < 50) recommendation = 'INCOMPLETE';

  const flags: string[] = [];
  if (missing && missing !== 'none') flags.push(`Missing documents: ${missing}`);
  if (Number(docCount) < 2) flags.push('Fewer than 2 documents uploaded');
  if (score < 70) flags.push('Profile completeness below 70%');

  return JSON.stringify({
    summary: `${name}: ${score}% complete with ${docCount} document(s). Human approval required before verification.`,
    recommendation,
    flags,
  });
}

function generateBuiltinResponse(system: string, user: string): string {
  const combined = `${system}\n${user}`.toLowerCase();

  const factualMatch =
    user.match(/Factual data[^:]*:\s*([\s\S]+?)(?:\n\nRephrase|$)/i) ||
    user.match(/Organization data[^:]*:\s*([\s\S]+?)(?:\n\nRephrase|$)/i);
  if (factualMatch) return polishFactualText(factualMatch[1].trim());

  if (/output json/i.test(system)) return buildVerificationJson(user);

  if (/translate/i.test(system) || /translate to/i.test(user)) {
    const lang = user.match(/translate to\s+(\w+)/i)?.[1] || 'the target language';
    const text = user.replace(/translate to\s+\w+:\s*/i, '').trim();
    return `[Built-in model] Translation to ${lang} requires OpenAI or Gemini. Original: ${text.slice(0, 300)}`;
  }

  if (/reply draft|draft a/i.test(system)) return draftReply(user);

  if (/summarize/i.test(system) || /summarize/i.test(user)) {
    if (user.includes('[') && user.includes(']')) {
      const lines = user.split('\n').filter((l) => l.includes('['));
      return lines.length
        ? `Detected ${lines.length} alert(s). Top items: ${lines.slice(0, 3).join(' ')}`
        : summarizeText(user);
    }
    return summarizeText(user);
  }

  if (combined.includes('lead') || combined.includes('campaign') || combined.includes('referral')) {
    return polishFactualText(user);
  }

  const trimmed = user.trim();
  if (trimmed.length > 20) return summarizeText(trimmed);
  return 'Analysis complete based on available platform data.';
}
