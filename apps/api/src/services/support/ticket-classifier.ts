import { ComplaintPriority } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { aiComplete, isAiFeatureEnabled } from '../ai';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  appointment: ['appointment', 'booking', 'schedule', 'slot'],
  payment: ['payment', 'paid', 'billing', 'charge', 'invoice'],
  hospital: ['hospital', 'facility', 'ward'],
  clinic: ['clinic'],
  doctor: ['doctor', 'physician', 'consultation'],
  subscription: ['subscription', 'plan', 'renewal'],
  technical: ['login', 'error', 'bug', 'website', 'app', 'technical'],
  account: ['account', 'password', 'profile', 'email'],
  refund: ['refund', 'money back', 'reversal'],
  complaint: ['complaint', 'rude', 'misconduct', 'negligence'],
};

function classifyByKeywords(text: string): string {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return 'general';
}

function suggestPriority(category: string, text: string): ComplaintPriority {
  const lower = text.toLowerCase();
  if (['refund', 'payment'].includes(category) && lower.includes('successful')) return 'HIGH';
  if (lower.includes('urgent') || lower.includes('emergency') || lower.includes('critical')) return 'URGENT';
  if (['payment', 'refund', 'complaint'].includes(category)) return 'HIGH';
  if (['appointment', 'account'].includes(category)) return 'MEDIUM';
  return 'LOW';
}

export async function classifyComplaint(complaintId: string, userId?: string) {
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
  if (!complaint) throw new Error('Complaint not found');

  const text = `${complaint.subject} ${complaint.description}`;
  const aiCategory = classifyByKeywords(text);
  const aiPriority = suggestPriority(aiCategory, text);

  let aiSummary = `${complaint.subject}`;
  let suggestedResponse: string | null = null;

  if (await isAiFeatureEnabled('ticketClassification')) {
    const ai = await aiComplete({
      module: 'complaints',
      feature: 'ticket_classify',
      inputRef: complaintId,
      userId,
      organizationId: complaint.organizationId || undefined,
      system: 'Summarize support ticket in one sentence and suggest a brief professional response draft. Mark response as draft requiring staff approval.',
      user: `Subject: ${complaint.subject}\nDescription: ${complaint.description}\nCategory hint: ${aiCategory}\nPriority hint: ${aiPriority}`,
    });
    if (ai.fromAi && ai.text) {
      const parts = ai.text.split('\n');
      aiSummary = parts[0] || aiSummary;
      suggestedResponse = parts.slice(1).join('\n').trim() || null;
    }
  }

  await prisma.complaint.update({
    where: { id: complaintId },
    data: {
      aiCategory,
      aiPriority,
      aiSummary,
      suggestedResponse,
      priority: complaint.priority === 'MEDIUM' ? aiPriority : complaint.priority,
    },
  });

  return { aiCategory, aiPriority, aiSummary, suggestedResponse };
}
