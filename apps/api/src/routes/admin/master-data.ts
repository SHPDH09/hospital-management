import { Router } from 'express';
import { z } from 'zod';
import { Prisma, MasterCatalogKind } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';

const router = Router();

type Delegate = {
  findMany: (args?: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<unknown | null>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
  updateMany: (args: unknown) => Promise<unknown>;
};

function registerCrud(
  path: string,
  delegate: Delegate,
  createSchema: z.ZodType,
  updateSchema: z.ZodType,
  entityName: string,
  options?: { include?: unknown; orderBy?: unknown; beforeCreate?: (data: Record<string, unknown>) => Record<string, unknown> }
) {
  router.get(`/${path}`, async (_req, res, next) => {
    try {
      const items = await delegate.findMany({
        orderBy: options?.orderBy || [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: options?.include,
      });
      sendSuccess(res, items);
    } catch (err) { next(err); }
  });

  router.post(`/${path}`, validateBody(createSchema), async (req: AuthRequest, res, next) => {
    try {
      let data = req.body as Record<string, unknown>;
      if (options?.beforeCreate) data = options.beforeCreate(data);
      const item = await delegate.create({ data, include: options?.include });
      await logAudit(req, 'CREATE', entityName, (item as { id: string }).id);
      sendSuccess(res, item, 'Created', 201);
    } catch (err) { next(err); }
  });

  router.patch(`/${path}/:id`, validateBody(updateSchema), async (req: AuthRequest, res, next) => {
    try {
      const id = paramId(req.params.id);
      const item = await delegate.update({ where: { id }, data: req.body, include: options?.include });
      await logAudit(req, 'UPDATE', entityName, id, req.body);
      sendSuccess(res, item, 'Updated');
    } catch (err) { next(err); }
  });

  router.patch(`/${path}/:id/activate`, async (req: AuthRequest, res, next) => {
    try {
      const id = paramId(req.params.id);
      const item = await delegate.update({ where: { id }, data: { isActive: true } });
      await logAudit(req, 'ACTIVATE', entityName, id);
      sendSuccess(res, item, 'Activated');
    } catch (err) { next(err); }
  });

  router.patch(`/${path}/:id/deactivate`, async (req: AuthRequest, res, next) => {
    try {
      const id = paramId(req.params.id);
      const item = await delegate.update({ where: { id }, data: { isActive: false } });
      await logAudit(req, 'DEACTIVATE', entityName, id);
      sendSuccess(res, item, 'Deactivated');
    } catch (err) { next(err); }
  });

  router.delete(`/${path}/:id`, async (req: AuthRequest, res, next) => {
    try {
      const id = paramId(req.params.id);
      await delegate.delete({ where: { id } });
      await logAudit(req, 'DELETE', entityName, id);
      sendSuccess(res, null, 'Deleted');
    } catch (err) { next(err); }
  });

  router.post(`/${path}/bulk-activate`, validateBody(z.object({ ids: z.array(z.string()).min(1) })), async (req: AuthRequest, res, next) => {
    try {
      await delegate.updateMany({ where: { id: { in: req.body.ids } }, data: { isActive: true } });
      await logAudit(req, 'BULK_ACTIVATE', entityName, undefined, { ids: req.body.ids });
      sendSuccess(res, null, 'Bulk activated');
    } catch (err) { next(err); }
  });

  router.post(`/${path}/bulk-deactivate`, validateBody(z.object({ ids: z.array(z.string()).min(1) })), async (req: AuthRequest, res, next) => {
    try {
      await delegate.updateMany({ where: { id: { in: req.body.ids } }, data: { isActive: false } });
      await logAudit(req, 'BULK_DEACTIVATE', entityName, undefined, { ids: req.body.ids });
      sendSuccess(res, null, 'Bulk deactivated');
    } catch (err) { next(err); }
  });

  router.put(`/${path}/reorder`, validateBody(z.object({ items: z.array(z.object({ id: z.string(), sortOrder: z.number() })) })), async (req: AuthRequest, res, next) => {
    try {
      await Promise.all(req.body.items.map((item: { id: string; sortOrder: number }) =>
        delegate.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
      ));
      sendSuccess(res, null, 'Reordered');
    } catch (err) { next(err); }
  });

  router.get(`/${path}/export`, async (_req, res, next) => {
    try {
      const items = await delegate.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
      const header = 'id,name,isActive,sortOrder\n';
      const rows = (items as { id: string; name: string; isActive: boolean; sortOrder: number }[])
        .map((i) => `${i.id},"${i.name.replace(/"/g, '""')}",${i.isActive},${i.sortOrder}`)
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.send(header + rows);
    } catch (err) { next(err); }
  });

  router.post(`/${path}/bulk-upload`, validateBody(z.object({ items: z.array(z.record(z.unknown())).min(1) })), async (req: AuthRequest, res, next) => {
    try {
      const created = [];
      for (const raw of req.body.items) {
        let data = raw as Record<string, unknown>;
        if (options?.beforeCreate) data = options.beforeCreate(data);
        const item = await delegate.create({ data });
        created.push(item);
      }
      await logAudit(req, 'BULK_UPLOAD', entityName, undefined, { count: created.length });
      sendSuccess(res, created, `Imported ${created.length} items`, 201);
    } catch (err) { next(err); }
  });
}

const baseSchema = z.object({ name: z.string().min(2), description: z.string().optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional() });
const basePartial = baseSchema.partial();

// ─── Specializations ───────────────────────────────────────────────────────────

const specSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  department: z.string().optional(),
  services: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

registerCrud('specializations', prisma.specialization as unknown as Delegate, specSchema, specSchema.partial(), 'Specialization', {
  beforeCreate: (d) => ({ ...d, services: (d.services as string[]) || [] }),
});

// ─── Departments ─────────────────────────────────────────────────────────────

registerCrud('departments', prisma.platformDepartment as unknown as Delegate, baseSchema, basePartial, 'PlatformDepartment');

// ─── Service Categories ──────────────────────────────────────────────────────

registerCrud('service-categories', prisma.serviceCategory as unknown as Delegate, baseSchema, basePartial, 'ServiceCategory');

// ─── Healthcare Services ─────────────────────────────────────────────────────

const serviceSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string().optional(),
  description: z.string().optional(),
  defaultPrice: z.number().min(0).optional(),
  duration: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
registerCrud('services', prisma.platformHealthcareService as unknown as Delegate, serviceSchema, serviceSchema.partial(), 'PlatformHealthcareService', {
  include: { category: { select: { id: true, name: true } } },
});

// ─── Test Categories ─────────────────────────────────────────────────────────

const testCatSchema = z.object({
  name: z.string().min(2),
  group: z.string().optional(),
  parentId: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
registerCrud('test-categories', prisma.testCategory as unknown as Delegate, testCatSchema, testCatSchema.partial(), 'TestCategory', {
  include: { parent: { select: { id: true, name: true } } },
});

// ─── Diagnostic Tests ────────────────────────────────────────────────────────

const diagSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string().optional(),
  sampleType: z.string().optional(),
  preparation: z.string().optional(),
  defaultPrice: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
registerCrud('diagnostic-tests', prisma.diagnosticTest as unknown as Delegate, diagSchema, diagSchema.partial(), 'DiagnosticTest', {
  include: { category: { select: { id: true, name: true, group: true } } },
});

// ─── Medicines ───────────────────────────────────────────────────────────────

const medSchema = z.object({
  name: z.string().min(2),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
  category: z.string().optional(),
  dosageForm: z.string().optional(),
  strength: z.string().optional(),
  manufacturer: z.string().optional(),
  unit: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
registerCrud('medicines', prisma.medicine as unknown as Delegate, medSchema, medSchema.partial(), 'Medicine');

// ─── Insurance Providers ─────────────────────────────────────────────────────

const insSchema = z.object({
  name: z.string().min(2),
  logoUrl: z.string().optional(),
  contact: z.string().optional(),
  website: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
registerCrud('insurance-providers', prisma.insuranceProvider as unknown as Delegate, insSchema, insSchema.partial(), 'InsuranceProvider');

// ─── Doctor Qualifications ───────────────────────────────────────────────────

const qualSchema = z.object({
  name: z.string().min(2),
  shortName: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
registerCrud('qualifications', prisma.doctorQualification as unknown as Delegate, qualSchema, qualSchema.partial(), 'DoctorQualification');

// ─── Staff Roles ─────────────────────────────────────────────────────────────

const roleSchema = z.object({
  name: z.string().min(2),
  code: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
registerCrud('staff-roles', prisma.staffRoleMaster as unknown as Delegate, roleSchema, roleSchema.partial(), 'StaffRoleMaster');

// ─── Master Catalog (hospital types, clinic types, facilities, package categories) ─

function registerCatalog(kind: MasterCatalogKind, path: string) {
  const catalogDelegate = {
    findMany: (args?: unknown) => prisma.masterCatalog.findMany({ ...(args as object), where: { kind } }),
    findUnique: (args: unknown) => prisma.masterCatalog.findUnique(args as Prisma.MasterCatalogFindUniqueArgs),
    create: (args: unknown) => {
      const a = args as { data: Record<string, unknown> };
      return prisma.masterCatalog.create({ data: { ...a.data, kind } as Prisma.MasterCatalogCreateInput });
    },
    update: (args: unknown) => prisma.masterCatalog.update(args as Prisma.MasterCatalogUpdateArgs),
    delete: (args: unknown) => prisma.masterCatalog.delete(args as Prisma.MasterCatalogDeleteArgs),
    updateMany: (args: unknown) => prisma.masterCatalog.updateMany({ ...(args as Prisma.MasterCatalogUpdateManyArgs), where: { ...(args as Prisma.MasterCatalogUpdateManyArgs).where, kind } }),
  } as Delegate;

  registerCrud(path, catalogDelegate, baseSchema, basePartial, `MasterCatalog:${kind}`, {
    beforeCreate: (d) => ({ ...d, kind }),
  });
}

registerCatalog('HOSPITAL_TYPE', 'hospital-types');
registerCatalog('CLINIC_TYPE', 'clinic-types');
registerCatalog('FACILITY', 'facilities');
registerCatalog('HEALTH_PACKAGE_CATEGORY', 'health-package-categories');

// ─── Overview stats ────────────────────────────────────────────────────────────

router.get('/overview', async (_req, res, next) => {
  try {
    const [
      specializations, departments, services, diagnosticTests, medicines,
      serviceCategories, testCategories, hospitalTypes, clinicTypes,
      facilities, packageCategories, insuranceProviders, qualifications, staffRoles,
    ] = await Promise.all([
      prisma.specialization.count(),
      prisma.platformDepartment.count(),
      prisma.platformHealthcareService.count(),
      prisma.diagnosticTest.count(),
      prisma.medicine.count(),
      prisma.serviceCategory.count(),
      prisma.testCategory.count(),
      prisma.masterCatalog.count({ where: { kind: 'HOSPITAL_TYPE' } }),
      prisma.masterCatalog.count({ where: { kind: 'CLINIC_TYPE' } }),
      prisma.masterCatalog.count({ where: { kind: 'FACILITY' } }),
      prisma.masterCatalog.count({ where: { kind: 'HEALTH_PACKAGE_CATEGORY' } }),
      prisma.insuranceProvider.count(),
      prisma.doctorQualification.count(),
      prisma.staffRoleMaster.count(),
    ]);
    sendSuccess(res, {
      specializations, departments, services, diagnosticTests, medicines,
      serviceCategories, testCategories, hospitalTypes, clinicTypes,
      facilities, packageCategories, insuranceProviders, qualifications, staffRoles,
    });
  } catch (err) { next(err); }
});

export default router;
