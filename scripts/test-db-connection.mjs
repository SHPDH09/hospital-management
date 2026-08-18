#!/usr/bin/env node
/**
 * Test Aurora/RDS connection.
 * Usage: node scripts/test-db-connection.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../apps/api/.env');

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const url = process.env.DATABASE_URL;
if (!url || url.includes('YOUR_')) {
  console.error('FAIL: Set DATABASE_URL in apps/api/.env with your real RDS password.');
  console.error('  cp .env.rds.example apps/api/.env && nano apps/api/.env');
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  const result = await prisma.$queryRaw`SELECT current_database() as db, current_user as user, version() as version`;
  const row = result[0];
  console.log('OK — Connected to Aurora PostgreSQL');
  console.log('  Database:', row.db);
  console.log('  User:', row.user);
  console.log('  Version:', String(row.version).split(' ').slice(0, 2).join(' '));
} catch (err) {
  console.error('FAIL:', err.message);
  if (String(err.message).includes('Authentication') || String(err.message).includes('password')) {
    console.error('  → Check password in apps/api/.env');
  }
  if (String(err.message).includes('timeout') || String(err.message).includes('Can\'t reach')) {
    console.error('  → RDS security group: allow port 5432 from EC2');
  }
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
