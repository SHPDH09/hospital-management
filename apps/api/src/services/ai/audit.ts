import { prisma } from '../../lib/prisma';
import { redactSensitive } from './safety';

export interface LogAiOperationInput {
  userId?: string;
  organizationId?: string;
  module: string;
  feature: string;
  inputRef?: string;
  outputSummary?: string;
  model?: string;
  status: 'success' | 'error' | 'skipped';
  error?: string;
  humanApproval?: boolean;
}

export async function logAiOperation(input: LogAiOperationInput) {
  return prisma.aiAuditLog.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      module: input.module,
      feature: input.feature,
      inputRef: input.inputRef,
      outputSummary: input.outputSummary ? redactSensitive(input.outputSummary).slice(0, 4000) : undefined,
      model: input.model,
      status: input.status,
      error: input.error,
      humanApproval: input.humanApproval ?? false,
    },
  });
}
