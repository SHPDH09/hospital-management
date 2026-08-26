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
import { ForgotPasswordPage } from '@/pages/public/ForgotPasswordPage';
import { PatientCompleteProfilePage } from '@/pages/patient/PatientCompleteProfilePage';
import { OrganizationDetailPage } from '@/pages/public/OrganizationDetailPage';
import { DoctorDetailPage } from '@/pages/public/DoctorDetailPage';
import { BookAppointmentPage } from '@/pages/public/BookAppointmentPage';

import { PatientDashboard, PatientAppointmentsPage } from '@/pages/patient/PatientPages';
import {
  CrmDashboard, CrmPatientsPage, CrmDoctorsPage, CrmAppointmentsPage, CrmBillingPage, CrmSettingsPage, CrmCopilotPage,
} from '@/pages/crm/CrmPages';
import {
  AdminDashboard, AdminHospitalsPage, AdminClinicsPage, AdminDoctorsPage, AdminPatientsPage,
  AdminAppointmentsPage, AdminPaymentsPage, AdminSubscriptionsPage, AdminAdvertisementsPage,
  AdminCouponsPage, AdminLeadsPage, AdminReviewsPage, AdminAnalyticsPage,
  AdminStaffPage, AdminSecurityPage, AdminAuditLogsPage,
  AdminLocationsPage, AdminMasterDataPage,
  AdminCommunicationsPage, AdminCmsPage, AdminSettingsPage, AdminEmergencyPage,
  AdminPermissionsPage, AdminSupportPage,
  AdminAiCopilotPage, AdminAutomationPage, AdminAiSettingsPage, AdminAiAuditPage, AdminAiInsightsPage, AdminApprovalsPage,
  AdminReferralsPage,
  LeadManagementDashboardPage, LeadManagementListPage, LeadManagementDetailPage, LeadFollowUpsPage,
  ReviewManagementDashboardPage, ReviewManagementListPage, ReviewManagementDetailPage, ReviewFraudFlagsPage,
  PaymentManagementDashboardPage, PaymentManagementListPage, PaymentManagementDetailPage, PaymentExceptionsPage,
  AdminVerificationDashboardPage, AdminVerificationApplicationsPage, AdminVerificationDetailPage,
} from '@/pages/admin/AdminPages';
import { ReferralLandingPage } from '@/pages/public/ReferralLandingPage';
import {
  ReferralDashboardPage, ReferralProfilePage, ReferralHospitalsPage, ReferralPatientsPage,
  ReferralAnalyticsPage, ReferralCommissionsPage, ReferralPayoutsPage, ReferralCampaignsPage,
} from '@/pages/referral/ReferralPortalPages';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });

const ADMIN_ROLES = ['SUPER_ADMIN', 'PLATFORM_STAFF'] as const;
const REFERRAL_ROLES = ['ASHA', 'REFERRAL_PARTNER'] as const;
const CRM_ROLES = ['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'ACCOUNTANT', 'PHARMACIST', 'LAB_STAFF', 'MANAGER'] as const;

function Admin({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute roles={[...ADMIN_ROLES]}>{children}</ProtectedRoute>;
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

            <Route path="/referral" element={<ProtectedRoute roles={[...REFERRAL_ROLES]}><ReferralDashboardPage /></ProtectedRoute>} />
            <Route path="/referral/profile" element={<ProtectedRoute roles={[...REFERRAL_ROLES]}><ReferralProfilePage /></ProtectedRoute>} />
            <Route path="/referral/hospitals" element={<ProtectedRoute roles={[...REFERRAL_ROLES]}><ReferralHospitalsPage /></ProtectedRoute>} />
            <Route path="/referral/patients" element={<ProtectedRoute roles={[...REFERRAL_ROLES]}><ReferralPatientsPage /></ProtectedRoute>} />
            <Route path="/referral/analytics" element={<ProtectedRoute roles={[...REFERRAL_ROLES]}><ReferralAnalyticsPage /></ProtectedRoute>} />
            <Route path="/referral/commissions" element={<ProtectedRoute roles={[...REFERRAL_ROLES]}><ReferralCommissionsPage /></ProtectedRoute>} />
            <Route path="/referral/payouts" element={<ProtectedRoute roles={[...REFERRAL_ROLES]}><ReferralPayoutsPage /></ProtectedRoute>} />
            <Route path="/referral/campaigns" element={<ProtectedRoute roles={[...REFERRAL_ROLES]}><ReferralCampaignsPage /></ProtectedRoute>} />

            <Route path="/patient" element={<ProtectedRoute roles={['PATIENT']}><PatientDashboard /></ProtectedRoute>} />
            <Route path="/patient/appointments" element={<ProtectedRoute roles={['PATIENT']}><PatientAppointmentsPage /></ProtectedRoute>} />
            <Route path="/patient/complete-profile" element={<ProtectedRoute roles={['PATIENT']} allowIncompleteProfile><PatientCompleteProfilePage /></ProtectedRoute>} />

            <Route path="/crm" element={<ProtectedRoute roles={[...CRM_ROLES]}><CrmDashboard /></ProtectedRoute>} />
            <Route path="/crm/copilot" element={<ProtectedRoute roles={[...CRM_ROLES]}><CrmCopilotPage /></ProtectedRoute>} />
            <Route path="/crm/patients" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'ACCOUNTANT']}><CrmPatientsPage /></ProtectedRoute>} />
            <Route path="/crm/doctors" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN']}><CrmDoctorsPage /></ProtectedRoute>} />
            <Route path="/crm/appointments" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE']}><CrmAppointmentsPage /></ProtectedRoute>} />
            <Route path="/crm/billing" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']}><CrmBillingPage /></ProtectedRoute>} />
            <Route path="/crm/settings" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN']}><CrmSettingsPage /></ProtectedRoute>} />

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
            <Route path="/admin/advertisements" element={<Admin><AdminAdvertisementsPage /></Admin>} />
            <Route path="/admin/coupons" element={<Admin><AdminCouponsPage /></Admin>} />
            <Route path="/admin/leads" element={<Admin><AdminLeadsPage /></Admin>} />
            <Route path="/admin/lead-management" element={<Admin><LeadManagementDashboardPage /></Admin>} />
            <Route path="/admin/lead-management/leads" element={<Admin><LeadManagementListPage /></Admin>} />
            <Route path="/admin/lead-management/leads/:id" element={<Admin><LeadManagementDetailPage /></Admin>} />
            <Route path="/admin/lead-management/follow-ups" element={<Admin><LeadFollowUpsPage /></Admin>} />
            <Route path="/admin/lead-management/unassigned" element={<Admin><LeadManagementListPage unassignedOnly title="Unassigned Leads" /></Admin>} />
            <Route path="/admin/reviews" element={<Admin><AdminReviewsPage /></Admin>} />
            <Route path="/admin/review-management" element={<Admin><ReviewManagementDashboardPage /></Admin>} />
            <Route path="/admin/review-management/reviews" element={<Admin><ReviewManagementListPage /></Admin>} />
            <Route path="/admin/review-management/reviews/:id" element={<Admin><ReviewManagementDetailPage /></Admin>} />
            <Route path="/admin/review-management/pending" element={<Admin><ReviewManagementListPage presetStatus="PENDING" title="Pending Moderation" /></Admin>} />
            <Route path="/admin/review-management/reported" element={<Admin><ReviewManagementListPage reportedOnly title="Reported Reviews" /></Admin>} />
            <Route path="/admin/review-management/fraud" element={<Admin><ReviewFraudFlagsPage /></Admin>} />
            <Route path="/admin/payment-management" element={<Admin><PaymentManagementDashboardPage /></Admin>} />
            <Route path="/admin/payment-management/payments" element={<Admin><PaymentManagementListPage /></Admin>} />
            <Route path="/admin/payment-management/payments/:id" element={<Admin><PaymentManagementDetailPage /></Admin>} />
            <Route path="/admin/payment-management/exceptions" element={<Admin><PaymentExceptionsPage /></Admin>} />
            <Route path="/admin/referrals/*" element={<Admin><AdminReferralsPage /></Admin>} />
            <Route path="/admin/verification" element={<Admin><AdminVerificationDashboardPage /></Admin>} />
            <Route path="/admin/verification/applications" element={<Admin><AdminVerificationApplicationsPage /></Admin>} />
            <Route path="/admin/verification/applications/:id" element={<Admin><AdminVerificationDetailPage /></Admin>} />
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
            <Route path="/admin/ai/copilot" element={<Admin><AdminAiCopilotPage /></Admin>} />
            <Route path="/admin/ai/insights" element={<Admin><AdminAiInsightsPage /></Admin>} />
            <Route path="/admin/ai/approvals" element={<Admin><AdminApprovalsPage /></Admin>} />
            <Route path="/admin/ai/automation" element={<Admin><AdminAutomationPage /></Admin>} />
            <Route path="/admin/ai/settings" element={<Admin><AdminAiSettingsPage /></Admin>} />
            <Route path="/admin/ai/audit" element={<Admin><AdminAiAuditPage /></Admin>} />
            <Route path="/admin/ai" element={<Admin><AdminAiCopilotPage /></Admin>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
