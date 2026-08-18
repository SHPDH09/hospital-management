import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

export type TransactionClient = Prisma.TransactionClient;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaRead: PrismaClient | undefined;
};

function poolOptions(connectionString: string): pg.PoolConfig {
  const isServerless = process.env.VERCEL === '1' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  const needsSsl =
    connectionString.includes('sslmode=require') ||
    connectionString.includes('rds.amazonaws.com') ||
    process.env.NODE_ENV === 'production';

  return {
    connectionString,
    max: isServerless ? 1 : 10,
    idleTimeoutMillis: isServerless ? 5000 : 30000,
    connectionTimeoutMillis: 10000,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

function createClient(url?: string): PrismaClient {
  const connectionString = url || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  const pool = new pg.Pool(poolOptions(connectionString));
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

function getPrismaRead(): PrismaClient | null {
  if (!process.env.DATABASE_URL_READ) return null;
  if (!globalForPrisma.prismaRead) {
    globalForPrisma.prismaRead = createClient(process.env.DATABASE_URL_READ);
  }
  return globalForPrisma.prismaRead;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});

export const prismaRead = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaRead();
    if (!client) {
      return Reflect.get(getPrisma(), prop, receiver);
    }
    return Reflect.get(client, prop, receiver);
  },
});

export function readDb(): PrismaClient {
  return getPrismaRead() || getPrisma();
}

export async function checkDatabaseConnection(): Promise<void> {
  await getPrisma().$queryRaw`SELECT 1`;
}
