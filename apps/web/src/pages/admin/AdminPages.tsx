export { AdminDashboard } from './AdminDashboard';
export {
  DoctorManagementDashboardPage, DoctorManagementListPage, DoctorManagementDetailPage,
} from './AdminDoctorManagementPages';
export {
  PatientManagementDashboardPage, PatientManagementListPage, PatientManagementDetailPage, PatientDuplicatesPage,
} from './AdminPatientManagementPages';
export {
  AdminHospitalsPage, AdminClinicsPage, AdminDoctorsPage, AdminPatientsPage,
  AdminAppointmentsPage, AdminPaymentsPage,
} from './AdminResourcePages';
export {
  AdminAdvertisementsPage, AdminCouponsPage,
  AdminLeadsPage, AdminReviewsPage, AdminAnalyticsPage,
} from './AdminCommercePages';
export { AdminSubscriptionsPage } from './AdminSubscriptionPages';
export { AdminMasterDataPage } from './AdminMasterDataPages';
export {
  AdminStaffPage, AdminRolesPage, AdminSecurityPage, AdminAuditLogsPage,
  AdminComplaintsPage, AdminLocationsPage,
  AdminCommunicationsPage, AdminCmsPage, AdminSettingsPage, AdminEmergencyPage,
} from './AdminPlatformPages';

// Legacy aliases
export { AdminHospitalsPage as AdminOrganizationsPage } from './AdminResourcePages';
