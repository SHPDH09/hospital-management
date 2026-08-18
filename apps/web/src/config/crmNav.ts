import {
  LayoutDashboard, Building2, GitBranch, Layers, Stethoscope, UserCog, Shield,
  Users, Calendar, Clock, Briefcase, Package, Target, Megaphone, Mail,
  Receipt, Star, FileText, Bell, BarChart3, CreditCard, Headphones, Settings,
  ScrollText, Share2,
} from 'lucide-react';

export interface CrmNavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}

export interface CrmNavGroup {
  title: string;
  items: CrmNavItem[];
}

export const crmNavGroups: CrmNavGroup[] = [
  {
    title: 'Overview',
    items: [
      { to: '/crm', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/crm/analytics', icon: BarChart3, label: 'Analytics' },
      { to: '/crm/notifications', icon: Bell, label: 'Notifications' },
    ],
  },
  {
    title: 'Organization',
    items: [
      { to: '/crm/profile', icon: Building2, label: 'Hospital Profile' },
      { to: '/crm/branches', icon: GitBranch, label: 'Branches' },
      { to: '/crm/departments', icon: Layers, label: 'Departments' },
      { to: '/crm/documents', icon: FileText, label: 'Documents & Media' },
    ],
  },
  {
    title: 'People',
    items: [
      { to: '/crm/doctors', icon: Stethoscope, label: 'Doctors' },
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
      { to: '/crm/referrals', icon: Share2, label: 'AASHA / Referrals' },
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
      { to: '/crm/subscription', icon: CreditCard, label: 'Subscription' },
      { to: '/crm/support', icon: Headphones, label: 'Support & Complaints' },
      { to: '/crm/settings', icon: Settings, label: 'Settings' },
      { to: '/crm/audit-logs', icon: ScrollText, label: 'Audit Logs' },
    ],
  },
];

export const allCrmNavItems = crmNavGroups.flatMap((g) => g.items);
