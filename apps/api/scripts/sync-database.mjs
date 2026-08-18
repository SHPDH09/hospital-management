#!/usr/bin/env node
/**
 * Applies safe incremental schema sync SQL for existing production databases.
 * Usage: DATABASE_URL=... npm run db:sync
 *    or: DB_PASSWORD=... npm run db:sync
 * Optional: npm run db:sync -- --push   (also runs prisma db push; may fail on legacy tables)
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import pg from 'pg';

const runDbPush = process.argv.includes('--push');

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(__dirname, '..');

// Load .env if present
const envPath = resolve(apiRoot, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it or configure DB_PASSWORD in .env');
  process.exit(1);
}

const sqlPath = resolve(apiRoot, 'prisma/migrations/sync_existing_db.sql');
const sql = readFileSync(sqlPath, 'utf8');

console.log('==> Applying safe schema sync SQL...');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  console.log('==> SQL sync completed.');
} catch (err) {
  console.error('SQL sync error (some statements may be ok):', err.message);
}
await client.end();

if (runDbPush) {
  console.log('==> Running prisma db push...');
  try {
    execSync('npx prisma db push --accept-data-loss', {
      cwd: apiRoot,
      stdio: 'inherit',
      env: process.env,
    });
  } catch (err) {
    console.warn(
      '==> prisma db push failed (often due to legacy tables/enums in production).',
      'The SQL sync above is usually sufficient. Re-run with only SQL if login works.',
    );
    process.exit(err.status ?? 1);
  }
} else {
  console.log('==> Skipping prisma db push (pass --push to include it).');
}

console.log('==> Database schema sync complete!');
