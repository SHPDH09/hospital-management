import 'dotenv/config';
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
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));
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

app.listen(PORT, () => {
  console.log(`Healthcare API running on http://localhost:${PORT}`);
});
