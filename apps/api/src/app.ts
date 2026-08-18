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
import billRoutes from './routes/bills';
import dashboardRoutes from './routes/dashboard';
import adminRoutes from './routes/admin';
import publicRoutes from './routes/public';
import { errorHandler, notFoundHandler } from './middleware/error';

const app = express();

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

app.use(helmet());
app.use(cors({ origin: getAllowedOrigins(), credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));

app.use(
  '/api/v1',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', organizationRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/bills', billRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/public', publicRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
