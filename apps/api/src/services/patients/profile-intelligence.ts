import { prisma } from '../../lib/prisma';
import { aiComplete, isAiFeatureEnabled } from '../ai';

const PROFILE_FIELDS: { key: keyof ProfileInput; weight: number; label: string }[] = [
  { key: 'fullName', weight: 15, label: 'Full name' },
  { key: 'dateOfBirth', weight: 15, label: 'Date of birth' },
  { key: 'gender', weight: 10, label: 'Gender' },
  { key: 'address', weight: 10, label: 'Address' },
  { key: 'city', weight: 10, label: 'City' },
  { key: 'state', weight: 5, label: 'State' },
  { key: 'emergencyContact', weight: 15, label: 'Emergency contact' },
  { key: 'bloodGroup', weight: 10, label: 'Blood group' },
  { key: 'phone', weight: 10, label: 'Phone number' },
];

type ProfileInput = {
  fullName: string;
  dateOfBirth: Date | null;
  gender: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  emergencyContact: string | null;
  bloodGroup: string | null;
  phone: string | null;
};

export function computeProfileCompletion(patient: ProfileInput): {
  percent: number;
  completed: boolean;
  missingFields: string[];
} {
  let score = 0;
  const missingFields: string[] = [];

  for (const field of PROFILE_FIELDS) {
    const value = patient[field.key];
    const filled = value !== null && value !== undefined && String(value).trim() !== '';
    if (filled) score += field.weight;
    else missingFields.push(field.label);
  }

  return {
    percent: Math.min(100, score),
    completed: score >= 85,
    missingFields,
  };
}

export async function updatePatientProfileCompletion(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { user: { select: { phone: true } } },
  });
  if (!patient) throw new Error('Patient not found');

  const result = computeProfileCompletion({
    fullName: patient.fullName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    address: patient.address,
    city: patient.city,
    state: patient.state,
    emergencyContact: patient.emergencyContact,
    bloodGroup: patient.bloodGroup,
    phone: patient.user.phone,
  });

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      profileCompletionPercent: result.percent,
      profileCompleted: result.completed,
    },
  });

  return result;
}

export async function batchUpdateProfileCompletion(organizationId?: string) {
  const where = organizationId
    ? { organizations: { some: { organizationId } } }
    : {};

  const patients = await prisma.patient.findMany({
    where,
    include: { user: { select: { phone: true } } },
    take: 500,
  });

  let updated = 0;
  for (const patient of patients) {
    const result = computeProfileCompletion({
      fullName: patient.fullName,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      address: patient.address,
      city: patient.city,
      state: patient.state,
      emergencyContact: patient.emergencyContact,
      bloodGroup: patient.bloodGroup,
      phone: patient.user.phone,
    });
    await prisma.patient.update({
      where: { id: patient.id },
      data: { profileCompletionPercent: result.percent, profileCompleted: result.completed },
    });
    updated++;
  }
  return { updated };
}

export async function findDuplicatePatients(options: { organizationId?: string; limit?: number }) {
  const limit = options.limit || 20;
  const patients = await prisma.patient.findMany({
    where: options.organizationId
      ? { organizations: { some: { organizationId: options.organizationId } } }
      : {},
    include: { user: { select: { email: true, phone: true } } },
    take: 500,
    orderBy: { createdAt: 'desc' },
  });

  const groups: {
    matchKey: string;
    matchType: string;
    patients: { id: string; fullName: string; email: string | null; phone: string | null }[];
    confidence: string;
  }[] = [];

  const byEmail = new Map<string, typeof patients>();
  const byPhone = new Map<string, typeof patients>();
  const byNameDob = new Map<string, typeof patients>();

  for (const p of patients) {
    const email = p.user.email?.toLowerCase();
    const phone = p.user.phone?.replace(/\D/g, '');
    if (email) {
      const list = byEmail.get(email) || [];
      list.push(p);
      byEmail.set(email, list);
    }
    if (phone && phone.length >= 10) {
      const list = byPhone.get(phone) || [];
      list.push(p);
      byPhone.set(phone, list);
    }
    if (p.dateOfBirth) {
      const key = `${p.fullName.toLowerCase()}_${p.dateOfBirth.toISOString().slice(0, 10)}`;
      const list = byNameDob.get(key) || [];
      list.push(p);
      byNameDob.set(key, list);
    }
  }

  const addGroup = (matchType: string, matchKey: string, list: typeof patients, confidence: string) => {
    if (list.length < 2) return;
    groups.push({
      matchKey,
      matchType,
      confidence,
      patients: list.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        email: p.user.email,
        phone: p.user.phone,
      })),
    });
  };

  for (const [email, list] of byEmail) addGroup('email', email, list, 'HIGH');
  for (const [phone, list] of byPhone) addGroup('phone', phone, list, 'HIGH');
  for (const [key, list] of byNameDob) addGroup('name_dob', key, list, 'MEDIUM');

  return { groups: groups.slice(0, limit), totalGroups: groups.length };
}

export async function getPatientTimeline(patientId: string) {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { user: { select: { email: true, phone: true, createdAt: true } } },
  });
  if (!patient) throw new Error('Patient not found');

  const [appointments, bills, reviews] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId },
      take: 20,
      orderBy: { appointmentDate: 'desc' },
      include: {
        doctor: { select: { fullName: true } },
        organization: { select: { name: true } },
      },
    }),
    prisma.bill.findMany({
      where: { patientId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { organization: { select: { name: true } } },
    }),
    prisma.review.findMany({
      where: { patientId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { rating: true, comment: true, createdAt: true },
    }),
  ]);

  const events: { date: Date; type: string; summary: string }[] = [
    { date: patient.user.createdAt, type: 'registration', summary: 'Patient registered on platform' },
    ...appointments.map((a) => ({
      date: a.appointmentDate,
      type: 'appointment',
      summary: `${a.status} appointment with Dr. ${a.doctor.fullName} at ${a.organization.name}`,
    })),
    ...bills.map((b) => ({
      date: b.createdAt,
      type: 'billing',
      summary: `Bill ₹${b.total} — ${b.status} at ${b.organization.name}`,
    })),
    ...reviews.map((r) => ({
      date: r.createdAt,
      type: 'review',
      summary: `${r.rating}★ review${r.comment ? `: "${r.comment.slice(0, 60)}..."` : ''}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  let aiSummary: string | null = null;
  if (await isAiFeatureEnabled('patientTimeline')) {
    const ai = await aiComplete({
      module: 'patients',
      feature: 'timeline_summary',
      inputRef: patientId,
      system: 'Summarize patient platform activity in 2-3 sentences. No medical diagnosis.',
      user: `Patient: ${patient.fullName}. Events: ${events.slice(0, 8).map((e) => e.summary).join('; ')}`,
    });
    if (ai.fromAi) aiSummary = ai.text;
  }

  if (!aiSummary) {
    aiSummary = `${patient.fullName} has ${appointments.length} recent appointments, ${bills.length} bills, and ${reviews.length} reviews on the platform.`;
  }

  const completion = computeProfileCompletion({
    fullName: patient.fullName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    address: patient.address,
    city: patient.city,
    state: patient.state,
    emergencyContact: patient.emergencyContact,
    bloodGroup: patient.bloodGroup,
    phone: patient.user.phone,
  });

  return {
    patient: {
      id: patient.id,
      fullName: patient.fullName,
      email: patient.user.email,
      profileCompletionPercent: completion.percent,
      missingFields: completion.missingFields,
    },
    events: events.slice(0, 25),
    aiSummary,
  };
}
