import { prisma } from '../../lib/prisma';

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  score: number;
}

function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
}

function scoreText(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  return tokens.reduce((sum, t) => sum + (lower.includes(t) ? 1 : 0), 0);
}

export async function searchPlatform(query: string, limit = 20): Promise<{
  results: SearchResult[];
  interpretedQuery: string;
}> {
  const tokens = tokenize(query);
  if (!tokens.length) return { results: [], interpretedQuery: query };

  const [orgs, doctors, patients, leads] = await Promise.all([
    prisma.organization.findMany({
      where: {
        OR: tokens.flatMap((t) => [
          { name: { contains: t, mode: 'insensitive' as const } },
          { city: { contains: t, mode: 'insensitive' as const } },
          { slug: { contains: t, mode: 'insensitive' as const } },
        ]),
      },
      take: 15,
      select: { id: true, name: true, type: true, city: true, slug: true, verificationStatus: true },
    }),
    prisma.doctor.findMany({
      where: {
        OR: tokens.flatMap((t) => [
          { fullName: { contains: t, mode: 'insensitive' as const } },
          { specialization: { contains: t, mode: 'insensitive' as const } },
        ]),
      },
      take: 15,
      include: { organization: { select: { name: true } } },
    }),
    prisma.patient.findMany({
      where: {
        OR: tokens.flatMap((t) => [
          { fullName: { contains: t, mode: 'insensitive' as const } },
          { city: { contains: t, mode: 'insensitive' as const } },
        ]),
      },
      take: 10,
      include: { user: { select: { email: true } } },
    }),
    prisma.lead.findMany({
      where: {
        OR: tokens.flatMap((t) => [
          { name: { contains: t, mode: 'insensitive' as const } },
          { email: { contains: t, mode: 'insensitive' as const } },
          { phone: { contains: t, mode: 'insensitive' as const } },
        ]),
      },
      take: 10,
      select: { id: true, name: true, email: true, phone: true, status: true, source: true },
    }),
  ]);

  const results: SearchResult[] = [];

  for (const o of orgs) {
    const score = scoreText(`${o.name} ${o.city} ${o.type}`, tokens);
    if (score > 0) {
      results.push({
        type: 'organization',
        id: o.id,
        title: o.name,
        subtitle: `${o.type} · ${o.city || '—'} · ${o.verificationStatus}`,
        url: `/admin/${o.type === 'CLINIC' ? 'clinics' : 'hospitals'}`,
        score,
      });
    }
  }

  for (const d of doctors) {
    const score = scoreText(`${d.fullName} ${d.specialization} ${d.organization.name}`, tokens);
    if (score > 0) {
      results.push({
        type: 'doctor',
        id: d.id,
        title: `Dr. ${d.fullName}`,
        subtitle: `${d.specialization || 'General'} · ${d.organization.name}`,
        url: '/admin/doctors',
        score,
      });
    }
  }

  for (const p of patients) {
    const score = scoreText(`${p.fullName} ${p.city} ${p.user.email}`, tokens);
    if (score > 0) {
      results.push({
        type: 'patient',
        id: p.id,
        title: p.fullName,
        subtitle: p.user.email,
        url: '/admin/patients',
        score,
      });
    }
  }

  for (const l of leads) {
    const score = scoreText(`${l.name} ${l.email} ${l.phone} ${l.source}`, tokens);
    if (score > 0) {
      results.push({
        type: 'lead',
        id: l.id,
        title: l.name || l.email || 'Lead',
        subtitle: `${l.status} · ${l.source || 'unknown source'}`,
        url: '/admin/leads',
        score,
      });
    }
  }

  const lower = query.toLowerCase();
  if (lower.includes('payment') || lower.includes('failed')) {
    results.push({ type: 'page', id: 'payments', title: 'Payment Management', url: '/admin/payments', score: 2 });
  }
  if (lower.includes('appointment')) {
    results.push({ type: 'page', id: 'appointments', title: 'Appointments', url: '/admin/appointments', score: 2 });
  }
  if (lower.includes('ai') || lower.includes('copilot')) {
    results.push({ type: 'page', id: 'ai', title: 'AI Copilot', url: '/admin/ai/copilot', score: 2 });
  }
  if (lower.includes('approval') || lower.includes('verification')) {
    results.push({ type: 'page', id: 'approvals', title: 'AI Approval Queue', url: '/admin/ai/approvals', score: 2 });
  }

  results.sort((a, b) => b.score - a.score);

  return {
    results: results.slice(0, limit),
    interpretedQuery: `Searching for: ${tokens.join(', ')}`,
  };
}
