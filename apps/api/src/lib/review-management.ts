import { OrganizationType, ReviewSentiment, ReviewStatus, ReviewType, Prisma } from '@prisma/client';
import { prisma } from './prisma';

export interface ReviewListFilters {
  search?: string;
  status?: string;
  type?: string;
  source?: string;
  rating?: number;
  organizationId?: string;
  organizationType?: OrganizationType;
  doctorId?: string;
  patientId?: string;
  isVerifiedVisit?: boolean;
  reported?: boolean;
  sentiment?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function generateReviewNumber(): Promise<string> {
  const latest = await prisma.review.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { reviewNumber: true },
  });
  const lastNum = latest?.reviewNumber
    ? parseInt(latest.reviewNumber.replace(/\D/g, ''), 10) || 0
    : 0;
  return `REV-${String(lastNum + 1).padStart(5, '0')}`;
}

function detectSentiment(rating: number): ReviewSentiment {
  if (rating >= 4) return 'POSITIVE';
  if (rating === 3) return 'NEUTRAL';
  return 'NEGATIVE';
}

function detectRiskScore(review: { rating: number; comment?: string | null; reportCount: number }): string {
  if (review.reportCount >= 2) return 'HIGH';
  if (review.rating <= 2) return 'MEDIUM';
  const comment = review.comment || '';
  if (/http|www\.|spam|fake/i.test(comment)) return 'HIGH';
  if (comment.length > 500) return 'MEDIUM';
  return 'LOW';
}

export async function recalculateProviderRatings(organizationId?: string | null, doctorId?: string | null) {
  const approvedWhere = { status: 'APPROVED' as ReviewStatus, isPublished: true };

  if (organizationId) {
    const agg = await prisma.review.aggregate({
      where: { organizationId, ...approvedWhere },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        averageRating: agg._avg.rating || 0,
        reviewCount: agg._count,
      },
    });
  }

  if (doctorId) {
    const agg = await prisma.review.aggregate({
      where: { doctorId, ...approvedWhere },
      _avg: { rating: true },
      _count: true,
    });
    await prisma.doctor.update({
      where: { id: doctorId },
      data: {
        averageRating: agg._avg.rating || 0,
        reviewCount: agg._count,
      },
    });
  }
}

export async function getReviewManagementDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalReviews,
    reviewsToday,
    reviewsThisMonth,
    pendingModeration,
    approvedReviews,
    rejectedReviews,
    reportedReviews,
    hiddenReviews,
    fiveStar,
    fourStar,
    threeStar,
    twoStar,
    oneStar,
    verifiedReviews,
    flaggedReviews,
    avgRating,
    hospitalRating,
    clinicRating,
    doctorRating,
  ] = await Promise.all([
    prisma.review.count(),
    prisma.review.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
    prisma.review.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.review.count({ where: { status: { in: ['PENDING', 'UNDER_MODERATION', 'FLAGGED'] } } }),
    prisma.review.count({ where: { status: 'APPROVED' } }),
    prisma.review.count({ where: { status: 'REJECTED' } }),
    prisma.review.count({ where: { OR: [{ status: 'REPORTED' }, { reportCount: { gt: 0 } }] } }),
    prisma.review.count({ where: { status: 'HIDDEN' } }),
    prisma.review.count({ where: { rating: 5 } }),
    prisma.review.count({ where: { rating: 4 } }),
    prisma.review.count({ where: { rating: 3 } }),
    prisma.review.count({ where: { rating: 2 } }),
    prisma.review.count({ where: { rating: 1 } }),
    prisma.review.count({ where: { isVerifiedVisit: true } }),
    prisma.review.count({ where: { status: 'FLAGGED' } }),
    prisma.review.aggregate({ where: { status: 'APPROVED' }, _avg: { rating: true } }),
    prisma.review.aggregate({
      where: { status: 'APPROVED', organization: { type: 'HOSPITAL' } },
      _avg: { rating: true },
    }),
    prisma.review.aggregate({
      where: { status: 'APPROVED', organization: { type: 'CLINIC' } },
      _avg: { rating: true },
    }),
    prisma.review.aggregate({
      where: { status: 'APPROVED', doctorId: { not: null } },
      _avg: { rating: true },
    }),
  ]);

  const bySentiment = await prisma.review.groupBy({
    by: ['sentiment'],
    _count: true,
    where: { sentiment: { not: null } },
  });

  const byType = await prisma.review.groupBy({ by: ['type'], _count: true });

  const negativeAlerts = await prisma.review.findMany({
    where: { rating: { lte: 2 }, status: 'APPROVED', createdAt: { gte: monthStart } },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      organization: { select: { name: true } },
      patient: { select: { fullName: true } },
    },
  });

  return {
    totalReviews,
    reviewsToday,
    reviewsThisMonth,
    pendingModeration,
    approvedReviews,
    rejectedReviews,
    reportedReviews,
    hiddenReviews,
    fiveStarReviews: fiveStar,
    fourStarReviews: fourStar,
    threeStarReviews: threeStar,
    twoStarReviews: twoStar,
    oneStarReviews: oneStar,
    averagePlatformRating: avgRating._avg.rating || 0,
    hospitalRating: hospitalRating._avg.rating || 0,
    clinicRating: clinicRating._avg.rating || 0,
    doctorRating: doctorRating._avg.rating || 0,
    verifiedReviews,
    flaggedReviews,
    bySentiment: bySentiment.map((s) => ({ sentiment: s.sentiment, count: s._count })),
    byType: byType.map((t) => ({ type: t.type, count: t._count })),
    negativeAlerts,
    ratingBreakdown: { 5: fiveStar, 4: fourStar, 3: threeStar, 2: twoStar, 1: oneStar },
  };
}

export async function listReviews(filters: ReviewListFilters) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  const where: Prisma.ReviewWhereInput = {
    ...(filters.status && { status: filters.status as ReviewStatus }),
    ...(filters.type && { type: filters.type as ReviewType }),
    ...(filters.source && { source: filters.source as never }),
    ...(filters.rating && { rating: filters.rating }),
    ...(filters.organizationId && { organizationId: filters.organizationId }),
    ...(filters.organizationType && { organization: { type: filters.organizationType } }),
    ...(filters.doctorId && { doctorId: filters.doctorId }),
    ...(filters.patientId && { patientId: filters.patientId }),
    ...(filters.isVerifiedVisit !== undefined && { isVerifiedVisit: filters.isVerifiedVisit }),
    ...(filters.reported && { reportCount: { gt: 0 } }),
    ...(filters.sentiment && { sentiment: filters.sentiment as ReviewSentiment }),
    ...(filters.dateFrom || filters.dateTo) && {
      createdAt: {
        ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
        ...(filters.dateTo && { lte: new Date(`${filters.dateTo}T23:59:59`) }),
      },
    },
    ...(filters.search && {
      OR: [
        { reviewNumber: { contains: filters.search, mode: 'insensitive' } },
        { comment: { contains: filters.search, mode: 'insensitive' } },
        { patient: { fullName: { contains: filters.search, mode: 'insensitive' } } },
        { organization: { name: { contains: filters.search, mode: 'insensitive' } } },
        { doctor: { fullName: { contains: filters.search, mode: 'insensitive' } } },
      ],
    }),
  };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: { select: { id: true, fullName: true, globalPatientId: true } },
        organization: { select: { id: true, name: true, type: true, city: true } },
        doctor: { select: { id: true, fullName: true, specialization: true } },
        appointment: { select: { id: true, appointmentNumber: true } },
        service: { select: { id: true, name: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return { reviews, page, limit, total };
}

export async function getReviewOverview(reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      patient: { include: { user: { select: { email: true, phone: true } } } },
      organization: true,
      doctor: true,
      appointment: { include: { doctor: { select: { fullName: true } } } },
      service: true,
      moderatedBy: { select: { email: true } },
      reports: {
        orderBy: { createdAt: 'desc' },
        include: { reporter: { select: { email: true } } },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { email: true } } },
      },
    },
  });
  if (!review) return null;

  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: 'Review', entityId: reviewId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { email: true } } },
  });

  return { review, auditLogs };
}

export async function moderateReview(
  reviewId: string,
  status: ReviewStatus,
  actorUserId: string,
  reason?: string,
) {
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) throw new Error('Review not found');

  const isPublished = status === 'APPROVED' || status === 'RESTORED';

  const review = await prisma.review.update({
    where: { id: reviewId },
    data: {
      status,
      isPublished,
      moderationReason: reason,
      moderatedById: actorUserId,
      moderatedAt: new Date(),
    },
  });

  await prisma.reviewActivity.create({
    data: {
      reviewId,
      userId: actorUserId,
      action: `MODERATION_${status}`,
      oldStatus: existing.status,
      newStatus: status,
      notes: reason,
    },
  });

  if (['APPROVED', 'HIDDEN', 'REJECTED', 'REMOVED', 'RESTORED'].includes(status)) {
    await recalculateProviderRatings(review.organizationId, review.doctorId);
  }

  return review;
}

export async function addProviderResponse(reviewId: string, response: string, actorUserId: string) {
  const review = await prisma.review.update({
    where: { id: reviewId },
    data: {
      response,
      responseStatus: 'PUBLISHED',
      respondedAt: new Date(),
    },
  });

  await prisma.reviewActivity.create({
    data: {
      reviewId,
      userId: actorUserId,
      action: 'RESPONSE_ADDED',
      notes: response.slice(0, 200),
    },
  });

  return review;
}

export async function flagReview(reviewId: string, reason: string, actorUserId: string) {
  const existing = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!existing) throw new Error('Review not found');

  const review = await prisma.review.update({
    where: { id: reviewId },
    data: { status: 'FLAGGED', riskScore: 'HIGH', moderationReason: reason },
  });

  await prisma.reviewActivity.create({
    data: {
      reviewId,
      userId: actorUserId,
      action: 'FLAGGED',
      oldStatus: existing.status,
      newStatus: 'FLAGGED',
      notes: reason,
    },
  });

  return review;
}

export async function resolveReport(
  reportId: string,
  decision: string,
  actorUserId: string,
  reviewAction?: ReviewStatus,
) {
  const report = await prisma.reviewReport.update({
    where: { id: reportId },
    data: { status: 'RESOLVED', decision, resolvedAt: new Date() },
  });

  if (reviewAction) {
    await moderateReview(report.reviewId, reviewAction, actorUserId, `Report resolved: ${decision}`);
  }

  return report;
}

export async function detectFraudFlags() {
  const flags: { level: string; message: string; reviewId?: string }[] = [];

  const highRisk = await prisma.review.findMany({
    where: { riskScore: 'HIGH', status: { notIn: ['REJECTED', 'REMOVED'] } },
    take: 20,
    select: { id: true, reviewNumber: true, rating: true },
  });
  for (const r of highRisk) {
    flags.push({ level: 'red', message: `High risk review ${r.reviewNumber} (${r.rating}★)`, reviewId: r.id });
  }

  const reported = await prisma.review.findMany({
    where: { reportCount: { gt: 0 }, status: { notIn: ['HIDDEN', 'REMOVED', 'REJECTED'] } },
    take: 20,
    select: { id: true, reviewNumber: true, reportCount: true },
  });
  for (const r of reported) {
    flags.push({ level: 'orange', message: `Reported review ${r.reviewNumber} (${r.reportCount} reports)`, reviewId: r.id });
  }

  const unverifiedHigh = await prisma.review.findMany({
    where: { isVerifiedVisit: false, rating: 5, status: 'APPROVED' },
    take: 10,
    select: { id: true, reviewNumber: true },
  });
  for (const r of unverifiedHigh) {
    flags.push({ level: 'yellow', message: `Unverified 5★ review ${r.reviewNumber}`, reviewId: r.id });
  }

  return flags;
}

export function reviewsToCsv(reviews: Record<string, unknown>[]): string {
  const headers = ['Review ID', 'Patient', 'Provider', 'Doctor', 'Rating', 'Type', 'Status', 'Verified', 'Date'];
  const rows = reviews.map((r) => {
    const patient = r.patient as { fullName?: string } | undefined;
    const org = r.organization as { name?: string } | undefined;
    const doctor = r.doctor as { fullName?: string } | undefined;
    return [
      r.reviewNumber,
      patient?.fullName,
      org?.name,
      doctor?.fullName,
      r.rating,
      r.type,
      r.status,
      r.isVerifiedVisit ? 'Yes' : 'No',
      r.createdAt ? new Date(String(r.createdAt)).toISOString().slice(0, 10) : '',
    ].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

export { detectSentiment, detectRiskScore };
