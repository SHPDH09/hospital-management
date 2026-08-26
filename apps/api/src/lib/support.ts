import { ComplaintPriority } from '@prisma/client';

export const TICKET_STATUSES = [
  'NEW', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_USER',
  'RESOLVED', 'CLOSED', 'ESCALATED', 'REOPENED',
] as const;

export const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'] as const;

export const DEFAULT_CATEGORIES = [
  { name: 'Appointment', slug: 'appointment', userTypes: ['PATIENT', 'DOCTOR'], department: 'Customer Support' },
  { name: 'Payment', slug: 'payment', userTypes: ['PATIENT', 'HOSPITAL', 'DOCTOR'], department: 'Finance Support', defaultPriority: 'HIGH' as ComplaintPriority },
  { name: 'Refund', slug: 'refund', userTypes: ['PATIENT', 'HOSPITAL'], department: 'Finance Support', defaultPriority: 'HIGH' as ComplaintPriority },
  { name: 'Doctor', slug: 'doctor', userTypes: ['PATIENT', 'HOSPITAL'], department: 'Customer Support' },
  { name: 'Hospital', slug: 'hospital', userTypes: ['PATIENT'], department: 'Operations' },
  { name: 'Account', slug: 'account', userTypes: ['PATIENT', 'HOSPITAL', 'DOCTOR'], department: 'Customer Support' },
  { name: 'Technical', slug: 'technical', userTypes: ['PATIENT', 'HOSPITAL', 'DOCTOR', 'PLATFORM_STAFF'], department: 'Technical Support' },
  { name: 'Subscription', slug: 'subscription', userTypes: ['HOSPITAL'], department: 'Subscription Team' },
  { name: 'CRM', slug: 'crm', userTypes: ['HOSPITAL'], department: 'Customer Support' },
  { name: 'Advertisement', slug: 'advertisement', userTypes: ['HOSPITAL'], department: 'Marketing' },
  { name: 'Verification', slug: 'verification', userTypes: ['DOCTOR', 'HOSPITAL'], department: 'Verification Team' },
  { name: 'Profile', slug: 'profile', userTypes: ['DOCTOR'], department: 'Customer Support' },
];

export const DEFAULT_SLA_RULES = [
  { name: 'Low Priority', priority: 'LOW' as ComplaintPriority, responseMinutes: 480, resolutionMinutes: 2880 },
  { name: 'Medium Priority', priority: 'MEDIUM' as ComplaintPriority, responseMinutes: 240, resolutionMinutes: 1440 },
  { name: 'High Priority', priority: 'HIGH' as ComplaintPriority, responseMinutes: 120, resolutionMinutes: 720 },
  { name: 'Urgent', priority: 'URGENT' as ComplaintPriority, responseMinutes: 60, resolutionMinutes: 480 },
  { name: 'Critical', priority: 'CRITICAL' as ComplaintPriority, responseMinutes: 15, resolutionMinutes: 240 },
];

export const DEFAULT_ASSIGNMENT_RULES = [
  { name: 'Payment Issues', categorySlug: 'payment', department: 'Finance Support', defaultPriority: 'HIGH' as ComplaintPriority },
  { name: 'Refund Requests', categorySlug: 'refund', department: 'Finance Support', defaultPriority: 'HIGH' as ComplaintPriority },
  { name: 'Hospital Verification', categorySlug: 'verification', department: 'Verification Team' },
  { name: 'Technical Issues', categorySlug: 'technical', department: 'Technical Support' },
  { name: 'Subscription', categorySlug: 'subscription', department: 'Subscription Team' },
];

export const DEFAULT_CANNED_RESPONSES = [
  { title: 'Request Received', body: 'Your request has been received and our team is checking it. We will update you shortly.', category: 'general' },
  { title: 'Payment Checking', body: 'We are checking your payment with our payment gateway. Please share your transaction ID if not already provided.', category: 'payment' },
  { title: 'Appointment Help', body: 'To book an appointment, go to Find Doctor, select your doctor, and choose an available slot.', category: 'appointment' },
  { title: 'Account Verification', body: 'Your account verification is in progress. This usually takes 24-48 hours.', category: 'account' },
];

export function generateTicketId(): string {
  return `HC-${Date.now().toString(36).toUpperCase()}`;
}

export function computeSlaDue(priority: ComplaintPriority, slaRules: { priority: ComplaintPriority; responseMinutes: number; resolutionMinutes: number }[]) {
  const rule = slaRules.find((r) => r.priority === priority);
  const now = new Date();
  if (!rule) {
    return { slaResponseDue: new Date(now.getTime() + 8 * 60 * 60 * 1000), slaResolutionDue: new Date(now.getTime() + 48 * 60 * 60 * 1000) };
  }
  return {
    slaResponseDue: new Date(now.getTime() + rule.responseMinutes * 60 * 1000),
    slaResolutionDue: new Date(now.getTime() + rule.resolutionMinutes * 60 * 1000),
  };
}

export function suggestRouting(subject: string, description: string) {
  const text = `${subject} ${description}`.toLowerCase();
  if (/payment|deduct|txn|transaction|refund/.test(text)) return { categorySlug: 'payment', priority: 'HIGH' as ComplaintPriority, department: 'Finance Support' };
  if (/appointment|slot|booking/.test(text)) return { categorySlug: 'appointment', priority: 'MEDIUM' as ComplaintPriority, department: 'Customer Support' };
  if (/subscription|plan|billing/.test(text)) return { categorySlug: 'subscription', priority: 'MEDIUM' as ComplaintPriority, department: 'Subscription Team' };
  if (/verify|verification|document/.test(text)) return { categorySlug: 'verification', priority: 'MEDIUM' as ComplaintPriority, department: 'Verification Team' };
  if (/error|bug|technical|login|crash/.test(text)) return { categorySlug: 'technical', priority: 'HIGH' as ComplaintPriority, department: 'Technical Support' };
  return { categorySlug: 'account', priority: 'MEDIUM' as ComplaintPriority, department: 'Customer Support' };
}
