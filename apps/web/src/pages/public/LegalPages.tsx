import { Link } from 'react-router-dom';
import { PublicLayout } from '@/components/layouts/PublicLayout';

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <div className="prose prose-sm mt-6 max-w-none text-gray-600 space-y-4">{children}</div>
        <p className="mt-10 text-sm text-gray-400">
          <Link to="/" className="text-primary-600 hover:underline">← Back to home</Link>
        </p>
      </div>
    </PublicLayout>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions">
      <p>Last updated: August 2026</p>
      <p>
        By using the HealthCare Platform website and services, you agree to these Terms & Conditions.
        The platform connects patients with hospitals, clinics, and doctors across India.
      </p>
      <h2 className="text-lg font-semibold text-gray-900">Services</h2>
      <p>
        We provide healthcare discovery, appointment booking, hospital management (CRM), and subscription
        billing for healthcare providers. Subscription plans are billed in Indian Rupees (INR) and may include GST as applicable.
      </p>
      <h2 className="text-lg font-semibold text-gray-900">Payments</h2>
      <p>
        Subscription payments are processed securely through Cashfree Payment Gateway. All prices are displayed in INR.
        By subscribing, you authorize recurring charges as per your selected plan.
      </p>
      <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
      <p>For questions, visit our <Link to="/contact" className="text-primary-600">Contact Us</Link> page.</p>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>Last updated: August 2026</p>
      <p>
        HealthCare Platform respects your privacy. We collect information necessary to provide healthcare
        discovery, appointments, and hospital management services.
      </p>
      <h2 className="text-lg font-semibold text-gray-900">Data we collect</h2>
      <p>Name, email, phone, appointment details, and organization profile data as required for the service.</p>
      <h2 className="text-lg font-semibold text-gray-900">Security</h2>
      <p>We use industry-standard encryption and secure payment processing. Payment card data is handled by Cashfree and never stored on our servers.</p>
    </LegalShell>
  );
}

export function RefundPage() {
  return (
    <LegalShell title="Refunds & Cancellations">
      <p>Last updated: August 2026</p>
      <h2 className="text-lg font-semibold text-gray-900">Subscription refunds</h2>
      <p>
        CRM subscription fees are billed monthly or yearly in INR. Refund requests for unused subscription
        periods may be submitted within 7 days of payment by contacting support with your invoice number.
      </p>
      <h2 className="text-lg font-semibold text-gray-900">Cancellations</h2>
      <p>
        You may cancel auto-renewal at any time from CRM → Subscription. Access continues until the end of the paid billing period.
      </p>
      <h2 className="text-lg font-semibold text-gray-900">Appointment cancellations</h2>
      <p>Appointment cancellation policies are set by individual hospitals and clinics.</p>
      <p>Contact: <Link to="/contact" className="text-primary-600">Contact Us</Link></p>
    </LegalShell>
  );
}

export function ContactPage() {
  return (
    <LegalShell title="Contact Us">
      <p>For support, billing, or partnership enquiries:</p>
      <ul className="list-disc pl-5 space-y-2">
        <li><strong>Email:</strong> support@healthcare.platform</li>
        <li><strong>Platform:</strong> HealthCare — Hospital & Clinic Management</li>
        <li><strong>Services:</strong> Healthcare discovery, CRM subscriptions, appointment management (prices in INR)</li>
      </ul>
      <p className="mt-4">
        Hospitals and clinics can register at <Link to="/register/hospital" className="text-primary-600">Register Hospital</Link>.
      </p>
    </LegalShell>
  );
}
