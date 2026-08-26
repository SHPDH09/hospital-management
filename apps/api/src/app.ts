import './lib/env';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth';
import organizationRoutes from './routes/organizations';
import doctorRoutes from './routes/doctors';
import appointmentRoutes from './routes/appointments';
import patientRoutes from './routes/patients';
import patientProfileRoutes from './routes/patient-profile';
import billRoutes from './routes/bills';
import dashboardRoutes from './routes/dashboard';
import adminRoutes from './routes/admin/index';
import crmRoutes from './routes/crm';
import publicRoutes from './routes/public';
import webhookRoutes from './routes/webhooks';
import { errorHandler, notFoundHandler } from './middleware/error';
import { checkDatabaseConnection } from './lib/prisma';

const app = express();
const isVercel = process.env.VERCEL === '1';

app.set('trust proxy', 1);

function getAllowedOrigins(): string[] | boolean {
  const origins = [
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null,
  ].filter((o): o is string => Boolean(o));

  if (origins.length === 0) return true;
  return origins;
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: getAllowedOrigins(), credentials: true }));
if (!isVercel) {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
app.use(express.json({
  limit: '10mb',
  // Capture the raw body so payment webhooks can verify their signature.
  verify: (req, _res, buf) => { (req as { rawBody?: Buffer }).rawBody = buf; },
}));

if (!isVercel) {
  app.use(
    '/api/v1',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
}

app.get('/health', async (_req, res) => {
  try {
    await checkDatabaseConnection();
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      message: err instanceof Error ? err.message : 'Database unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/patients/me', patientProfileRoutes);
app.use('/api/v1/bills', billRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/crm', crmRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
