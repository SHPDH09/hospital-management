import {
  LayoutDashboard, Building2, Store, Stethoscope, Users, Calendar, CreditCard,
  Receipt, Megaphone, Target, Star, UserCog, Shield, FileText, Headphones,
  MapPin, Database, Mail, Ticket, BarChart3, Settings, Globe, AlertTriangle, Bot,
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
      { to: '/admin/ai/copilot', icon: Bot, label: 'AI Copilot' },
    ],
  },
  {
    title: 'Healthcare',
    items: [
      { to: '/admin/hospitals', icon: Building2, label: 'Hospitals' },
      { to: '/admin/clinics', icon: Store, label: 'Clinics' },
      { to: '/admin/doctors', icon: Stethoscope, label: 'Doctors' },
      { to: '/admin/patients', icon: Users, label: 'Patients' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/admin/appointments', icon: Calendar, label: 'Appointments' },
      { to: '/admin/payments', icon: Receipt, label: 'Payments' },
      { to: '/admin/leads', icon: Target, label: 'Leads' },
      { to: '/admin/reviews', icon: Star, label: 'Reviews' },
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
      { to: '/admin/ai/automation', icon: Bot, label: 'Automations' },
      { to: '/admin/ai/settings', icon: Settings, label: 'AI Settings' },
      { to: '/admin/cms', icon: Globe, label: 'CMS' },
      { to: '/admin/settings', icon: Settings, label: 'Settings' },
      { to: '/admin/emergency', icon: AlertTriangle, label: 'Emergency Control' },
    ],
  },
];

export const allAdminNavItems = adminNavGroups.flatMap((g) => g.items);
