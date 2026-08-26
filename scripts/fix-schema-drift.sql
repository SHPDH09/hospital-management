-- Fix for Prisma error P2022 ("column does not exist in the current database").
--
-- The deployed database was missing several columns and one table that the
-- current Prisma schema (apps/api/prisma/schema.prisma) — and therefore the API
-- queries — expect. This script adds ONLY the missing, additive schema elements.
-- It is idempotent (safe to run more than once) and non-destructive: it never
-- drops columns, tables, or data.
--
-- Apply with:
--   psql "<DATABASE_URL>" -f scripts/fix-schema-drift.sql
-- (or `npm run db:push` from apps/api, which syncs the full schema for a
--  database that is not otherwise diverged.)

BEGIN;

-- organizations: profile/detail fields queried by public + CRM pages
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "aboutHospital" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "establishmentYear" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "galleryUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- branches: contact fields queried by CRM branch management
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "managerName" TEXT;

-- departments: optional head-of-department reference
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "headDoctorId" TEXT;

-- health_packages: table backing the CRM Health Packages module
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

COMMIT;
