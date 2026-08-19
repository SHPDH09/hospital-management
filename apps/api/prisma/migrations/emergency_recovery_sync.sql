-- Emergency Control Center tables (recovery sync)

DO $$ BEGIN CREATE TYPE "EmergencySuspensionType" AS ENUM ('ORGANIZATION', 'DOCTOR', 'USER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "EmergencySuspensionReason" AS ENUM ('SECURITY_ISSUE', 'VERIFICATION_ISSUE', 'POLICY_VIOLATION', 'FRAUD_SUSPICION', 'TECHNICAL_ISSUE', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "EmergencyAnnouncementSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "emergency_action_logs" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "performedById" TEXT,
  "performedByEmail" TEXT,
  "reason" TEXT NOT NULL,
  "details" JSONB,
  "affectedScope" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "emergency_action_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "emergency_action_logs_createdAt_idx" ON "emergency_action_logs"("createdAt");

CREATE TABLE IF NOT EXISTS "emergency_announcements" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "severity" "EmergencyAnnouncementSeverity" NOT NULL DEFAULT 'WARNING',
  "affectedServices" TEXT[],
  "displayLocations" TEXT[],
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "emergency_announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "scheduled_maintenances" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "maintenanceType" TEXT NOT NULL DEFAULT 'full',
  "affectedModules" TEXT[],
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "autoActivate" BOOLEAN NOT NULL DEFAULT true,
  "createdByEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scheduled_maintenances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "scheduled_maintenances_startAt_endAt_idx" ON "scheduled_maintenances"("startAt", "endAt");

CREATE TABLE IF NOT EXISTS "emergency_suspensions" (
  "id" TEXT NOT NULL,
  "type" "EmergencySuspensionType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "targetName" TEXT,
  "reason" "EmergencySuspensionReason" NOT NULL,
  "reasonNotes" TEXT,
  "effects" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "suspendedById" TEXT,
  "suspendedByEmail" TEXT,
  "suspendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "liftedAt" TIMESTAMP(3),
  "liftedByEmail" TEXT,
  "appointmentResolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "emergency_suspensions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "emergency_suspensions_type_targetId_isActive_idx" ON "emergency_suspensions"("type", "targetId", "isActive");
