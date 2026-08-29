import { prisma } from './prisma';

let schemaEnsured = false;
let ensurePromise: Promise<void> | null = null;

/** Apply idempotent schema patches required by newer API code on older production DBs. */
export async function ensureSchemaPatches(): Promise<void> {
  if (schemaEnsured) return;
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    try {
      await prisma.$executeRawUnsafe(`
        DO $$ BEGIN
          CREATE TYPE "PatientSource" AS ENUM ('CRM', 'PUBLIC');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "patient_organizations"
        ADD COLUMN IF NOT EXISTS "source" "PatientSource" NOT NULL DEFAULT 'PUBLIC';
      `);
      schemaEnsured = true;
    } catch (err) {
      console.warn('[ensure-schema] Could not apply patient source patch:', err);
    } finally {
      ensurePromise = null;
    }
  })();

  return ensurePromise;
}
