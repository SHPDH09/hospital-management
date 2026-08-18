import { Response } from 'express';
import { ApiResponse } from '@healthcare/shared';

export function sendSuccess<T>(res: Response, data: T, message?: string, status = 200) {
  const body: ApiResponse<T> = { success: true, data, message };
  return res.status(status).json(body);
}

export function sendError(res: Response, error: string, status = 400) {
  const body: ApiResponse = { success: false, error };
  return res.status(status).json(body);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: { page: number; limit: number; total: number }
) {
  const body: ApiResponse<T[]> = {
    success: true,
    data,
    meta: {
      ...meta,
      totalPages: Math.ceil(meta.total / meta.limit),
    },
  };
  return res.json(body);
}

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}
