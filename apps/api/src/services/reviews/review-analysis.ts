import { ReviewSentiment } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { aiComplete, isAiFeatureEnabled } from '../ai';

const TOPIC_KEYWORDS: Record<string, string[]> = {
  doctor: ['doctor', 'physician', 'consultation', 'diagnosis'],
  staff: ['staff', 'reception', 'nurse', 'front desk'],
  waiting: ['wait', 'waiting', 'queue', 'delay'],
  cleanliness: ['clean', 'hygiene', 'sanitary', 'dirty'],
  facilities: ['facility', 'equipment', 'infrastructure', 'parking'],
  price: ['price', 'cost', 'expensive', 'affordable', 'fee'],
  appointment: ['appointment', 'booking', 'schedule'],
  service: ['service', 'care', 'treatment'],
};

export function classifyReviewSentiment(rating: number, comment?: string | null): {
  sentiment: ReviewSentiment;
  topics: string[];
  riskScore: string;
} {
  let sentiment: ReviewSentiment = 'NEUTRAL';
  if (rating >= 4) sentiment = 'POSITIVE';
  else if (rating <= 2) sentiment = 'NEGATIVE';

  const text = (comment || '').toLowerCase();
  const topics: string[] = [];
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) topics.push(topic);
  }

  let riskScore = 'LOW';
  if (sentiment === 'NEGATIVE' && rating <= 2) riskScore = 'HIGH';
  else if (sentiment === 'NEGATIVE') riskScore = 'MEDIUM';

  return { sentiment, topics, riskScore };
}

export async function analyzeReview(reviewId: string, userId?: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      organization: { select: { name: true } },
      doctor: { select: { fullName: true } },
    },
  });
  if (!review) throw new Error('Review not found');

  const { sentiment, topics, riskScore } = classifyReviewSentiment(review.rating, review.comment);

  let aiSummary: string | null = null;
  if (await isAiFeatureEnabled('reviewSentiment') && review.comment) {
    const ai = await aiComplete({
      module: 'reviews',
      feature: 'review_summary',
      inputRef: reviewId,
      userId,
      organizationId: review.organizationId || undefined,
      system: 'Summarize patient review feedback in one sentence. Do not add facts not in the review.',
      user: `Rating: ${review.rating}/5. Comment: ${review.comment}. Provider: ${review.organization?.name || 'N/A'}. Doctor: ${review.doctor?.fullName || 'N/A'}.`,
    });
    if (ai.fromAi) aiSummary = ai.text;
  }

  await prisma.review.update({
    where: { id: reviewId },
    data: { sentiment, topics, riskScore, aiSummary },
  });

  if (riskScore === 'HIGH') {
    const { notifyPlatformAdmins } = await import('../notifications/notification-service');
    await notifyPlatformAdmins(
      'Negative review flagged',
      `A ${review.rating}-star review was flagged for ${review.organization?.name || 'a provider'}. Manual review recommended.`,
      'review_alert'
    );
  }

  return { sentiment, topics, riskScore, aiSummary };
}
