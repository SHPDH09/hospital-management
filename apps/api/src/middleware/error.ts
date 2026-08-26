import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, sendError } from '../lib/response';

function getErrorMessage(err: Error): string {
  if (err instanceof AppError) return err.message;

  if (err instanceof Prisma.PrismaClientInitializationError) {
    if (!process.env.DATABASE_URL) {
      return 'Database not configured. Set DATABASE_URL in Vercel environment variables.';
    }
    return 'Database connection failed. Check DATABASE_URL and RDS security group (allow port 5432).';
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2021') {
      return 'Database tables not found. Run: npm run db:setup';
    }
    if (err.code === 'P2022') {
      const column = (err.meta as { column?: string } | undefined)?.column;
      return column
        ? `Database column "${column}" is missing. From apps/api run: npm run db:sync`
        : 'Database schema is out of date. From apps/api run: npm run db:sync';
    }
    if (err.code === 'P1001' || err.code === 'P1000') {
      return 'Cannot reach database. Verify RDS credentials and network access from Vercel.';
    }
    return `Database error (${err.code})`;
  }

  const msg = err.message || '';
  if (msg.includes('DATABASE_URL is not configured') || msg.includes('Database not configured')) {
    return 'Database not configured. Set DATABASE_URL or DB_PASSWORD in Vercel environment variables.';
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT') || msg.includes('ENOTFOUND')) {
    return 'Cannot reach database. Verify RDS host and security group allows Vercel connections.';
  }
  if (msg.includes('password authentication failed')) {
    return 'Database authentication failed. Check the password in DATABASE_URL.';
  }
  if (msg.includes('no pg_hba.conf entry') || msg.includes('SSL')) {
    return 'Database SSL/network error. Use ?sslmode=require in DATABASE_URL.';
  }

  if (process.env.NODE_ENV !== 'production') {
    return err.message || 'Internal server error';
  }

  return 'Internal server error';
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[API Error]', err);

  const message = getErrorMessage(err);
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  return sendError(res, message, statusCode);
}

export function notFoundHandler(_req: Request, res: Response) {
  return sendError(res, 'Route not found', 404);
}
