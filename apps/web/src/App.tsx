import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import { HomePage } from '@/pages/public/HomePage';
import { FindHospitalsPage, FindClinicsPage, FindDoctorsPage } from '@/pages/public/SearchPages';
import {
  LoginPage, PatientLoginPage, DoctorLoginPage, HospitalLoginPage,
  StaffLoginPage, AdminLoginPage, RegisterPage, RegisterHospitalPage,
} from '@/pages/public/AuthPages';
import { OrganizationDetailPage } from '@/pages/public/OrganizationDetailPage';
import { DoctorDetailPage } from '@/pages/public/DoctorDetailPage';
import { BookAppointmentPage } from '@/pages/public/BookAppointmentPage';

import { PatientDashboard, PatientAppointmentsPage } from '@/pages/patient/PatientPages';
import {
  CrmDashboard, CrmPatientsPage, CrmDoctorsPage, CrmAppointmentsPage, CrmBillingPage, CrmSettingsPage,
} from '@/pages/crm/CrmPages';
import {
  AdminDashboard, AdminHospitalsPage, AdminClinicsPage,
  AdminSubscriptionsPage, AdminAdvertisementsPage,
  AdminCouponsPage, AdminLeadsPage, AdminReviewsPage, AdminAnalyticsPage,
  AdminStaffPage, AdminRolesPage, AdminSecurityPage, AdminAuditLogsPage,
  AdminComplaintsPage, AdminLocationsPage, AdminMasterDataPage,
  AdminCommunicationsPage, AdminCmsPage, AdminSettingsPage, AdminEmergencyPage,
  DoctorManagementDashboardPage, DoctorManagementListPage, DoctorManagementDetailPage,
  PatientManagementDashboardPage, PatientManagementListPage, PatientManagementDetailPage, PatientDuplicatesPage,
  AppointmentManagementDashboardPage, AppointmentManagementListPage, AppointmentManagementDetailPage,
  PaymentManagementDashboardPage, PaymentManagementListPage, PaymentManagementDetailPage, PaymentExceptionsPage,
} from '@/pages/admin/AdminPages';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30000 } } });

const ADMIN_ROLES = ['SUPER_ADMIN', 'PLATFORM_STAFF'] as const;
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
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register/hospital" element={<RegisterHospitalPage />} />

            <Route path="/patient" element={<ProtectedRoute roles={['PATIENT']}><PatientDashboard /></ProtectedRoute>} />
            <Route path="/patient/appointments" element={<ProtectedRoute roles={['PATIENT']}><PatientAppointmentsPage /></ProtectedRoute>} />

            <Route path="/crm" element={<ProtectedRoute roles={[...CRM_ROLES]}><CrmDashboard /></ProtectedRoute>} />
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
            <Route path="/admin/doctor-management" element={<Admin><DoctorManagementDashboardPage /></Admin>} />
            <Route path="/admin/doctor-management/doctors" element={<Admin><DoctorManagementListPage /></Admin>} />
            <Route path="/admin/doctor-management/doctors/:id" element={<Admin><DoctorManagementDetailPage /></Admin>} />
            <Route path="/admin/doctors" element={<Navigate to="/admin/doctor-management/doctors" replace />} />
            <Route path="/admin/patient-management" element={<Admin><PatientManagementDashboardPage /></Admin>} />
            <Route path="/admin/patient-management/patients" element={<Admin><PatientManagementListPage /></Admin>} />
            <Route path="/admin/patient-management/patients/:id" element={<Admin><PatientManagementDetailPage /></Admin>} />
            <Route path="/admin/patient-management/duplicates" element={<Admin><PatientDuplicatesPage /></Admin>} />
            <Route path="/admin/patients" element={<Navigate to="/admin/patient-management/patients" replace />} />
            <Route path="/admin/appointment-management" element={<Admin><AppointmentManagementDashboardPage /></Admin>} />
            <Route path="/admin/appointment-management/appointments" element={<Admin><AppointmentManagementListPage /></Admin>} />
            <Route path="/admin/appointment-management/appointments/:id" element={<Admin><AppointmentManagementDetailPage /></Admin>} />
            <Route path="/admin/appointment-management/today" element={<Admin><AppointmentManagementListPage todayOnly /></Admin>} />
            <Route path="/admin/appointments" element={<Navigate to="/admin/appointment-management/appointments" replace />} />
            <Route path="/admin/payment-management" element={<Admin><PaymentManagementDashboardPage /></Admin>} />
            <Route path="/admin/payment-management/payments" element={<Admin><PaymentManagementListPage /></Admin>} />
            <Route path="/admin/payment-management/payments/:id" element={<Admin><PaymentManagementDetailPage /></Admin>} />
            <Route path="/admin/payment-management/exceptions" element={<Admin><PaymentExceptionsPage /></Admin>} />
            <Route path="/admin/payments" element={<Navigate to="/admin/payment-management/payments" replace />} />
            <Route path="/admin/subscriptions/*" element={<Admin><AdminSubscriptionsPage /></Admin>} />
            <Route path="/admin/advertisements" element={<Admin><AdminAdvertisementsPage /></Admin>} />
            <Route path="/admin/coupons" element={<Admin><AdminCouponsPage /></Admin>} />
            <Route path="/admin/leads" element={<Admin><AdminLeadsPage /></Admin>} />
            <Route path="/admin/reviews" element={<Admin><AdminReviewsPage /></Admin>} />
            <Route path="/admin/staff" element={<Admin><AdminStaffPage /></Admin>} />
            <Route path="/admin/roles" element={<Admin><AdminRolesPage /></Admin>} />
            <Route path="/admin/security" element={<Admin><AdminSecurityPage /></Admin>} />
            <Route path="/admin/audit-logs" element={<Admin><AdminAuditLogsPage /></Admin>} />
            <Route path="/admin/complaints" element={<Admin><AdminComplaintsPage /></Admin>} />
            <Route path="/admin/locations" element={<Admin><AdminLocationsPage /></Admin>} />
            <Route path="/admin/master-data/*" element={<Admin><AdminMasterDataPage /></Admin>} />
            <Route path="/admin/communications" element={<Admin><AdminCommunicationsPage /></Admin>} />
            <Route path="/admin/cms" element={<Admin><AdminCmsPage /></Admin>} />
            <Route path="/admin/settings" element={<Admin><AdminSettingsPage /></Admin>} />
            <Route path="/admin/emergency" element={<Admin><AdminEmergencyPage /></Admin>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
