import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { sendSuccess, AppError } from '../../lib/response';
import { validateBody } from '../../middleware/validate';
import { emitAutomationEvent } from '../../services/automation/engine';

const router = Router();

router.post('/capture', validateBody(z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  source: z.string().optional(),
  type: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  campaign: z.string().optional(),
  referralName: z.string().optional(),
  referralType: z.string().optional(),
  specialty: z.string().optional(),
  service: z.string().optional(),
  notes: z.string().optional(),
  advertisementId: z.string().uuid().optional(),
})), async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.body.organizationId } });
    if (!org) throw new AppError('Organization not found', 404);

    const count = await prisma.lead.count();
    const lead = await prisma.lead.create({
      data: {
        organizationId: req.body.organizationId,
        leadNumber: `LD-${String(count + 1).padStart(6, '0')}`,
        name: req.body.name,
        email: req.body.email,
        phone: req.body.phone,
        source: req.body.source || 'WEBSITE',
        type: req.body.type || 'PATIENT',
        city: req.body.city,
        state: req.body.state,
        campaign: req.body.campaign,
        referralName: req.body.referralName,
        referralType: req.body.referralType,
        specialty: req.body.specialty,
        service: req.body.service,
        notes: req.body.notes,
        advertisementId: req.body.advertisementId,
        status: 'NEW',
        temperature: 'WARM',
      },
    });

    await emitAutomationEvent('lead.created', 'lead', lead.id, {
      organizationId: lead.organizationId,
      temperature: lead.temperature,
    });
    sendSuccess(res, { id: lead.id, leadNumber: lead.leadNumber }, 'Lead captured', 201);
  } catch (err) { next(err); }
});

export default router;
