import { ApprovalStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export async function listApprovalRequests(options: {
  status?: ApprovalStatus;
  page?: number;
  limit?: number;
}) {
  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;
  const where = options.status ? { status: options.status } : {};

  const [requests, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        requester: { select: { id: true, email: true, role: true } },
      },
    }),
    prisma.approvalRequest.count({ where }),
  ]);

  return { requests, page, limit, total };
}

export async function createApprovalRequest(params: {
  requesterId: string;
  actionType: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}) {
  return prisma.approvalRequest.create({
    data: {
      requesterId: params.requesterId,
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: (params.payload || {}) as object,
    },
  });
}

export async function reviewApprovalRequest(
  id: string,
  reviewerId: string,
  decision: 'APPROVED' | 'REJECTED',
  notes?: string
) {
  const request = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!request) throw new Error('Approval request not found');
  if (request.status !== 'PENDING') throw new Error('Request already reviewed');

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: decision,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      notes,
    },
  });

  if (decision === 'APPROVED' && request.actionType === 'verify_organization') {
    await prisma.organization.update({
      where: { id: request.entityId },
      data: { verificationStatus: 'APPROVED', isPubliclyListed: true },
    });
  }

  if (decision === 'REJECTED' && request.actionType === 'verify_organization') {
    await prisma.organization.update({
      where: { id: request.entityId },
      data: { verificationStatus: 'REJECTED' },
    });
  }

  return updated;
}

export async function getPendingApprovalCount() {
  return prisma.approvalRequest.count({ where: { status: 'PENDING' } });
}
