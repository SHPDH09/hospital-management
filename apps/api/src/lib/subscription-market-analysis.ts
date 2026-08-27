import { SubscriptionPlan } from '@prisma/client';

/** Curated India healthcare SaaS benchmarks (2025–2026 public pricing). */
export interface CompetitorBenchmark {
  id: string;
  name: string;
  segment: string;
  targetSize: string;
  monthlyMin: number;
  monthlyMax: number;
  yearlyMin: number;
  yearlyMax: number;
  keyFeatures: string[];
  pricingModel: string;
  source: string;
}

export interface PlanSuggestion {
  planCode: string;
  planName: string;
  currentMonthly: number | null;
  currentYearly: number | null;
  suggestedMonthly: number;
  suggestedYearly: number;
  marketMonthlyMin: number;
  marketMonthlyMax: number;
  marketPosition: 'below_market' | 'competitive' | 'above_market' | 'premium';
  gapPercent: number;
  rationale: string;
  competitorRefs: string[];
  recommendedFeatures: string[];
}

export interface MarketAnalysisResult {
  analyzedAt: string;
  currency: string;
  market: string;
  competitors: CompetitorBenchmark[];
  suggestions: PlanSuggestion[];
  summary: {
    totalCompetitors: number;
    avgClinicMonthly: number;
    avgHospitalMonthly: number;
    recommendedAdjustments: number;
    positioningAdvice: string;
  };
}

const COMPETITORS: CompetitorBenchmark[] = [
  {
    id: 'cufront',
    name: 'Cufront',
    segment: 'Clinic / OPD',
    targetSize: 'Solo – 5 doctors',
    monthlyMin: 1250,
    monthlyMax: 8000,
    yearlyMin: 15000,
    yearlyMax: 96000,
    keyFeatures: ['OPD queue', 'Appointments', 'Digital Rx', 'Patient records', 'Billing'],
    pricingModel: 'Flat monthly SaaS',
    source: 'cufront.com/blog/hospital-management-software-pricing-india',
  },
  {
    id: 'anzo-starter',
    name: 'Anzo HMS Starter',
    segment: 'Small clinic',
    targetSize: 'Solo doctor',
    monthlyMin: 1499,
    monthlyMax: 1499,
    yearlyMin: 17988,
    yearlyMax: 17988,
    keyFeatures: ['OPD', 'Billing', 'Digital prescription', 'ABDM', '3 users'],
    pricingModel: 'Tiered SaaS',
    source: 'hms.anzo.co.in pricing guide 2026',
  },
  {
    id: 'anzo-clinic',
    name: 'Anzo HMS Clinic',
    segment: 'Multi-doctor clinic',
    targetSize: '2–8 doctors',
    monthlyMin: 3499,
    monthlyMax: 3499,
    yearlyMin: 41988,
    yearlyMax: 41988,
    keyFeatures: ['Pharmacy', 'Lab', 'WhatsApp reminders', '8 users'],
    pricingModel: 'Tiered SaaS',
    source: 'hms.anzo.co.in pricing guide 2026',
  },
  {
    id: 'anzo-hospital',
    name: 'Anzo HMS Hospital',
    segment: 'Small hospital',
    targetSize: '10–50 beds',
    monthlyMin: 6499,
    monthlyMax: 6499,
    yearlyMin: 77988,
    yearlyMax: 77988,
    keyFeatures: ['IPD', 'Insurance/TPA', 'Analytics', '20 users'],
    pricingModel: 'Tiered SaaS',
    source: 'hms.anzo.co.in pricing guide 2026',
  },
  {
    id: 'practo-ray',
    name: 'Practo Ray',
    segment: 'Clinic SaaS',
    targetSize: '1–15 doctors',
    monthlyMin: 1250,
    monthlyMax: 5000,
    yearlyMin: 15000,
    yearlyMax: 60000,
    keyFeatures: ['Appointments', 'EMR', 'Billing', 'Patient engagement'],
    pricingModel: 'Per-clinic SaaS',
    source: 'Industry benchmark (Practo Ray India)',
  },
  {
    id: 'medixcel',
    name: 'Medixcel / MocDoc',
    segment: 'Polyclinic / hospital',
    targetSize: '5–50 beds',
    monthlyMin: 5000,
    monthlyMax: 35000,
    yearlyMin: 60000,
    yearlyMax: 420000,
    keyFeatures: ['OPD+IPD', 'Pharmacy', 'Lab', 'Multi-location'],
    pricingModel: 'Modular SaaS',
    source: 'codingclave.com HMS cost guide 2026',
  },
  {
    id: 'cliniqwise',
    name: 'Cliniqwise',
    segment: 'Modular HMS',
    targetSize: 'Clinic to mid hospital',
    monthlyMin: 833,
    monthlyMax: 15000,
    yearlyMin: 10000,
    yearlyMax: 180000,
    keyFeatures: ['Unlimited users', 'ABDM', 'Modular pharmacy/lab/ward'],
    pricingModel: 'Flat modular yearly',
    source: 'cliniqwise.com/hospital-management-software-pricing',
  },
  {
    id: 'adrine-small',
    name: 'Adrine (Small clinic avg)',
    segment: 'Small clinic',
    targetSize: '1–5 doctors',
    monthlyMin: 2000,
    monthlyMax: 10000,
    yearlyMin: 24000,
    yearlyMax: 120000,
    keyFeatures: ['OPD', 'Billing', 'Appointments', 'Basic reports'],
    pricingModel: 'SaaS subscription',
    source: 'adrine.in/hospital-software-cost-india',
  },
  {
    id: 'adrine-medium',
    name: 'Adrine (Medium hospital)',
    segment: 'Mid hospital',
    targetSize: '20–50 beds',
    monthlyMin: 15000,
    monthlyMax: 35000,
    yearlyMin: 180000,
    yearlyMax: 420000,
    keyFeatures: ['IPD', 'Pharmacy', 'Lab', 'Insurance', 'Analytics'],
    pricingModel: 'SaaS subscription',
    source: 'adrine.in/hospital-software-cost-india',
  },
];

/** Ideal plan tiers mapped to market segments. */
const IDEAL_TIERS = [
  {
    code: 'free',
    name: 'Free',
    segment: 'Trial / onboarding',
    monthly: 0,
    yearly: 0,
    marketMin: 0,
    marketMax: 0,
    competitors: [] as string[],
    features: ['Basic Listing', 'Basic Dashboard', 'Up to 2 Doctors', '15-day trial'],
  },
  {
    code: 'basic',
    name: 'Basic',
    segment: 'Solo clinic / starter',
    monthly: 1499,
    yearly: 14990,
    marketMin: 999,
    marketMax: 2499,
    competitors: ['anzo-starter', 'cufront', 'practo-ray', 'cliniqwise'],
    features: ['Patient Management', 'Appointments', 'Billing', 'Digital Prescriptions', 'Up to 10 doctors'],
  },
  {
    code: 'professional',
    name: 'Professional',
    segment: 'Multi-doctor clinic',
    monthly: 3499,
    yearly: 34990,
    marketMin: 2499,
    marketMax: 4499,
    competitors: ['anzo-clinic', 'adrine-small', 'practo-ray'],
    features: ['Staff Management', 'Reports', 'Inventory', 'Communication', 'WhatsApp reminders'],
  },
  {
    code: 'advanced',
    name: 'Advanced',
    segment: 'Small–mid hospital',
    monthly: 4999,
    yearly: 49990,
    marketMin: 3999,
    marketMax: 6499,
    competitors: ['anzo-hospital', 'medixcel', 'adrine-small'],
    features: ['AI Analytics', 'Multi-branch', 'Lab Integration', 'Pharmacy', 'Insurance/TPA', 'API Access', 'Priority Support'],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    segment: 'Hospital chains / 50+ beds',
    monthly: 9999,
    yearly: 99990,
    marketMin: 6500,
    marketMax: 35000,
    competitors: ['anzo-hospital', 'medixcel', 'adrine-medium'],
    features: ['Unlimited branches', 'Custom branding', 'Dedicated account manager', 'SLA', 'Custom modules', 'On-premise option'],
  },
];

function marketPosition(current: number, min: number, max: number): PlanSuggestion['marketPosition'] {
  if (current <= 0) return 'competitive';
  if (current < min * 0.85) return 'below_market';
  if (current > max * 1.15) return 'premium';
  return 'competitive';
}

function gapPercent(current: number, suggested: number): number {
  if (current <= 0) return 0;
  return Math.round(((suggested - current) / current) * 100);
}

export function analyzeSubscriptionMarket(plans: SubscriptionPlan[]): MarketAnalysisResult {
  const suggestions: PlanSuggestion[] = IDEAL_TIERS.map((tier) => {
    const existing = plans.find((p) => p.code === tier.code);
    const currentMonthly = existing?.monthlyPrice ?? existing?.price ?? null;
    const currentYearly = existing?.yearlyPrice ?? null;
    const suggestedMonthly = tier.monthly;
    const suggestedYearly = tier.yearly;
    const current = currentMonthly ?? 0;
    const position = marketPosition(current, tier.marketMin, tier.marketMax);

    let rationale: string;
    if (!existing) {
      rationale = `No "${tier.name}" plan exists. Market data suggests ₹${tier.marketMin.toLocaleString('en-IN')}–₹${tier.marketMax.toLocaleString('en-IN')}/mo for ${tier.segment}.`;
    } else if (position === 'below_market') {
      rationale = `Priced ${Math.abs(gapPercent(current, suggestedMonthly))}% below market. Competitors charge ₹${tier.marketMin.toLocaleString('en-IN')}–₹${tier.marketMax.toLocaleString('en-IN')}/mo — room to increase revenue without losing competitiveness.`;
    } else if (position === 'premium') {
      rationale = `Priced above typical market range. Consider adding premium features (ABDM, lab, IPD) or adjusting to ₹${suggestedMonthly.toLocaleString('en-IN')}/mo to improve conversion.`;
    } else {
      rationale = `Well positioned within market range (₹${tier.marketMin.toLocaleString('en-IN')}–₹${tier.marketMax.toLocaleString('en-IN')}/mo) for ${tier.segment}.`;
    }

    return {
      planCode: tier.code,
      planName: tier.name,
      currentMonthly,
      currentYearly,
      suggestedMonthly,
      suggestedYearly,
      marketMonthlyMin: tier.marketMin,
      marketMonthlyMax: tier.marketMax,
      marketPosition: position,
      gapPercent: gapPercent(current, suggestedMonthly),
      rationale,
      competitorRefs: tier.competitors,
      recommendedFeatures: tier.features,
    };
  });

  const clinicComps = COMPETITORS.filter((c) => c.monthlyMax <= 10000);
  const hospitalComps = COMPETITORS.filter((c) => c.monthlyMin >= 5000);
  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const adjustments = suggestions.filter((s) => Math.abs(s.gapPercent) > 10 && s.planCode !== 'free').length;

  return {
    analyzedAt: new Date().toISOString(),
    currency: 'INR',
    market: 'India — Healthcare SaaS (HMS/CRM)',
    competitors: COMPETITORS,
    suggestions,
    summary: {
      totalCompetitors: COMPETITORS.length,
      avgClinicMonthly: avg(clinicComps.map((c) => (c.monthlyMin + c.monthlyMax) / 2)),
      avgHospitalMonthly: avg(hospitalComps.map((c) => (c.monthlyMin + c.monthlyMax) / 2)),
      recommendedAdjustments: adjustments,
      positioningAdvice: adjustments > 0
        ? `${adjustments} plan(s) could be repriced based on current India HMS market benchmarks. Advanced tier at ₹4,999/mo targets the fast-growing small-hospital segment (₹3,999–₹6,499 market range).`
        : 'Your plans are competitively priced against the India healthcare SaaS market.',
    },
  };
}

export function getIdealTierDefinitions() {
  return IDEAL_TIERS;
}
