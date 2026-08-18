import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { sendSuccess } from '../lib/response';

const router = Router();

router.get('/advertisements', async (req, res, next) => {
  try {
    const type = req.query.type as string | undefined;
    const ads = await prisma.advertisement.findMany({
      where: {
        status: 'ACTIVE',
        ...(type && { type: type as never }),
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    sendSuccess(res, ads);
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (_req, res, next) => {
  try {
    const [hospitals, clinics, doctors, patients] = await Promise.all([
      prisma.organization.count({ where: { type: 'HOSPITAL', verificationStatus: 'APPROVED', isPubliclyListed: true } }),
      prisma.organization.count({ where: { type: 'CLINIC', verificationStatus: 'APPROVED', isPubliclyListed: true } }),
      prisma.doctor.count({ where: { isActive: true, organization: { verificationStatus: 'APPROVED' } } }),
      prisma.patient.count(),
    ]);

    sendSuccess(res, { hospitals, clinics, doctors, patients });
  } catch (err) {
    next(err);
  }
});

export default router;
