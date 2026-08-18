import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverless from 'serverless-http';
import app from '../apps/api/dist/app';

const handler = serverless(app, {
  binary: false,
});

export default async function vercelHandler(req: VercelRequest, res: VercelResponse) {
  return handler(req, res);
}
