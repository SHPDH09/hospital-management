#!/usr/bin/env node
/**
 * Builds DATABASE_URL / DATABASE_URL_READ from DB_* env vars when placeholders are set.
 * Usage: node scripts/ensure-database-url.mjs && prisma migrate dev
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');

const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME || 'healthcare_platform';
const DB_HOST = process.env.DB_HOST || 'database-1.cluster-covwo0uikrnc.us-east-1.rds.amazonaws.com';
const DB_HOST_READ = process.env.DB_HOST_READ || 'database-1.cluster-ro-covwo0uikrnc.us-east-1.rds.amazonaws.com';
const DB_PORT = process.env.DB_PORT || '5432';

function buildUrl(host) {
  const encoded = encodeURIComponent(DB_PASSWORD);
  return `postgresql://${DB_USER}:${encoded}@${host}:${DB_PORT}/${DB_NAME}?schema=public&sslmode=require`;
}

if (!DB_PASSWORD) {
  if (!existsSync(envPath)) {
    console.error('Missing DB_PASSWORD and no .env file found.');
    process.exit(1);
  }
  const env = readFileSync(envPath, 'utf8');
  if (env.includes('YOUR_PASSWORD')) {
    console.error('Set DB_PASSWORD (and optionally DB_USER, DB_NAME) as environment secrets, or update apps/api/.env with real credentials.');
    process.exit(1);
  }
  process.exit(0);
}

const writerUrl = buildUrl(DB_HOST);
const readerUrl = buildUrl(DB_HOST_READ);

process.env.DATABASE_URL = writerUrl;
process.env.DATABASE_URL_READ = readerUrl;

if (existsSync(envPath)) {
  let env = readFileSync(envPath, 'utf8');
  env = env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${writerUrl}"`);
  if (/^DATABASE_URL_READ=/m.test(env)) {
    env = env.replace(/^DATABASE_URL_READ=.*$/m, `DATABASE_URL_READ="${readerUrl}"`);
  } else {
    env += `\nDATABASE_URL_READ="${readerUrl}"\n`;
  }
  writeFileSync(envPath, env);
  console.log('Updated apps/api/.env with RDS credentials from environment secrets.');
}

console.log(`DATABASE_URL -> ${DB_HOST}`);
