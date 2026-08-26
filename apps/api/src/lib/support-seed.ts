import { PrismaClient } from '@prisma/client';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SLA_RULES,
  DEFAULT_ASSIGNMENT_RULES,
  DEFAULT_CANNED_RESPONSES,
} from './support';

export async function seedSupport(prisma: PrismaClient) {
  for (const [i, cat] of DEFAULT_CATEGORIES.entries()) {
    await prisma.supportCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        userTypes: cat.userTypes,
        defaultPriority: cat.defaultPriority || 'MEDIUM',
        department: cat.department,
        sortOrder: i,
      },
    });
  }

  for (const sla of DEFAULT_SLA_RULES) {
    await prisma.supportSlaRule.upsert({
      where: { priority: sla.priority },
      update: { responseMinutes: sla.responseMinutes, resolutionMinutes: sla.resolutionMinutes },
      create: sla,
    });
  }

  for (const rule of DEFAULT_ASSIGNMENT_RULES) {
    const existing = await prisma.supportAssignmentRule.findFirst({ where: { name: rule.name } });
    if (!existing) await prisma.supportAssignmentRule.create({ data: rule });
  }

  for (const cr of DEFAULT_CANNED_RESPONSES) {
    const existing = await prisma.supportCannedResponse.findFirst({ where: { title: cr.title } });
    if (!existing) await prisma.supportCannedResponse.create({ data: cr });
  }

  const kbArticles = [
    { title: 'How to Book an Appointment', slug: 'book-appointment', content: 'Go to Find Doctor, select a doctor, choose date and time slot, and confirm payment.', category: 'appointment', isPublished: true, tags: ['appointment', 'booking'] },
    { title: 'Payment Failed but Amount Deducted', slug: 'payment-deducted', content: 'If payment was deducted but appointment not confirmed, wait 24 hours for auto-refund or raise a support ticket with transaction ID.', category: 'payment', isPublished: true, tags: ['payment', 'refund'] },
    { title: 'Reset Your Password', slug: 'reset-password', content: 'Click Forgot Password on login page. Enter your email to receive reset link.', category: 'account', isPublished: true, tags: ['account', 'password'] },
  ];
  for (const art of kbArticles) {
    await prisma.supportKnowledgeArticle.upsert({
      where: { slug: art.slug },
      update: { isPublished: art.isPublished },
      create: art,
    });
  }

  const teams = ['Customer Support', 'Finance Support', 'Technical Support', 'Verification Team', 'Subscription Team'];
  for (const name of teams) {
    await prisma.supportTeam.upsert({
      where: { name },
      update: {},
      create: { name, department: name },
    });
  }
}
