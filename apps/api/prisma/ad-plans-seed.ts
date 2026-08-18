import { PrismaClient } from '@prisma/client';

export async function seedAdPlans(prisma: PrismaClient) {
  const plans = [
    { name: 'Banner Basic', adType: 'HOMEPAGE_BANNER' as const, price: 2999, durationDays: 7, placement: 'homepage', priority: 1, description: 'Homepage banner for 7 days', recommendedDimensions: { desktop: '1200x400', mobile: '750x300' } },
    { name: 'Featured Hospital', adType: 'FEATURED_HOSPITAL' as const, price: 4999, durationDays: 15, placement: 'search_top', priority: 2, description: 'Featured hospital in search results', recommendedDimensions: { card: '400x300' } },
    { name: 'Featured Doctor', adType: 'FEATURED_DOCTOR' as const, price: 1999, durationDays: 7, placement: 'doctor_discovery', priority: 2, description: 'Doctor promotion on discovery page', recommendedDimensions: { card: '300x300' } },
    { name: 'Homepage Premium', adType: 'HOMEPAGE_BANNER' as const, price: 9999, durationDays: 30, placement: 'homepage_hero', priority: 3, description: 'Premium homepage placement for 30 days', recommendedDimensions: { desktop: '1200x400', mobile: '750x300' } },
    { name: 'Health Package Promo', adType: 'HEALTH_PACKAGE' as const, price: 3499, durationDays: 14, placement: 'promotional_card', priority: 1, description: 'Health checkup package promotion', recommendedDimensions: { square: '600x600' } },
    { name: 'Search Sponsored', adType: 'SEARCH_AD' as const, price: 2499, durationDays: 10, placement: 'search_results', priority: 1, description: 'Sponsored search placement', recommendedDimensions: { card: '400x200' } },
  ];

  for (const plan of plans) {
    const existing = await prisma.adPlan.findFirst({ where: { name: plan.name } });
    if (!existing) {
      await prisma.adPlan.create({ data: plan });
    }
  }
  console.log(`  Ad plans: ${plans.length} plans seeded`);
}
