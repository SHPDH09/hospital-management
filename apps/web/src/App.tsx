import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

import { HomePage } from '@/pages/public/HomePage';
import { FindHospitalsPage, FindClinicsPage, FindDoctorsPage } from '@/pages/public/SearchPages';
import { LoginPage, RegisterPage, RegisterHospitalPage } from '@/pages/public/AuthPages';
import { OrganizationDetailPage } from '@/pages/public/OrganizationDetailPage';
import { DoctorDetailPage } from '@/pages/public/DoctorDetailPage';

import { PatientDashboard, PatientAppointmentsPage } from '@/pages/patient/PatientPages';
import {
  CrmDashboard,
  CrmPatientsPage,
  CrmDoctorsPage,
  CrmAppointmentsPage,
  CrmBillingPage,
  CrmSettingsPage,
} from '@/pages/crm/CrmPages';
import {
  AdminDashboard,
  AdminOrganizationsPage,
  AdminSubscriptionsPage,
  AdminAdvertisementsPage,
} from '@/pages/admin/AdminPages';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/find/hospitals" element={<FindHospitalsPage />} />
            <Route path="/find/clinics" element={<FindClinicsPage />} />
            <Route path="/find/doctors" element={<FindDoctorsPage />} />
            <Route path="/organizations/:slug" element={<OrganizationDetailPage />} />
            <Route path="/doctors/:id" element={<DoctorDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register/hospital" element={<RegisterHospitalPage />} />

            {/* Patient Portal */}
            <Route path="/patient" element={<ProtectedRoute roles={['PATIENT']}><PatientDashboard /></ProtectedRoute>} />
            <Route path="/patient/appointments" element={<ProtectedRoute roles={['PATIENT']}><PatientAppointmentsPage /></ProtectedRoute>} />

            {/* Hospital CRM */}
            <Route path="/crm" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'ACCOUNTANT', 'PHARMACIST', 'LAB_STAFF', 'MANAGER']}><CrmDashboard /></ProtectedRoute>} />
            <Route path="/crm/patients" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE', 'ACCOUNTANT']}><CrmPatientsPage /></ProtectedRoute>} />
            <Route path="/crm/doctors" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN']}><CrmDoctorsPage /></ProtectedRoute>} />
            <Route path="/crm/appointments" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'DOCTOR', 'RECEPTIONIST', 'NURSE']}><CrmAppointmentsPage /></ProtectedRoute>} />
            <Route path="/crm/billing" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']}><CrmBillingPage /></ProtectedRoute>} />
            <Route path="/crm/settings" element={<ProtectedRoute roles={['HOSPITAL_ADMIN', 'BRANCH_ADMIN']}><CrmSettingsPage /></ProtectedRoute>} />

            {/* Super Admin */}
            <Route path="/admin" element={<ProtectedRoute roles={['SUPER_ADMIN', 'PLATFORM_STAFF']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/organizations" element={<ProtectedRoute roles={['SUPER_ADMIN', 'PLATFORM_STAFF']}><AdminOrganizationsPage /></ProtectedRoute>} />
            <Route path="/admin/subscriptions" element={<ProtectedRoute roles={['SUPER_ADMIN', 'PLATFORM_STAFF']}><AdminSubscriptionsPage /></ProtectedRoute>} />
            <Route path="/admin/advertisements" element={<ProtectedRoute roles={['SUPER_ADMIN', 'PLATFORM_STAFF']}><AdminAdvertisementsPage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
