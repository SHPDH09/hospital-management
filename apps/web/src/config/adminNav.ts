import {
  LayoutDashboard, Building2, Store, Stethoscope, Users, Calendar, CreditCard,
  Receipt, Megaphone, Target, Star, UserCog, Shield, FileText, Headphones,
  MapPin, Database, Mail, Ticket, BarChart3, Settings, Globe, AlertTriangle,
} from 'lucide-react';

export interface AdminNavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const adminNavGroups: AdminNavGroup[] = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    ],
  },
  {
    title: 'Doctor Management',
    items: [
      { to: '/admin/doctor-management', icon: Stethoscope, label: 'DM Dashboard' },
      { to: '/admin/doctor-management/doctors', icon: Stethoscope, label: 'All Doctors' },
    ],
  },
  {
    title: 'Patient Management',
    items: [
      { to: '/admin/patient-management', icon: Users, label: 'PM Dashboard' },
      { to: '/admin/patient-management/patients', icon: Users, label: 'All Patients' },
      { to: '/admin/patient-management/duplicates', icon: Users, label: 'Duplicates' },
    ],
  },
  {
    title: 'Healthcare',
    items: [
      { to: '/admin/hospitals', icon: Building2, label: 'Hospitals' },
      { to: '/admin/clinics', icon: Store, label: 'Clinics' },
    ],
  },
  {
    title: 'Appointment Management',
    items: [
      { to: '/admin/appointment-management', icon: Calendar, label: 'AM Dashboard' },
      { to: '/admin/appointment-management/appointments', icon: Calendar, label: 'All Appointments' },
      { to: '/admin/appointment-management/today', icon: Calendar, label: "Today's Appointments" },
    ],
  },
  {
    title: 'Payment Management',
    items: [
      { to: '/admin/payment-management', icon: Receipt, label: 'PM Dashboard' },
      { to: '/admin/payment-management/payments', icon: CreditCard, label: 'All Payments' },
      { to: '/admin/payment-management/exceptions', icon: AlertTriangle, label: 'Exceptions' },
    ],
  },
  {
    title: 'Lead Management',
    items: [
      { to: '/admin/lead-management', icon: Target, label: 'LM Dashboard' },
      { to: '/admin/lead-management/leads', icon: Target, label: 'All Leads' },
      { to: '/admin/lead-management/follow-ups', icon: Calendar, label: 'Follow-ups' },
      { to: '/admin/lead-management/unassigned', icon: AlertTriangle, label: 'Unassigned' },
      { to: '/admin/lead-management/hot', icon: Target, label: 'Hot Leads' },
    ],
  },
  {
    title: 'Review Management',
    items: [
      { to: '/admin/review-management', icon: Star, label: 'RM Dashboard' },
      { to: '/admin/review-management/reviews', icon: Star, label: 'All Reviews' },
      { to: '/admin/review-management/pending', icon: Star, label: 'Pending Moderation' },
      { to: '/admin/review-management/reported', icon: AlertTriangle, label: 'Reported' },
      { to: '/admin/review-management/fraud', icon: Shield, label: 'Fraud Flags' },
    ],
  },
  {
    title: 'Revenue',
    items: [
      { to: '/admin/subscriptions', icon: CreditCard, label: 'Subscriptions' },
      { to: '/admin/advertisements', icon: Megaphone, label: 'Advertisements' },
      { to: '/admin/coupons', icon: Ticket, label: 'Coupons' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { to: '/admin/staff', icon: UserCog, label: 'Staff' },
      { to: '/admin/roles', icon: Shield, label: 'Roles & Permissions' },
      { to: '/admin/security', icon: Shield, label: 'Security Center' },
      { to: '/admin/audit-logs', icon: FileText, label: 'Audit Logs' },
    ],
  },
  {
    title: 'Support',
    items: [
      { to: '/admin/complaints', icon: Headphones, label: 'Complaints' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { to: '/admin/locations', icon: MapPin, label: 'Locations' },
      { to: '/admin/master-data', icon: Database, label: 'Master Data' },
      { to: '/admin/communications', icon: Mail, label: 'Communications' },
      { to: '/admin/cms', icon: Globe, label: 'CMS' },
      { to: '/admin/settings', icon: Settings, label: 'Settings' },
      { to: '/admin/emergency', icon: AlertTriangle, label: 'Emergency Control' },
    ],
  },
];

export const allAdminNavItems = adminNavGroups.flatMap((g) => g.items);
