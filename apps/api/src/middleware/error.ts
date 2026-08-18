import { NextFunction, Request, Response } from 'express';
import { AppError, sendError } from '../lib/response';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  return sendError(res, 'Internal server error', 500);
}

export function notFoundHandler(_req: Request, res: Response) {
  return sendError(res, 'Route not found', 404);
}
