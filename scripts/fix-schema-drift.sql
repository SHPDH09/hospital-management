-- Fix for Prisma error P2022 ("column does not exist in the current database").
--
-- The deployed database may be missing columns/tables/enums that the current Prisma
-- schema (apps/api/prisma/schema.prisma) and API queries expect. This script adds
-- ONLY missing, additive schema elements. It is idempotent and non-destructive.
--
-- Apply with:
--   npm run db:fix-drift
-- or:
--   psql "<DATABASE_URL>" -f scripts/fix-schema-drift.sql
--
-- Then run `npm run db:push` to sync any remaining schema differences.

BEGIN;

-- ---------------------------------------------------------------------------
-- Enums (doctor schedule / verification)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "DoctorVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DoctorLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DoctorLeaveType" AS ENUM ('SICK', 'CASUAL', 'ANNUAL', 'EMERGENCY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- users: admin payment console PIN
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "paymentPinHash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "paymentPinSetAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- organizations: profile/detail fields
-- ---------------------------------------------------------------------------
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "aboutHospital" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "establishmentYear" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "galleryUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ---------------------------------------------------------------------------
-- branches: contact fields
-- ---------------------------------------------------------------------------
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "managerName" TEXT;

-- ---------------------------------------------------------------------------
-- departments: optional head-of-department reference
-- ---------------------------------------------------------------------------
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "headDoctorId" TEXT;

-- ---------------------------------------------------------------------------
-- doctors: verification status
-- ---------------------------------------------------------------------------
ALTER TABLE "doctors" ADD COLUMN IF NOT EXISTS "verificationStatus" "DoctorVerificationStatus" NOT NULL DEFAULT 'PENDING';
CREATE INDEX IF NOT EXISTS "doctors_verificationStatus_idx" ON "doctors"("verificationStatus");

-- ---------------------------------------------------------------------------
-- health_packages: CRM Health Packages module
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "health_packages" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "includedServices" TEXT[],
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "offerPrice" DOUBLE PRECISION NOT NULL,
    "validityDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "health_packages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "health_packages_organizationId_idx" ON "health_packages"("organizationId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'health_packages_organizationId_fkey') THEN
    ALTER TABLE "health_packages"
      ADD CONSTRAINT "health_packages_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'health_packages_branchId_fkey') THEN
    ALTER TABLE "health_packages"
      ADD CONSTRAINT "health_packages_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- doctor_weekly_schedules: weekly schedule builder
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "doctor_weekly_schedules" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doctor_weekly_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "doctor_weekly_schedules_doctorId_idx" ON "doctor_weekly_schedules"("doctorId");
CREATE UNIQUE INDEX IF NOT EXISTS "doctor_weekly_schedules_doctorId_dayOfWeek_startTime_key"
  ON "doctor_weekly_schedules"("doctorId", "dayOfWeek", "startTime");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_weekly_schedules_doctorId_fkey') THEN
    ALTER TABLE "doctor_weekly_schedules"
      ADD CONSTRAINT "doctor_weekly_schedules_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- doctor_leaves: leave management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "doctor_leaves" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "type" "DoctorLeaveType" NOT NULL DEFAULT 'CASUAL',
    "reason" TEXT,
    "status" "DoctorLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doctor_leaves_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "doctor_leaves_doctorId_startDate_endDate_idx"
  ON "doctor_leaves"("doctorId", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS "doctor_leaves_organizationId_idx" ON "doctor_leaves"("organizationId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doctor_leaves_doctorId_fkey') THEN
    ALTER TABLE "doctor_leaves"
      ADD CONSTRAINT "doctor_leaves_doctorId_fkey"
      FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- subscriptions: auto-renew preference (Cashfree renewal flow)
-- ---------------------------------------------------------------------------
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "autoRenew" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- subscription_payments: Cashfree renewal / payment transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "subscription_payments" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "planId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gateway" TEXT NOT NULL DEFAULT 'cashfree',
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "method" TEXT,
    "invoiceNumber" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "subscription_payments_gatewayOrderId_key"
  ON "subscription_payments"("gatewayOrderId");
CREATE INDEX IF NOT EXISTS "subscription_payments_organizationId_createdAt_idx"
  ON "subscription_payments"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "subscription_payments_subscriptionId_createdAt_idx"
  ON "subscription_payments"("subscriptionId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_payments_subscriptionId_fkey') THEN
    ALTER TABLE "subscription_payments"
      ADD CONSTRAINT "subscription_payments_subscriptionId_fkey"
      FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- doctors.verificationStatus: convert legacy TEXT column to enum (if needed)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'doctors'
      AND column_name = 'verificationStatus'
      AND udt_name = 'text'
  ) THEN
    UPDATE "doctors"
    SET "verificationStatus" = 'PENDING'
    WHERE "verificationStatus" IS NULL
       OR "verificationStatus" NOT IN ('PENDING', 'VERIFIED', 'REJECTED');

    ALTER TABLE "doctors" ALTER COLUMN "verificationStatus" DROP DEFAULT;
    ALTER TABLE "doctors"
      ALTER COLUMN "verificationStatus" TYPE "DoctorVerificationStatus"
      USING "verificationStatus"::"DoctorVerificationStatus";
    ALTER TABLE "doctors"
      ALTER COLUMN "verificationStatus" SET NOT NULL;
    ALTER TABLE "doctors"
      ALTER COLUMN "verificationStatus" SET DEFAULT 'PENDING'::"DoctorVerificationStatus";
  END IF;
END $$;

COMMIT;
