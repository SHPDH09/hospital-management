#!/usr/bin/env node
/**
 * Run schema drift fix during Vercel builds when DATABASE_URL is available.
 * Skips gracefully when the database URL is not configured at build time.
 */
import { spawnSync } from 'child_process';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
const placeholder = /YOUR_|CHANGE_ME|placeholder/i;

if (!url || placeholder.test(url)) {
  console.log('[vercel-db-sync] DATABASE_URL not set at build time — skipping schema sync.');
  process.exit(0);
}

console.log('[vercel-db-sync] Applying schema drift fix...');
const result = spawnSync('npm', ['run', 'db:fix-drift', '--workspace=apps/api'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

if (result.status !== 0) {
  console.warn('[vercel-db-sync] Schema sync failed — continuing build. Run npm run db:fix-drift manually if needed.');
  process.exit(0);
}

console.log('[vercel-db-sync] Schema sync complete.');
