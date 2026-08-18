import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { sendSuccess, AppError } from '../../lib/response';
import { paramId } from '../../lib/params';
import { AuthRequest } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { logAudit } from '../../lib/audit';

const router = Router();

async function recordVersion(entityType: string, entityId: string, data: unknown, req: AuthRequest, note?: string) {
  const last = await prisma.cmsVersion.findFirst({
    where: { entityType, entityId },
    orderBy: { version: 'desc' },
  });
  await prisma.cmsVersion.create({
    data: {
      entityType,
      entityId,
      version: (last?.version || 0) + 1,
      data: data as Prisma.InputJsonValue,
      changedBy: req.user?.email,
      changeNote: note,
    },
  });
}

type Delegate = {
  findMany: (args?: unknown) => Promise<unknown[]>;
  findUnique: (args: unknown) => Promise<unknown | null>;
  create: (args: unknown) => Promise<unknown>;
  update: (args: unknown) => Promise<unknown>;
  delete: (args: unknown) => Promise<unknown>;
};

function crud(path: string, delegate: Delegate, createSchema: z.ZodObject<z.ZodRawShape>, entityType: string) {
  router.get(`/${path}`, async (_req, res, next) => {
    try {
      const items = await delegate.findMany({ orderBy: { createdAt: 'desc' } });
      sendSuccess(res, items);
    } catch (err) { next(err); }
  });

  router.post(`/${path}`, validateBody(createSchema), async (req: AuthRequest, res, next) => {
    try {
      const item = await delegate.create({ data: req.body });
      await recordVersion(entityType, (item as { id: string }).id, item, req, 'Created');
      sendSuccess(res, item, 'Created', 201);
    } catch (err) { next(err); }
  });

  router.patch(`/${path}/:id`, validateBody(createSchema.partial()), async (req: AuthRequest, res, next) => {
    try {
      const id = paramId(req.params.id);
      const item = await delegate.update({ where: { id }, data: req.body });
      await recordVersion(entityType, id, item, req, 'Updated');
      sendSuccess(res, item);
    } catch (err) { next(err); }
  });

  router.delete(`/${path}/:id`, async (req: AuthRequest, res, next) => {
    try {
      const id = paramId(req.params.id);
      await delegate.delete({ where: { id } });
      sendSuccess(res, null, 'Deleted');
    } catch (err) { next(err); }
  });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [pages, publishedPages, blogs, faqs, banners, promotions, testimonials, media, scheduled, lastPage] = await Promise.all([
      prisma.cmsPage.count(),
      prisma.cmsPage.count({ where: { isPublished: true } }),
      prisma.cmsBlog.count(),
      prisma.cmsFaq.count({ where: { isActive: true } }),
      prisma.cmsBanner.count({ where: { isActive: true } }),
      prisma.cmsPromotion.count({ where: { isActive: true } }),
      prisma.cmsTestimonial.count({ where: { isActive: true } }),
      prisma.cmsMedia.count(),
      prisma.cmsPage.count({ where: { status: 'SCHEDULED' } }),
      prisma.cmsPage.findFirst({ orderBy: { updatedAt: 'desc' }, select: { title: true, updatedAt: true } }),
    ]);
    sendSuccess(res, {
      totalPages: pages,
      publishedPages,
      draftPages: pages - publishedPages,
      scheduledContent: scheduled,
      blogPosts: blogs,
      faqs,
      banners,
      activePromotions: promotions,
      testimonials,
      media,
      pendingContent: pages - publishedPages,
      lastUpdated: lastPage,
    });
  } catch (err) { next(err); }
});

// ─── Pages ───────────────────────────────────────────────────────────────────

const pageSchema = z.object({
  slug: z.string(), title: z.string(), content: z.string(),
  pageType: z.enum(['STATIC', 'LEGAL', 'LOCATION']).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).optional(),
  isPublished: z.boolean().optional(),
  metaTitle: z.string().optional(), metaDescription: z.string().optional(),
  keywords: z.string().optional(), canonicalUrl: z.string().optional(),
  ogTitle: z.string().optional(), ogDescription: z.string().optional(), ogImageUrl: z.string().optional(),
  robots: z.string().optional(),
  publishAt: z.string().optional(), unpublishAt: z.string().optional(),
});

router.get('/pages', async (_req, res, next) => {
  try {
    const pages = await prisma.cmsPage.findMany({ orderBy: { title: 'asc' } });
    sendSuccess(res, pages);
  } catch (err) { next(err); }
});

router.post('/pages', validateBody(pageSchema), async (req: AuthRequest, res, next) => {
  try {
    const data = { ...req.body, authorEmail: req.user?.email };
    if (data.publishAt) data.publishAt = new Date(data.publishAt);
    if (data.unpublishAt) data.unpublishAt = new Date(data.unpublishAt);
    const page = await prisma.cmsPage.create({ data });
    await recordVersion('page', page.id, page, req, 'Created');
    sendSuccess(res, page, 'Page created', 201);
  } catch (err) { next(err); }
});

router.patch('/pages/:id', validateBody(pageSchema.partial()), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const data = { ...req.body };
    if (data.publishAt) data.publishAt = new Date(data.publishAt);
    if (data.unpublishAt) data.unpublishAt = new Date(data.unpublishAt);
    const page = await prisma.cmsPage.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
    await recordVersion('page', id, page, req);
    sendSuccess(res, page);
  } catch (err) { next(err); }
});

router.post('/pages/:id/publish', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const page = await prisma.cmsPage.update({ where: { id }, data: { isPublished: true, status: 'PUBLISHED' } });
    sendSuccess(res, page, 'Published');
  } catch (err) { next(err); }
});

router.post('/pages/:id/unpublish', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const page = await prisma.cmsPage.update({ where: { id }, data: { isPublished: false, status: 'DRAFT' } });
    sendSuccess(res, page, 'Unpublished');
  } catch (err) { next(err); }
});

router.post('/pages/:id/duplicate', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const orig = await prisma.cmsPage.findUnique({ where: { id } });
    if (!orig) throw new AppError('Page not found', 404);
    const page = await prisma.cmsPage.create({
      data: {
        slug: `${orig.slug}-copy-${Date.now()}`,
        title: `${orig.title} (Copy)`,
        content: orig.content,
        pageType: orig.pageType,
        status: 'DRAFT',
        isPublished: false,
        metaTitle: orig.metaTitle,
        metaDescription: orig.metaDescription,
        authorEmail: req.user?.email,
      },
    });
    sendSuccess(res, page, 'Duplicated', 201);
  } catch (err) { next(err); }
});

router.delete('/pages/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    await prisma.cmsPage.delete({ where: { id } });
    sendSuccess(res, null, 'Deleted');
  } catch (err) { next(err); }
});

// ─── Blog ────────────────────────────────────────────────────────────────────

const blogSchema = z.object({
  title: z.string(), slug: z.string(), content: z.string(),
  coverImageUrl: z.string().optional(), author: z.string().optional(),
  category: z.string().optional(), tags: z.array(z.string()).optional(),
  metaTitle: z.string().optional(), metaDescription: z.string().optional(), keywords: z.string().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).optional(),
  publishAt: z.string().optional(),
});

crud('blogs', prisma.cmsBlog as unknown as Delegate, blogSchema, 'blog');

router.post('/blogs/:id/publish', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const blog = await prisma.cmsBlog.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    sendSuccess(res, blog);
  } catch (err) { next(err); }
});

// ─── Banners, FAQs, Testimonials, Promotions ─────────────────────────────────

crud('banners', prisma.cmsBanner as unknown as Delegate, z.object({
  title: z.string(), bannerType: z.string().optional(), imageUrl: z.string().optional(),
  mobileImageUrl: z.string().optional(), description: z.string().optional(),
  ctaText: z.string().optional(), ctaLink: z.string().optional(),
  startDate: z.string().optional(), endDate: z.string().optional(),
  sortOrder: z.number().optional(), isActive: z.boolean().optional(),
}), 'banner');

router.put('/banners/reorder', validateBody(z.object({ items: z.array(z.object({ id: z.string(), sortOrder: z.number() })) })), async (req, res, next) => {
  try {
    await Promise.all(req.body.items.map((i: { id: string; sortOrder: number }) =>
      prisma.cmsBanner.update({ where: { id: i.id }, data: { sortOrder: i.sortOrder } })
    ));
    sendSuccess(res, null, 'Reordered');
  } catch (err) { next(err); }
});

crud('faqs', prisma.cmsFaq as unknown as Delegate, z.object({
  question: z.string(), answer: z.string(), category: z.string().optional(),
  sortOrder: z.number().optional(), isActive: z.boolean().optional(),
}), 'faq');

router.put('/faqs/reorder', validateBody(z.object({ items: z.array(z.object({ id: z.string(), sortOrder: z.number() })) })), async (req, res, next) => {
  try {
    await Promise.all(req.body.items.map((i: { id: string; sortOrder: number }) =>
      prisma.cmsFaq.update({ where: { id: i.id }, data: { sortOrder: i.sortOrder } })
    ));
    sendSuccess(res, null, 'Reordered');
  } catch (err) { next(err); }
});

crud('testimonials', prisma.cmsTestimonial as unknown as Delegate, z.object({
  name: z.string(), content: z.string(), imageUrl: z.string().optional(),
  role: z.string().optional(), rating: z.number().optional(), isActive: z.boolean().optional(),
}), 'testimonial');

router.post('/testimonials/:id/approve', async (req, res, next) => {
  try {
    const id = paramId(req.params.id);
    const t = await prisma.cmsTestimonial.update({ where: { id }, data: { status: 'PUBLISHED', isActive: true } });
    sendSuccess(res, t, 'Approved');
  } catch (err) { next(err); }
});

crud('promotions', prisma.cmsPromotion as unknown as Delegate, z.object({
  title: z.string(), description: z.string().optional(), imageUrl: z.string().optional(),
  ctaText: z.string().optional(), ctaLink: z.string().optional(), promoType: z.string().optional(),
  startDate: z.string().optional(), endDate: z.string().optional(), isActive: z.boolean().optional(),
}), 'promotion');

// ─── Media ───────────────────────────────────────────────────────────────────

crud('media', prisma.cmsMedia as unknown as Delegate, z.object({
  filename: z.string(), url: z.string(), mimeType: z.string().optional(),
  size: z.number().optional(), folder: z.string().optional(), altText: z.string().optional(),
}), 'media');

// ─── Menu & Footer ───────────────────────────────────────────────────────────

crud('menu', prisma.cmsMenuItem as unknown as Delegate, z.object({
  label: z.string(), url: z.string(), parentId: z.string().optional(),
  target: z.string().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional(),
}), 'menu');

crud('footer', prisma.cmsFooterLink as unknown as Delegate, z.object({
  section: z.string(), label: z.string(), url: z.string(), sortOrder: z.number().optional(), isActive: z.boolean().optional(),
}), 'footer');

// ─── Homepage ────────────────────────────────────────────────────────────────

const HOMEPAGE_SECTIONS = [
  'hero', 'search', 'featured_hospitals', 'featured_clinics', 'featured_doctors',
  'popular_services', 'health_packages', 'how_it_works', 'why_choose_us',
  'testimonials', 'faqs', 'promotional_banner', 'footer',
];

router.get('/homepage', async (_req, res, next) => {
  try {
    let sections = await prisma.cmsHomepageSection.findMany({ orderBy: { sortOrder: 'asc' } });
    if (sections.length === 0) {
      await Promise.all(HOMEPAGE_SECTIONS.map((key, i) =>
        prisma.cmsHomepageSection.create({
          data: { key, title: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), sortOrder: i, isVisible: true, content: {} },
        })
      ));
      sections = await prisma.cmsHomepageSection.findMany({ orderBy: { sortOrder: 'asc' } });
    }
    sendSuccess(res, sections);
  } catch (err) { next(err); }
});

router.patch('/homepage/:id', validateBody(z.object({
  title: z.string().optional(), content: z.record(z.unknown()).optional(),
  isVisible: z.boolean().optional(), sortOrder: z.number().optional(),
})), async (req: AuthRequest, res, next) => {
  try {
    const id = paramId(req.params.id);
    const section = await prisma.cmsHomepageSection.update({ where: { id }, data: req.body });
    await recordVersion('homepage', id, section, req);
    sendSuccess(res, section);
  } catch (err) { next(err); }
});

router.put('/homepage/reorder', validateBody(z.object({ items: z.array(z.object({ id: z.string(), sortOrder: z.number() })) })), async (req, res, next) => {
  try {
    await Promise.all(req.body.items.map((i: { id: string; sortOrder: number }) =>
      prisma.cmsHomepageSection.update({ where: { id: i.id }, data: { sortOrder: i.sortOrder } })
    ));
    sendSuccess(res, null, 'Reordered');
  } catch (err) { next(err); }
});

// ─── Featured ──────────────────────────────────────────────────────────────────

router.get('/featured', async (req, res, next) => {
  try {
    const itemType = req.query.type as string | undefined;
    const items = await prisma.cmsFeaturedItem.findMany({
      where: itemType ? { itemType } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
    sendSuccess(res, items);
  } catch (err) { next(err); }
});

router.post('/featured', validateBody(z.object({
  itemType: z.string(), refId: z.string().optional(), refName: z.string(), sortOrder: z.number().optional(),
})), async (req, res, next) => {
  try {
    const item = await prisma.cmsFeaturedItem.create({ data: req.body });
    sendSuccess(res, item, 'Added', 201);
  } catch (err) { next(err); }
});

router.delete('/featured/:id', async (req, res, next) => {
  try {
    await prisma.cmsFeaturedItem.delete({ where: { id: paramId(req.params.id) } });
    sendSuccess(res, null, 'Removed');
  } catch (err) { next(err); }
});

// ─── Health Articles & Location Pages ────────────────────────────────────────

crud('health-articles', prisma.cmsHealthArticle as unknown as Delegate, z.object({
  title: z.string(), slug: z.string(), content: z.string(),
  category: z.string().optional(), coverImageUrl: z.string().optional(),
  metaTitle: z.string().optional(), metaDescription: z.string().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).optional(),
  publishAt: z.string().optional(),
}), 'health_article');

crud('location-pages', prisma.cmsLocationPage as unknown as Delegate, z.object({
  city: z.string(), state: z.string().optional(), slug: z.string(),
  title: z.string(), content: z.string(),
  metaTitle: z.string().optional(), metaDescription: z.string().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED']).optional(),
}), 'location_page');

// ─── Scheduled & Versions ────────────────────────────────────────────────────

router.get('/scheduled', async (_req, res, next) => {
  try {
    const [pages, blogs] = await Promise.all([
      prisma.cmsPage.findMany({ where: { status: 'SCHEDULED' }, orderBy: { publishAt: 'asc' } }),
      prisma.cmsBlog.findMany({ where: { status: 'SCHEDULED' }, orderBy: { publishAt: 'asc' } }),
    ]);
    sendSuccess(res, { pages, blogs });
  } catch (err) { next(err); }
});

router.get('/versions', async (req, res, next) => {
  try {
    const entityType = req.query.entityType as string;
    const entityId = req.query.entityId as string;
    const versions = await prisma.cmsVersion.findMany({
      where: { ...(entityType && { entityType }), ...(entityId && { entityId }) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    sendSuccess(res, versions);
  } catch (err) { next(err); }
});

router.get('/legal', async (_req, res, next) => {
  try {
    const pages = await prisma.cmsPage.findMany({ where: { pageType: 'LEGAL' }, orderBy: { title: 'asc' } });
    sendSuccess(res, pages);
  } catch (err) { next(err); }
});

export default router;
