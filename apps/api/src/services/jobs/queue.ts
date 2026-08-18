import { JobStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type JobType =
  | 'appointment_reminder'
  | 'lead_score'
  | 'review_sentiment'
  | 'complaint_classify'
  | 'automation_execute'
  | 'appointment_risk_scan';

export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  scheduledAt: Date = new Date()
) {
  return prisma.jobQueue.create({
    data: {
      type,
      payload: payload as Prisma.InputJsonValue,
      scheduledAt,
    },
  });
}

export async function processJobBatch(limit = 20, workerId = 'worker-1') {
  const now = new Date();
  const jobs = await prisma.jobQueue.findMany({
    where: {
      status: 'PENDING',
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
  });

  const results: { id: string; status: JobStatus; error?: string }[] = [];

  for (const job of jobs) {
    const locked = await prisma.jobQueue.updateMany({
      where: { id: job.id, status: 'PENDING' },
      data: { status: 'PROCESSING', lockedAt: now, lockedBy: workerId },
    });
    if (locked.count === 0) continue;

    try {
      await handleJob(job.type, job.payload as Record<string, unknown>);
      await prisma.jobQueue.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', completedAt: new Date(), lastError: null },
      });
      results.push({ id: job.id, status: 'COMPLETED' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Job failed';
      const attempts = job.attempts + 1;
      const isDead = attempts >= job.maxAttempts;
      const retryDelay = Math.min(3600000, 60000 * Math.pow(2, attempts));

      await prisma.jobQueue.update({
        where: { id: job.id },
        data: {
          status: isDead ? 'DEAD' : 'PENDING',
          attempts,
          lastError: message,
          lockedAt: null,
          lockedBy: null,
          scheduledAt: isDead ? job.scheduledAt : new Date(Date.now() + retryDelay),
        },
      });
      results.push({ id: job.id, status: isDead ? 'DEAD' : 'PENDING', error: message });
    }
  }

  return results;
}

async function handleJob(type: string, payload: Record<string, unknown>) {
  switch (type) {
    case 'appointment_reminder': {
      const { handleAppointmentReminder } = await import('../appointments/reminder-service');
      await handleAppointmentReminder(payload.appointmentId as string, payload.reminderType as string);
      break;
    }
    case 'lead_score': {
      const { scoreLead } = await import('../leads/lead-scoring');
      await scoreLead(payload.leadId as string);
      break;
    }
    case 'review_sentiment': {
      const { analyzeReview } = await import('../reviews/review-analysis');
      await analyzeReview(payload.reviewId as string);
      break;
    }
    case 'complaint_classify': {
      const { classifyComplaint } = await import('../support/ticket-classifier');
      await classifyComplaint(payload.complaintId as string);
      break;
    }
    case 'automation_execute': {
      const { executeAutomationAction } = await import('../automation/executor');
      await executeAutomationAction(payload);
      break;
    }
    case 'appointment_risk_scan': {
      const { calculateNoShowRisk } = await import('../appointments/no-show-risk');
      if (payload.appointmentId) {
        await calculateNoShowRisk(payload.appointmentId as string);
      }
      break;
    }
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}

export async function getJobStats() {
  const [pending, processing, completed, failed, dead] = await Promise.all([
    prisma.jobQueue.count({ where: { status: 'PENDING' } }),
    prisma.jobQueue.count({ where: { status: 'PROCESSING' } }),
    prisma.jobQueue.count({ where: { status: 'COMPLETED' } }),
    prisma.jobQueue.count({ where: { status: 'FAILED' } }),
    prisma.jobQueue.count({ where: { status: 'DEAD' } }),
  ]);
  return { pending, processing, completed, failed, dead };
}
