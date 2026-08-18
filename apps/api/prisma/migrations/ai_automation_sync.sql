-- AI & Automation schema sync for existing production databases

-- Enums
DO $$ BEGIN CREATE TYPE "LeadTemperature" AS ENUM ('HOT', 'WARM', 'COLD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "NoShowRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ReviewSentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AutomationModule" AS ENUM ('LEADS', 'APPOINTMENTS', 'PAYMENTS', 'REVIEWS', 'COMPLAINTS', 'SUBSCRIPTIONS', 'VERIFICATION', 'GENERAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Lead extensions
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "score" INTEGER DEFAULT 0;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "temperature" TEXT DEFAULT 'COLD';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "nextBestAction" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lastScoredAt" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "specialty" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lastContactAt" TIMESTAMP(3);

-- Appointment extensions
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "noShowRisk" TEXT DEFAULT 'LOW';
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "confirmationStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);

-- Review extensions
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "sentiment" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "topics" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "riskScore" TEXT DEFAULT 'LOW';
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;

-- Complaint extensions
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiCategory" TEXT;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiPriority" TEXT;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;
ALTER TABLE "complaints" ADD COLUMN IF NOT EXISTS "suggestedResponse" TEXT;

-- Patient extensions
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "profileCompleted" BOOLEAN DEFAULT false;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "profileCompletionPercent" INTEGER DEFAULT 0;

-- New tables
CREATE TABLE IF NOT EXISTS "ai_settings" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_settings_key_key" ON "ai_settings"("key");

CREATE TABLE IF NOT EXISTS "ai_audit_logs" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "userId" TEXT,
  "organizationId" TEXT,
  "module" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "inputRef" TEXT,
  "outputSummary" TEXT,
  "model" TEXT,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "humanApproval" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_audit_logs_requestId_key" ON "ai_audit_logs"("requestId");

CREATE TABLE IF NOT EXISTS "ai_insights" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "insightType" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_insights_entityType_entityId_insightType_key" ON "ai_insights"("entityType", "entityId", "insightType");

CREATE TABLE IF NOT EXISTS "automation_rules" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "module" TEXT NOT NULL DEFAULT 'GENERAL',
  "trigger" TEXT NOT NULL,
  "conditions" JSONB NOT NULL DEFAULT '[]',
  "actions" JSONB NOT NULL DEFAULT '[]',
  "delayMinutes" INTEGER NOT NULL DEFAULT 0,
  "schedule" TEXT,
  "channel" TEXT,
  "audience" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "automation_executions" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "status" TEXT NOT NULL,
  "result" JSONB,
  "error" TEXT,
  "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "job_queue" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "lastError" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "job_queue_status_scheduledAt_idx" ON "job_queue"("status", "scheduledAt");

CREATE TABLE IF NOT EXISTS "lead_activities" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "payload" JSONB,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);
