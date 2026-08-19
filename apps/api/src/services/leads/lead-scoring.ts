import { LeadTemperature } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { aiComplete, getAiSettings, isAiFeatureEnabled } from '../ai';

export interface LeadScoreResult {
  score: number;
  temperature: LeadTemperature;
  nextBestAction: string;
  factors: Record<string, number>;
}

export function computeLeadScore(
  lead: {
    source: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    specialty: string | null;
    lastContactAt: Date | null;
    createdAt: Date;
    activities: { createdAt: Date }[];
  },
  weights: Record<string, number>
): LeadScoreResult {
  const factors: Record<string, number> = {};
  let score = 0;

  if (lead.source) {
    const sourceBoost = ['REFERRAL', 'DOCTOR_REFERRAL', 'AASHA', 'CAMPAIGN'].some((s) =>
      lead.source!.toUpperCase().includes(s)
    )
      ? weights.source
      : Math.floor(weights.source / 2);
    factors.source = sourceBoost;
    score += sourceBoost;
  }

  if (lead.email || lead.phone) {
    factors.verifiedContact = weights.verifiedContact;
    score += weights.verifiedContact;
  }

  if (['INTERESTED', 'APPOINTMENT_BOOKED'].includes(lead.status)) {
    factors.appointmentIntent = weights.appointmentIntent;
    score += weights.appointmentIntent;
  }

  if (lead.status === 'INTERESTED') {
    factors.interestedStatus = weights.interestedStatus;
    score += weights.interestedStatus;
  }

  if (lead.specialty) {
    factors.specialty = 5;
    score += 5;
  }

  const daysSinceContact = lead.lastContactAt
    ? (Date.now() - lead.lastContactAt.getTime()) / 86400000
    : (Date.now() - lead.createdAt.getTime()) / 86400000;
  if (daysSinceContact <= 2 && lead.activities.length > 0) {
    factors.recentActivity = weights.recentActivity;
    score += weights.recentActivity;
  }
  if (daysSinceContact > 3) {
    factors.followUpDue = weights.followUpDue;
    score += weights.followUpDue;
  }

  score = Math.min(100, score);
  let temperature: LeadTemperature = 'COLD';
  if (score >= 70) temperature = 'HOT';
  else if (score >= 40) temperature = 'WARM';

  let nextBestAction = 'Schedule initial follow-up call';
  if (temperature === 'HOT') nextBestAction = 'Call now — high intent lead';
  else if (lead.status === 'APPOINTMENT_BOOKED') nextBestAction = 'Send appointment confirmation details';
  else if (daysSinceContact > 3) nextBestAction = 'Schedule follow-up — no recent contact';
  else if (!lead.email && !lead.phone) nextBestAction = 'Collect verified contact information';

  return { score, temperature, nextBestAction, factors };
}

export async function scoreLead(leadId: string, userId?: string): Promise<LeadScoreResult> {
  const settings = await getAiSettings();
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { activities: { orderBy: { createdAt: 'desc' }, take: 10 }, organization: { select: { name: true } } },
  });
  if (!lead) throw new Error('Lead not found');

  const result = computeLeadScore(lead, settings.leadScoringWeights);

  let aiSummary = lead.aiSummary;
  if (await isAiFeatureEnabled('leadSummary')) {
    const activityText = lead.activities.map((a) => `${a.action}: ${a.notes || ''}`).join('\n');
    const ai = await aiComplete({
      module: 'leads',
      feature: 'lead_summary',
      inputRef: leadId,
      userId,
      organizationId: lead.organizationId,
      system: 'Summarize lead activity in 2-3 sentences for sales staff. Use only provided facts.',
      user: `Lead: ${lead.name || 'Unknown'}, Status: ${lead.status}, Source: ${lead.source || 'unknown'}, Hospital: ${lead.organization.name}, Specialty: ${lead.specialty || 'N/A'}, Score: ${result.score}, Temperature: ${result.temperature}\nActivities:\n${activityText || 'No activities yet'}`,
    });
    if (ai.fromAi && ai.text) aiSummary = ai.text;
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      score: result.score,
      temperature: result.temperature,
      nextBestAction: result.nextBestAction,
      aiSummary,
      lastScoredAt: new Date(),
    },
  });

  return result;
}

export async function getLeadInsights(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { activities: { orderBy: { createdAt: 'desc' }, take: 20 }, organization: { select: { name: true } } },
  });
  if (!lead) return null;
  return {
    score: lead.score,
    temperature: lead.temperature,
    nextBestAction: lead.nextBestAction,
    aiSummary: lead.aiSummary,
    lastScoredAt: lead.lastScoredAt,
  };
}
