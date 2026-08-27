import {
  LayoutDashboard, Building2, GitBranch, Layers, Stethoscope, UserCog, Shield,
  Users, Calendar, Clock, Briefcase, Package, Target, Megaphone, Mail,
  Receipt, Star, FileText, Bell, BarChart3, CreditCard, Headphones, Settings,
  ScrollText,
} from 'lucide-react';

export interface CrmNavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  /** 'basic' = available when subscription expired; omit = requires full access */
  access?: 'basic';
}

export interface CrmNavGroup {
  title: string;
  items: CrmNavItem[];
}

export const crmNavGroups: CrmNavGroup[] = [
  {
    title: 'Overview',
    items: [
      { to: '/crm', icon: LayoutDashboard, label: 'Dashboard', access: 'basic' },
      { to: '/crm/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/crm/notifications', icon: Bell, label: 'Notifications', access: 'basic' },
    ],
  },
  {
    title: 'Organization',
    items: [
      { to: '/crm/profile', icon: Building2, label: 'Hospital Profile', access: 'basic' },
      { to: '/crm/branches', icon: GitBranch, label: 'Branches' },
      { to: '/crm/departments', icon: Layers, label: 'Departments' },
      { to: '/crm/documents', icon: FileText, label: 'Documents & Media' },
    ],
  },
  {
    title: 'People',
    items: [
      { to: '/crm/doctors', icon: Stethoscope, label: 'Doctors', access: 'basic' },
      { to: '/crm/staff', icon: UserCog, label: 'Staff' },
      { to: '/crm/roles', icon: Shield, label: 'Roles & Permissions' },
      { to: '/crm/patients', icon: Users, label: 'Patients' },
    ],
  },
  {
    title: 'Clinical Ops',
    items: [
      { to: '/crm/appointments', icon: Calendar, label: 'Appointments' },
      { to: '/crm/schedule', icon: Clock, label: 'Doctor Schedule' },
      { to: '/crm/services', icon: Briefcase, label: 'Services' },
      { to: '/crm/health-packages', icon: Package, label: 'Health Packages' },
    ],
  },
  {
    title: 'Revenue & Marketing',
    items: [
      { to: '/crm/billing', icon: Receipt, label: 'Billing & Payments' },
      { to: '/crm/leads', icon: Target, label: 'Leads' },
      { to: '/crm/advertisements', icon: Megaphone, label: 'Advertisements' },
      { to: '/crm/reviews', icon: Star, label: 'Reviews & Ratings' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { to: '/crm/communications', icon: Mail, label: 'Communication Center' },
    ],
  },
  {
    title: 'Platform',
    items: [
      { to: '/crm/subscription', icon: CreditCard, label: 'Subscription', access: 'basic' },
      { to: '/crm/support', icon: Headphones, label: 'Support & Complaints', access: 'basic' },
      { to: '/crm/settings', icon: Settings, label: 'Settings' },
      { to: '/crm/audit-logs', icon: ScrollText, label: 'Audit Logs' },
    ],
  },
];

export const allCrmNavItems = crmNavGroups.flatMap((g) => g.items);
