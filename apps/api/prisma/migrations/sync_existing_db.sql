-- Safe incremental schema sync for existing production databases
-- Adds missing columns with defaults and backfills required unique fields

-- Patient extensions
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "globalPatientId" TEXT;
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "accountStatus" TEXT DEFAULT 'ACTIVE';
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "registrationSource" TEXT DEFAULT 'DIRECT';
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;

DO $$
DECLARE r RECORD; i INT := 1;
BEGIN
  FOR r IN SELECT id FROM patients WHERE "globalPatientId" IS NULL ORDER BY "createdAt" LOOP
    UPDATE patients SET "globalPatientId" = 'PAT-' || LPAD(i::text, 8, '0') WHERE id = r.id;
    i := i + 1;
  END LOOP;
END $$;

UPDATE patients SET "photoUrl" = "profilePhoto" WHERE "photoUrl" IS NULL AND "profilePhoto" IS NOT NULL;

-- Create enums if missing (ignore errors via DO blocks)
DO $$ BEGIN CREATE TYPE "PatientAccountStatus" AS ENUM ('ACTIVE', 'PENDING_PROFILE', 'UNVERIFIED', 'SUSPENDED', 'BLOCKED', 'DEACTIVATED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PatientRegistrationSource" AS ENUM ('DIRECT', 'REFERRAL', 'AASHA', 'ADVERTISEMENT', 'GOOGLE', 'WEBSITE', 'CAMPAIGN', 'DOCTOR_REFERRAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Appointment extensions
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "appointmentNumber" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "referralSource" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "referralId" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "referralName" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "advertisementId" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "rescheduledFromId" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "checkedInAt" TIMESTAMP(3);
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "tokenNumber" TEXT;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "isEmergency" BOOLEAN DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "isOnline" BOOLEAN DEFAULT false;

DO $$
DECLARE r RECORD; i INT := 1;
BEGIN
  FOR r IN SELECT id FROM appointments WHERE "appointmentNumber" IS NULL ORDER BY "createdAt" LOOP
    UPDATE appointments SET "appointmentNumber" = 'APT-' || LPAD(i::text, 5, '0') WHERE id = r.id;
    i := i + 1;
  END LOOP;
END $$;

-- Doctor extensions
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT DEFAULT 'PENDING';
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "accountActivated" BOOLEAN DEFAULT false;

-- Payment extensions
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paymentNumber" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "purpose" TEXT DEFAULT 'APPOINTMENT';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'INR';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gateway" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gatewayOrderId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "gatewayPaymentId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "platformFee" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "providerShare" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refundAmount" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refundReason" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refundId" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "webhookStatus" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "webhookVerified" BOOLEAN DEFAULT false;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "riskLevel" TEXT DEFAULT 'LOW';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reconciliationStatus" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "capturedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3);
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

DO $$
DECLARE r RECORD; i INT := 1;
BEGIN
  FOR r IN SELECT id FROM payments WHERE "paymentNumber" IS NULL ORDER BY "createdAt" LOOP
    UPDATE payments SET "paymentNumber" = 'PAY-' || LPAD(i::text, 5, '0') WHERE id = r.id;
    i := i + 1;
  END LOOP;
END $$;

-- Lead extensions
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "leadNumber" TEXT;
ALTER TABLE "leads" ALTER COLUMN "organizationId" DROP NOT NULL;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'PATIENT';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "campaign" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "referralName" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "referralType" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "specialty" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "service" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "preferredDate" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "preferredTime" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'MEDIUM';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "temperature" TEXT DEFAULT 'COLD';
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "score" INTEGER DEFAULT 0;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "interestedDoctorId" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "patientId" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN DEFAULT false;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN DEFAULT false;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "nextFollowUpAt" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lastContactAt" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lostReason" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "isDuplicate" BOOLEAN DEFAULT false;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "mergedIntoId" TEXT;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

DO $$
DECLARE r RECORD; i INT := 1;
BEGIN
  FOR r IN SELECT id FROM leads WHERE "leadNumber" IS NULL ORDER BY "createdAt" LOOP
    UPDATE leads SET "leadNumber" = 'LD-' || LPAD(i::text, 5, '0') WHERE id = r.id;
    i := i + 1;
  END LOOP;
END $$;

-- Review extensions
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reviewNumber" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT 'HOSPITAL';
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'PLATFORM';
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "doctorRating" INTEGER;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "staffRating" INTEGER;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "cleanlinessRating" INTEGER;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "waitingRating" INTEGER;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "facilitiesRating" INTEGER;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "originalComment" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "responseStatus" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'PENDING';
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "isVerifiedVisit" BOOLEAN DEFAULT false;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "isAnonymous" BOOLEAN DEFAULT false;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "reportCount" INTEGER DEFAULT 0;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "helpfulCount" INTEGER DEFAULT 0;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "riskScore" TEXT DEFAULT 'LOW';
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "sentiment" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "moderationReason" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "moderatedById" TEXT;
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP(3);
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "reviews" ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3);

UPDATE reviews SET "status" = 'APPROVED' WHERE "isPublished" = true AND ("status" IS NULL OR "status" = 'PENDING');
UPDATE reviews SET "status" = 'PENDING' WHERE "status" IS NULL;

DO $$
DECLARE r RECORD; i INT := 1;
BEGIN
  FOR r IN SELECT id FROM reviews WHERE "reviewNumber" IS NULL ORDER BY "createdAt" LOOP
    UPDATE reviews SET "reviewNumber" = 'REV-' || LPAD(i::text, 5, '0') WHERE id = r.id;
    i := i + 1;
  END LOOP;
END $$;

-- New tables (IF NOT EXISTS via raw SQL)
CREATE TABLE IF NOT EXISTS "lead_activities" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "oldStatus" TEXT,
  "newStatus" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "lead_follow_ups" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "assignedToId" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_follow_ups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "review_reports" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "reporterId" TEXT,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decision" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "review_activities" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "oldStatus" TEXT,
  "newStatus" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "review_activities_pkey" PRIMARY KEY ("id")
);

-- Unique constraints (add only if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "patients_globalPatientId_key" ON "patients"("globalPatientId");
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_appointmentNumber_key" ON "appointments"("appointmentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_paymentNumber_key" ON "payments"("paymentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "leads_leadNumber_key" ON "leads"("leadNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "reviews_reviewNumber_key" ON "reviews"("reviewNumber");
