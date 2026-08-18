import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import { HomePage } from '@/pages/public/HomePage';
import { FindHospitalsPage, FindClinicsPage, FindDoctorsPage } from '@/pages/public/SearchPages';
import {
  LoginPage, DoctorLoginPage, HospitalLoginPage,
  StaffLoginPage, AdminLoginPage, RegisterPage, RegisterHospitalPage,
} from '@/pages/public/AuthPages';
import { PatientLoginPage } from '@/pages/public/PatientLoginPage';
import { PatientCompleteProfilePage } from '@/pages/patient/PatientCompleteProfilePage';
import { ForgotPasswordPage } from '@/pages/public/ForgotPasswordPage';
import { OrganizationDetailPage } from '@/pages/public/OrganizationDetailPage';
import { DoctorDetailPage } from '@/pages/public/DoctorDetailPage';
import { BookAppointmentPage } from '@/pages/public/BookAppointmentPage';
import { ReferralLandingPage } from '@/pages/public/ReferralLandingPage';
import { PatientDashboard, PatientAppointmentsPage } from '@/pages/patient/PatientPages';

import { CrmDashboard } from '@/pages/crm/CrmDashboard';
import {
  CrmPatientsPage, CrmDoctorsPage, CrmAppointmentsPage, CrmBillingPage,
} from '@/pages/crm/CrmPages';
import {
  CrmProfilePage, CrmBranchesPage, CrmDepartmentsPage, CrmStaffPage, CrmRolesPage,
  CrmServicesPage, CrmHealthPackagesPage, CrmLeadsPage, CrmReviewsPage, CrmAdvertisementsPage,
  CrmCommunicationsPage, CrmSubscriptionPage, CrmSupportPage, CrmAnalyticsPage,
  CrmDocumentsPage, CrmNotificationsPage, CrmAuditLogsPage, CrmSchedulePage, CrmSettingsPage,
} from '@/pages/crm/CrmModulePages';
import {
  CrmReferralDashboardPage, CrmReferralListPage, CrmAshaCreatePage, CrmPartnerCreatePage,
  CrmReferredPatientsPage, CrmReferralCommissionsPage, CrmReferralLeaderboardPage,
  CrmReferralAnalyticsPage, CrmReferralSettingsPage, CrmReferralCampaignsPage,
} from '@/pages/crm/CrmReferralPages';
import {
  ReferralDashboardPage, ReferralProfilePage, ReferralHospitalsPage, ReferralPatientsPage,
  ReferralAnalyticsPage, ReferralCommissionsPage, ReferralPayoutsPage, ReferralCampaignsPage,
} from '@/pages/referral/ReferralPortalPages';
import {
  AdminDashboard, AdminHospitalsPage, AdminClinicsPage, AdminDoctorsPage, AdminPatientsPage,
  AdminAppointmentsPage, AdminPaymentsPage, AdminSubscriptionsPage, AdminAdvertisementsPage,
  AdminCouponsPage, AdminLeadsPage, AdminReviewsPage, AdminAnalyticsPage,
  AdminStaffPage, AdminPermissionsPage, AdminSupportPage, AdminSecurityPage, AdminAuditLogsPage,
  AdminLocationsPage, AdminMasterDataPage,
  AdminCommunicationsPage, AdminCmsPage, AdminSettingsPage, AdminEmergencyPage,
} from '@/pages/admin/AdminPages';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });

const ADMIN_ROLES = ['SUPER_ADMIN', 'PLATFORM_STAFF'] as const;
const CRM_ROLES = ['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'ACCOUNTANT', 'PHARMACIST', 'LAB_STAFF', 'MANAGER'] as const;

const REFERRAL_ROLES = ['ASHA', 'REFERRAL_PARTNER'] as const;

function Admin({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute roles={[...ADMIN_ROLES]}>{children}</ProtectedRoute>;
}

function Crm({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute roles={[...CRM_ROLES]}>{children}</ProtectedRoute>;
}

function CrmAdmin({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN']}>{children}</ProtectedRoute>;
}

function Referral({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute roles={[...REFERRAL_ROLES]}>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/find/hospitals" element={<FindHospitalsPage />} />
            <Route path="/find/clinics" element={<FindClinicsPage />} />
            <Route path="/find/doctors" element={<FindDoctorsPage />} />
            <Route path="/organizations/:slug" element={<OrganizationDetailPage />} />
            <Route path="/doctors/:id" element={<DoctorDetailPage />} />
            <Route path="/book" element={<BookAppointmentPage />} />
            <Route path="/book/:slug" element={<BookAppointmentPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/patient" element={<PatientLoginPage />} />
            <Route path="/login/doctor" element={<DoctorLoginPage />} />
            <Route path="/login/hospital" element={<HospitalLoginPage />} />
            <Route path="/login/staff" element={<StaffLoginPage />} />
            <Route path="/login/admin" element={<AdminLoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register/hospital" element={<RegisterHospitalPage />} />

            <Route path="/ref/:code" element={<ReferralLandingPage />} />

            <Route path="/patient" element={<ProtectedRoute roles={['PATIENT']}><PatientDashboard /></ProtectedRoute>} />
            <Route path="/patient/appointments" element={<ProtectedRoute roles={['PATIENT']}><PatientAppointmentsPage /></ProtectedRoute>} />
            <Route path="/patient/complete-profile" element={<ProtectedRoute roles={['PATIENT']} allowIncompleteProfile><PatientCompleteProfilePage /></ProtectedRoute>} />

            <Route path="/crm" element={<Crm><CrmDashboard /></Crm>} />
            <Route path="/crm/analytics" element={<Crm><CrmAnalyticsPage /></Crm>} />
            <Route path="/crm/notifications" element={<Crm><CrmNotificationsPage /></Crm>} />
            <Route path="/crm/profile" element={<CrmAdmin><CrmProfilePage /></CrmAdmin>} />
            <Route path="/crm/branches" element={<CrmAdmin><CrmBranchesPage /></CrmAdmin>} />
            <Route path="/crm/departments" element={<CrmAdmin><CrmDepartmentsPage /></CrmAdmin>} />
            <Route path="/crm/documents" element={<CrmAdmin><CrmDocumentsPage /></CrmAdmin>} />
            <Route path="/crm/doctors" element={<CrmAdmin><CrmDoctorsPage /></CrmAdmin>} />
            <Route path="/crm/staff" element={<CrmAdmin><CrmStaffPage /></CrmAdmin>} />
            <Route path="/crm/roles" element={<CrmAdmin><CrmRolesPage /></CrmAdmin>} />
            <Route path="/crm/patients" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'ACCOUNTANT']}><CrmPatientsPage /></ProtectedRoute>} />
            <Route path="/crm/appointments" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE']}><CrmAppointmentsPage /></ProtectedRoute>} />
            <Route path="/crm/schedule" element={<CrmAdmin><CrmSchedulePage /></CrmAdmin>} />
            <Route path="/crm/services" element={<CrmAdmin><CrmServicesPage /></CrmAdmin>} />
            <Route path="/crm/health-packages" element={<CrmAdmin><CrmHealthPackagesPage /></CrmAdmin>} />
            <Route path="/crm/billing" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']}><CrmBillingPage /></ProtectedRoute>} />
            <Route path="/crm/leads" element={<Crm><CrmLeadsPage /></Crm>} />
            <Route path="/crm/advertisements" element={<CrmAdmin><CrmAdvertisementsPage /></CrmAdmin>} />
            <Route path="/crm/reviews" element={<Crm><CrmReviewsPage /></Crm>} />
            <Route path="/crm/communications" element={<Crm><CrmCommunicationsPage /></Crm>} />
            <Route path="/crm/subscription" element={<CrmAdmin><CrmSubscriptionPage /></CrmAdmin>} />
            <Route path="/crm/support" element={<Crm><CrmSupportPage /></Crm>} />
            <Route path="/crm/settings" element={<CrmAdmin><CrmSettingsPage /></CrmAdmin>} />
            <Route path="/crm/audit-logs" element={<CrmAdmin><CrmAuditLogsPage /></CrmAdmin>} />

            <Route path="/crm/referrals" element={<CrmAdmin><CrmReferralDashboardPage /></CrmAdmin>} />
            <Route path="/crm/referrals/list" element={<CrmAdmin><CrmReferralListPage /></CrmAdmin>} />
            <Route path="/crm/referrals/asha/new" element={<CrmAdmin><CrmAshaCreatePage /></CrmAdmin>} />
            <Route path="/crm/referrals/partners/new" element={<CrmAdmin><CrmPartnerCreatePage /></CrmAdmin>} />
            <Route path="/crm/referrals/patients" element={<CrmAdmin><CrmReferredPatientsPage /></CrmAdmin>} />
            <Route path="/crm/referrals/commissions" element={<CrmAdmin><CrmReferralCommissionsPage /></CrmAdmin>} />
            <Route path="/crm/referrals/leaderboard" element={<CrmAdmin><CrmReferralLeaderboardPage /></CrmAdmin>} />
            <Route path="/crm/referrals/analytics" element={<CrmAdmin><CrmReferralAnalyticsPage /></CrmAdmin>} />
            <Route path="/crm/referrals/settings" element={<CrmAdmin><CrmReferralSettingsPage /></CrmAdmin>} />
            <Route path="/crm/referrals/campaigns" element={<CrmAdmin><CrmReferralCampaignsPage /></CrmAdmin>} />

            <Route path="/referral" element={<Referral><ReferralDashboardPage /></Referral>} />
            <Route path="/referral/profile" element={<Referral><ReferralProfilePage /></Referral>} />
            <Route path="/referral/hospitals" element={<Referral><ReferralHospitalsPage /></Referral>} />
            <Route path="/referral/patients" element={<Referral><ReferralPatientsPage /></Referral>} />
            <Route path="/referral/analytics" element={<Referral><ReferralAnalyticsPage /></Referral>} />
            <Route path="/referral/commissions" element={<Referral><ReferralCommissionsPage /></Referral>} />
            <Route path="/referral/payouts" element={<Referral><ReferralPayoutsPage /></Referral>} />
            <Route path="/referral/campaigns" element={<Referral><ReferralCampaignsPage /></Referral>} />

            {/* Super Admin — 24 modules */}
            <Route path="/admin" element={<Admin><AdminDashboard /></Admin>} />
            <Route path="/admin/analytics" element={<Admin><AdminAnalyticsPage /></Admin>} />
            <Route path="/admin/hospitals" element={<Admin><AdminHospitalsPage /></Admin>} />
            <Route path="/admin/clinics" element={<Admin><AdminClinicsPage /></Admin>} />
            <Route path="/admin/organizations" element={<Admin><AdminHospitalsPage /></Admin>} />
            <Route path="/admin/doctors" element={<Admin><AdminDoctorsPage /></Admin>} />
            <Route path="/admin/patients" element={<Admin><AdminPatientsPage /></Admin>} />
            <Route path="/admin/appointments" element={<Admin><AdminAppointmentsPage /></Admin>} />
            <Route path="/admin/payments" element={<Admin><AdminPaymentsPage /></Admin>} />
            <Route path="/admin/subscriptions/*" element={<Admin><AdminSubscriptionsPage /></Admin>} />
            <Route path="/admin/advertisements/*" element={<Admin><AdminAdvertisementsPage /></Admin>} />
            <Route path="/admin/coupons" element={<Admin><AdminCouponsPage /></Admin>} />
            <Route path="/admin/leads" element={<Admin><AdminLeadsPage /></Admin>} />
            <Route path="/admin/reviews" element={<Admin><AdminReviewsPage /></Admin>} />
            <Route path="/admin/staff/*" element={<Admin><AdminStaffPage /></Admin>} />
            <Route path="/admin/permissions/*" element={<Admin><AdminPermissionsPage /></Admin>} />
            <Route path="/admin/roles" element={<Navigate to="/admin/permissions" replace />} />
            <Route path="/admin/security" element={<Admin><AdminSecurityPage /></Admin>} />
            <Route path="/admin/audit-logs" element={<Admin><AdminAuditLogsPage /></Admin>} />
            <Route path="/admin/support/*" element={<Admin><AdminSupportPage /></Admin>} />
            <Route path="/admin/complaints" element={<Navigate to="/admin/support" replace />} />
            <Route path="/admin/locations" element={<Admin><AdminLocationsPage /></Admin>} />
            <Route path="/admin/master-data/*" element={<Admin><AdminMasterDataPage /></Admin>} />
            <Route path="/admin/communications/*" element={<Admin><AdminCommunicationsPage /></Admin>} />
            <Route path="/admin/cms/*" element={<Admin><AdminCmsPage /></Admin>} />
            <Route path="/admin/settings/*" element={<Admin><AdminSettingsPage /></Admin>} />
            <Route path="/admin/emergency/*" element={<Admin><AdminEmergencyPage /></Admin>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
