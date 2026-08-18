import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient;
  prismaRead: PrismaClient | null;
};

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

/** Read-replica client for read-heavy queries (falls back to primary if not configured) */
export const prismaRead =
  globalForPrisma.prismaRead ||
  (process.env.DATABASE_URL_READ
    ? new PrismaClient({
        datasources: { db: { url: process.env.DATABASE_URL_READ } },
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      })
    : null);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaRead = prismaRead;
}

/** Use read replica for read-only queries when available */
export function readDb(): PrismaClient {
  return prismaRead || prisma;
}
