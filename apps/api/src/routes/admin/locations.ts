import { Router } from 'express';
import { z } from 'zod';
import { LocationType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';

const router = Router();

const locationSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['COUNTRY', 'STATE', 'CITY', 'DISTRICT', 'AREA']),
  parentId: z.string().optional(),
  pinCode: z.string().optional(),
  isActive: z.boolean().optional(),
});

const PARENT_TYPES: Record<LocationType, LocationType[]> = {
  COUNTRY: [],
  STATE: ['COUNTRY'],
  DISTRICT: ['STATE'],
  CITY: ['STATE', 'DISTRICT'],
  AREA: ['CITY', 'DISTRICT'],
};

async function validateParent(type: LocationType, parentId?: string) {
  if (type === 'COUNTRY') {
    if (parentId) throw new AppError('Country cannot have a parent location', 400);
    return;
  }
  if (!parentId) throw new AppError('Parent location is required', 400);

  const parent = await prisma.location.findUnique({ where: { id: parentId } });
  if (!parent) throw new AppError('Parent location not found', 404);
  if (!PARENT_TYPES[type].includes(parent.type)) {
    throw new AppError(`${type} must belong under ${PARENT_TYPES[type].join(' or ')}`, 400);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const type = req.query.type as LocationType | undefined;
    const parentId = req.query.parentId as string | undefined;
    const isActive = req.query.isActive;

    const locations = await prisma.location.findMany({
      where: {
        ...(type && { type }),
        ...(parentId && { parentId }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true, type: true } },
        _count: { select: { children: true } },
      },
    });
    sendSuccess(res, locations);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, type: true } },
        children: { select: { id: true, name: true, type: true, isActive: true } },
      },
    });
    if (!location) throw new AppError('Location not found', 404);
    sendSuccess(res, location);
  } catch (err) { next(err); }
});

router.post('/', validateBody(locationSchema), async (req: AuthRequest, res, next) => {
  try {
    const { type, parentId, ...rest } = req.body as z.infer<typeof locationSchema>;
    await validateParent(type, parentId);

    const location = await prisma.location.create({
      data: { ...rest, type, parentId: parentId || undefined },
      include: { parent: { select: { id: true, name: true, type: true } } },
    });
    await logAudit(req, 'CREATE', 'Location', location.id);
    sendSuccess(res, location, 'Location created', 201);
  } catch (err) { next(err); }
});

router.patch('/:id', validateBody(locationSchema.partial()), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const existing = await prisma.location.findUnique({ where: { id } });
    if (!existing) throw new AppError('Location not found', 404);

    const type = (req.body.type || existing.type) as LocationType;
    const parentId = req.body.parentId !== undefined ? req.body.parentId : existing.parentId || undefined;
    await validateParent(type, parentId);

    const location = await prisma.location.update({
      where: { id },
      data: { ...req.body, type, parentId: type === 'COUNTRY' ? null : parentId },
      include: { parent: { select: { id: true, name: true, type: true } } },
    });
    await logAudit(req, 'UPDATE', 'Location', id, req.body);
    sendSuccess(res, location, 'Location updated');
  } catch (err) { next(err); }
});

router.patch('/:id/activate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const location = await prisma.location.update({ where: { id }, data: { isActive: true } });
    await logAudit(req, 'ACTIVATE', 'Location', id);
    sendSuccess(res, location, 'Location activated');
  } catch (err) { next(err); }
});

router.patch('/:id/deactivate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const location = await prisma.location.update({ where: { id }, data: { isActive: false } });
    await logAudit(req, 'DEACTIVATE', 'Location', id);
    sendSuccess(res, location, 'Location deactivated');
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const children = await prisma.location.count({ where: { parentId: id } });
    if (children > 0) throw new AppError('Cannot delete location with child locations', 400);
    await prisma.location.delete({ where: { id } });
    await logAudit(req, 'DELETE', 'Location', id);
    sendSuccess(res, null, 'Location deleted');
  } catch (err) { next(err); }
});

export default router;
