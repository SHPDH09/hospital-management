-- PRD feature recovery: auth, support, communications, CMS, platform staff, permissions
-- Safe to run multiple times (uses IF NOT EXISTS / conditional alters where possible)

-- User auth extensions
ALTER TABLE users ADD COLUMN IF NOT EXISTS "authProvider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE users ADD COLUMN IF NOT EXISTS "googleId" TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS "profilePhotoUrl" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key ON users("googleId") WHERE "googleId" IS NOT NULL;

-- Patient profile completion
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "profilePhoto" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "pinCode" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "alternatePhone" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "emergencyContactRelation" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "profileCompletionStep" TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" TIMESTAMP(3);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "healthConsentAt" TIMESTAMP(3);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "profileCompletedAt" TIMESTAMP(3);

-- Complaint status extensions
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_USER';
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'ESCALATED';
ALTER TYPE "ComplaintStatus" ADD VALUE IF NOT EXISTS 'REOPENED';
ALTER TYPE "ComplaintPriority" ADD VALUE IF NOT EXISTS 'CRITICAL';

DO $$ BEGIN
  CREATE TYPE "TicketKind" AS ENUM ('SUPPORT_REQUEST', 'COMPLAINT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ComplainantType" AS ENUM ('PATIENT', 'HOSPITAL', 'DOCTOR', 'PLATFORM_STAFF', 'GUEST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP', 'PUSH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CommunicationStatus" AS ENUM ('PENDING', 'SCHEDULED', 'SENT', 'DELIVERED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AnnouncementType" AS ENUM ('INFORMATION', 'WARNING', 'MAINTENANCE', 'EMERGENCY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CmsContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CmsPageType" AS ENUM ('STATIC', 'LEGAL', 'LOCATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PlatformStaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PlatformRoleType" AS ENUM ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'DEPARTMENT_MANAGER', 'PLATFORM_STAFF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OrganizationScope" AS ENUM ('ALL_ORGANIZATIONS', 'ASSIGNED_ORGANIZATIONS', 'OWN_DEPARTMENT', 'OWN_RECORDS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PermissionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PlatformTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PlatformTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Complaints / support ticket columns
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS kind "TicketKind" NOT NULL DEFAULT 'SUPPORT_REQUEST';
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "complainantType" "ComplainantType" NOT NULL DEFAULT 'GUEST';
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "escalatedTo" TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "slaResponseDue" TIMESTAMP(3);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "slaResolutionDue" TIMESTAMP(3);
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "csatRating" INTEGER;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "csatFeedback" TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "reopenReason" TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- Communication templates
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE communication_templates ADD COLUMN IF NOT EXISTS variables TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE communication_templates ALTER COLUMN channel TYPE "CommunicationChannel" USING channel::"CommunicationChannel";

-- Platform departments
ALTER TABLE platform_departments ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CMS pages extended columns
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS "pageType" "CmsPageType" NOT NULL DEFAULT 'STATIC';
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS status "CmsContentStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS "metaTitle" TEXT;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS "metaDescription" TEXT;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS keywords TEXT;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS "ogTitle" TEXT;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS "ogDescription" TEXT;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS "ogImageUrl" TEXT;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS robots TEXT DEFAULT 'index,follow';
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3);
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS "unpublishAt" TIMESTAMP(3);
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cms_pages ADD COLUMN IF NOT EXISTS "authorEmail" TEXT;

-- New tables (Prisma will create on migrate; this script covers manual prod sync)
-- Run `npx prisma db push` or apply generated migration for full table creation.
