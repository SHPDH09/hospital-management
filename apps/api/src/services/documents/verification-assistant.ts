import { prisma } from '../../lib/prisma';
import { aiComplete, isAiFeatureEnabled } from '../ai';
import { createApprovalRequest } from '../approvals/approval-service';

const REQUIRED_DOC_PATTERNS = [
  { type: 'registration', keywords: ['registration', 'license', 'certificate', 'reg'] },
  { type: 'identity', keywords: ['pan', 'gst', 'aadhaar', 'id', 'identity'] },
  { type: 'address', keywords: ['address', 'utility', 'proof'] },
];

function inferDocType(fileName: string): string {
  const lower = fileName.toLowerCase();
  for (const pattern of REQUIRED_DOC_PATTERNS) {
    if (pattern.keywords.some((kw) => lower.includes(kw))) return pattern.type;
  }
  return 'other';
}

export async function analyzeOrganizationVerification(organizationId: string, requesterId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { documents: true },
  });
  if (!org) throw new Error('Organization not found');

  const docAnalysis = org.documents.map((doc) => ({
    id: doc.id,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    inferredType: inferDocType(doc.fileName),
    fileSize: doc.fileSize,
  }));

  const foundTypes = new Set(docAnalysis.map((d) => d.inferredType));
  const missingTypes = REQUIRED_DOC_PATTERNS
    .map((p) => p.type)
    .filter((t) => !foundTypes.has(t));

  const profileChecks = {
    hasName: Boolean(org.name),
    hasRegistrationNumber: Boolean(org.registrationNumber),
    hasAddress: Boolean(org.address && org.city),
    hasContact: Boolean(org.email || org.phone),
    documentCount: org.documents.length,
  };

  const completenessScore = Math.round(
    ([profileChecks.hasName, profileChecks.hasRegistrationNumber, profileChecks.hasAddress,
      profileChecks.hasContact, org.documents.length >= 2, missingTypes.length === 0]
      .filter(Boolean).length / 6) * 100
  );

  let aiSummary: string | null = null;
  let recommendation = completenessScore >= 80 && missingTypes.length === 0
    ? 'RECOMMEND_APPROVE'
    : completenessScore >= 50
      ? 'NEEDS_REVIEW'
      : 'INCOMPLETE';

  if (await isAiFeatureEnabled('documentVerification')) {
    const ai = await aiComplete({
      module: 'verification',
      feature: 'document_assistant',
      userId: requesterId,
      organizationId,
      inputRef: organizationId,
      system: `You are a healthcare platform verification assistant. Analyze organization registration data and uploaded documents metadata. Never approve automatically — always recommend human review. Output JSON with keys: summary (string), recommendation (RECOMMEND_APPROVE|NEEDS_REVIEW|INCOMPLETE), flags (string[]).`,
      user: `Organization: ${org.name} (${org.type})
Registration #: ${org.registrationNumber || 'missing'}
Address: ${org.address || 'missing'}, ${org.city || ''}
Documents (${org.documents.length}): ${docAnalysis.map((d) => `${d.fileName} [${d.inferredType}]`).join(', ') || 'none'}
Missing doc types: ${missingTypes.join(', ') || 'none'}
Completeness score: ${completenessScore}%`,
    });

    if (ai.fromAi && ai.text) {
      try {
        const parsed = JSON.parse(ai.text.replace(/```json\n?|\n?```/g, ''));
        aiSummary = parsed.summary || ai.text;
        if (parsed.recommendation) recommendation = parsed.recommendation;
      } catch {
        aiSummary = ai.text;
      }
    }
  }

  if (!aiSummary) {
    aiSummary = `${org.name}: ${completenessScore}% complete. ${org.documents.length} document(s) uploaded. ${
      missingTypes.length ? `Missing: ${missingTypes.join(', ')}.` : 'All expected document types present.'
    } Human approval required before verification.`;
  }

  const approval = await createApprovalRequest({
    requesterId,
    actionType: 'verify_organization',
    entityType: 'Organization',
    entityId: organizationId,
    payload: {
      completenessScore,
      recommendation,
      missingTypes,
      docAnalysis,
      profileChecks,
      aiSummary,
    },
  });

  return {
    organizationId,
    organizationName: org.name,
    completenessScore,
    recommendation,
    missingTypes,
    documents: docAnalysis,
    profileChecks,
    aiSummary,
    approvalRequestId: approval.id,
    requiresHumanApproval: true,
  };
}
