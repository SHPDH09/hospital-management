import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('Password123!', 12);

  // Subscription plans
  const planDefs = [
    { code: 'free', tier: 'FREE' as const, name: 'Free', monthlyPrice: 0, yearlyPrice: 0, trialDays: 0, isDefault: false, sortOrder: 1,
      features: ['Basic Listing', 'Up to 2 Doctors'], userLimit: 5, doctorLimit: 2, patientLimit: 50, branchLimit: 1, appointmentLimit: 100 },
    { code: 'basic', tier: 'BASIC' as const, name: 'Basic', monthlyPrice: 999, yearlyPrice: 9999, trialDays: 14, isDefault: true, sortOrder: 2,
      features: ['Patient Management', 'Appointments', 'Basic Dashboard', 'Billing'], userLimit: 20, doctorLimit: 10, patientLimit: 500, branchLimit: 2, appointmentLimit: 1000 },
    { code: 'professional', tier: 'PROFESSIONAL' as const, name: 'Professional', monthlyPrice: 2499, yearlyPrice: 24999, trialDays: 14, isDefault: false, sortOrder: 3,
      features: ['Everything in Basic', 'Staff Management', 'Reports', 'Inventory', 'Communication'], userLimit: 100, doctorLimit: 50, patientLimit: 5000, branchLimit: 10, appointmentLimit: 10000 },
    { code: 'enterprise', tier: 'ENTERPRISE' as const, name: 'Enterprise', monthlyPrice: null, yearlyPrice: null, trialDays: 30, isDefault: false, sortOrder: 4,
      features: ['Multi-branch', 'Advanced Analytics', 'API Access', 'Custom Branding', 'Dedicated Support'], userLimit: null, doctorLimit: null, patientLimit: null, branchLimit: null, appointmentLimit: null },
  ];

  const plans = await Promise.all(planDefs.map((p) =>
    prisma.subscriptionPlan.upsert({
      where: { code: p.code },
      update: { isDefault: p.isDefault, monthlyPrice: p.monthlyPrice ?? undefined, yearlyPrice: p.yearlyPrice ?? undefined },
      create: { ...p, price: p.monthlyPrice ?? 0, features: p.features, isActive: true },
    })
  ));

  // Super Admin (demo)
  await prisma.user.upsert({
    where: { email: 'admin@healthcare.platform' },
    update: {},
    create: {
      email: 'admin@healthcare.platform',
      passwordHash,
      role: 'SUPER_ADMIN',
      emailVerified: true,
    },
  });

  // Production super admin (set ADMIN_EMAIL + ADMIN_PASSWORD in .env)
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await prisma.user.upsert({
      where: { email: process.env.ADMIN_EMAIL },
      update: {
        passwordHash: adminHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        emailVerified: true,
      },
      create: {
        email: process.env.ADMIN_EMAIL,
        passwordHash: adminHash,
        role: 'SUPER_ADMIN',
        isActive: true,
        emailVerified: true,
      },
    });
    console.log(`  Production Super Admin: ${process.env.ADMIN_EMAIL}`);
  }

  // Demo Hospital
  const hospitalAdmin = await prisma.user.upsert({
    where: { email: 'admin@cityhospital.com' },
    update: {},
    create: {
      email: 'admin@cityhospital.com',
      passwordHash,
      role: 'HOSPITAL_ADMIN',
      emailVerified: true,
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: 'city-general-hospital' },
    update: {},
    create: {
      name: 'City General Hospital',
      slug: 'city-general-hospital',
      type: 'HOSPITAL',
      description: 'A leading multi-specialty hospital providing comprehensive healthcare services.',
      email: 'info@cityhospital.com',
      phone: '+91-9876543210',
      address: '123 Healthcare Avenue',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001',
      verificationStatus: 'APPROVED',
      isActive: true,
      isPubliclyListed: true,
      emergencyAvailable: true,
      ownerName: 'Dr. Rajesh Kumar',
      facilities: ['ICU', 'Emergency', 'Pharmacy', 'Lab', 'Radiology', 'Ambulance'],
      openingHours: {
        monday: '24/7',
        tuesday: '24/7',
        wednesday: '24/7',
        thursday: '24/7',
        friday: '24/7',
        saturday: '24/7',
        sunday: '24/7',
      },
      averageRating: 4.5,
      reviewCount: 128,
    },
  });

  await prisma.staff.upsert({
    where: { userId: hospitalAdmin.id },
    update: {},
    create: {
      userId: hospitalAdmin.id,
      organizationId: organization.id,
      fullName: 'Dr. Rajesh Kumar',
      role: 'HOSPITAL_ADMIN',
    },
  });

  await prisma.subscription.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      organizationId: organization.id,
      planId: plans[1].id,
      status: 'ACTIVE',
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Demo coupons
  const couponDefs = [
    { code: 'WELCOME20', discountType: 'PERCENT' as const, discountValue: 20, maxDiscount: 500, usageLimit: 100, platformWide: true },
    { code: 'FLAT500', discountType: 'FIXED' as const, discountValue: 500, minAmount: 2000, usageLimit: 50, platformWide: true },
    { code: 'CITYHOSP10', discountType: 'PERCENT' as const, discountValue: 10, usageLimit: 25, platformWide: false, organizationId: organization.id },
  ];
  for (const c of couponDefs) {
    await prisma.coupon.upsert({
      where: { code: c.code },
      update: { isActive: true },
      create: { ...c, isActive: true },
    });
  }

  // Departments
  const cardiology = await prisma.department.create({
    data: { organizationId: organization.id, name: 'Cardiology', description: 'Heart and cardiovascular care' },
  });
  const orthopedics = await prisma.department.create({
    data: { organizationId: organization.id, name: 'Orthopedics', description: 'Bone and joint care' },
  });
  const general = await prisma.department.create({
    data: { organizationId: organization.id, name: 'General Medicine', description: 'Primary healthcare' },
  });

  // Services
  await prisma.service.createMany({
    data: [
      { organizationId: organization.id, name: 'General Consultation', price: 500, duration: 30 },
      { organizationId: organization.id, name: 'ECG', price: 800, duration: 15 },
      { organizationId: organization.id, name: 'X-Ray', price: 1200, duration: 20 },
      { organizationId: organization.id, name: 'Blood Test Panel', price: 1500, duration: 10 },
    ],
  });

  // Doctors
  const doctorUsers = [
    { email: 'dr.sharma@cityhospital.com', name: 'Dr. Anil Sharma', spec: 'Cardiologist', qual: 'MD, DM (Cardiology)', fee: 800, dept: cardiology.id, exp: 15 },
    { email: 'dr.patel@cityhospital.com', name: 'Dr. Priya Patel', spec: 'Orthopedic Surgeon', qual: 'MS (Orthopedics)', fee: 700, dept: orthopedics.id, exp: 12 },
    { email: 'dr.singh@cityhospital.com', name: 'Dr. Vikram Singh', spec: 'General Physician', qual: 'MBBS, MD', fee: 500, dept: general.id, exp: 8 },
  ];

  for (const doc of doctorUsers) {
    const user = await prisma.user.upsert({
      where: { email: doc.email },
      update: {},
      create: { email: doc.email, passwordHash, role: 'DOCTOR', emailVerified: true },
    });

    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        organizationId: organization.id,
        departmentId: doc.dept,
        fullName: doc.name,
        specialization: doc.spec,
        qualification: doc.qual,
        experience: doc.exp,
        consultationFee: doc.fee,
        languages: ['English', 'Hindi'],
        averageRating: 4.2 + Math.random() * 0.6,
        reviewCount: Math.floor(Math.random() * 50) + 10,
      },
    });

    // Create slots for next 7 days
    const slots = [];
    for (let d = 1; d <= 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() + d);
      for (const time of ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']) {
        slots.push({
          doctorId: doctor.id,
          date,
          startTime: time,
          endTime: `${String(parseInt(time) + 1).padStart(2, '0')}:00`,
        });
      }
    }
    await prisma.appointmentSlot.createMany({ data: slots, skipDuplicates: true });
  }

  // Demo Clinic
  const clinicOrg = await prisma.organization.upsert({
    where: { slug: 'wellness-clinic' },
    update: {},
    create: {
      name: 'Wellness Family Clinic',
      slug: 'wellness-clinic',
      type: 'CLINIC',
      description: 'Your neighborhood family clinic for everyday healthcare needs.',
      email: 'contact@wellnessclinic.com',
      phone: '+91-9876543211',
      address: '45 Park Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400002',
      verificationStatus: 'APPROVED',
      isActive: true,
      isPubliclyListed: true,
      emergencyAvailable: false,
      ownerName: 'Dr. Meera Desai',
      facilities: ['Consultation', 'Vaccination', 'Minor Procedures'],
      averageRating: 4.3,
      reviewCount: 56,
    },
  });

  // Demo Patient
  const patientUser = await prisma.user.upsert({
    where: { email: 'patient@example.com' },
    update: {},
    create: {
      email: 'patient@example.com',
      phone: '+91-9876543299',
      passwordHash,
      role: 'PATIENT',
      emailVerified: true,
    },
  });

  const patient = await prisma.patient.upsert({
    where: { userId: patientUser.id },
    update: {},
    create: {
      userId: patientUser.id,
      fullName: 'Rahul Verma',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'MALE',
      address: '78 Lake View Apartments',
      city: 'Mumbai',
      state: 'Maharashtra',
      emergencyContact: '+91-9876543298',
    },
  });

  await prisma.patientOrganization.create({
    data: { patientId: patient.id, organizationId: organization.id },
  });

  // Sample Advertisement
  await prisma.advertisement.create({
    data: {
      organizationId: organization.id,
      title: 'Free Health Checkup Camp',
      type: 'HOMEPAGE_BANNER',
      status: 'ACTIVE',
      targetUrl: '/organizations/city-general-hospital',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Specializations (Master Data)
  const specs = [
    { name: 'Cardiology', department: 'Cardiology', services: ['ECG', 'Echo', 'Stress Test', 'Cardiac Surgery'] },
    { name: 'Orthopedics', department: 'Orthopedics', services: ['Joint Replacement', 'Fracture Care', 'Physiotherapy'] },
    { name: 'General Medicine', department: 'General Medicine', services: ['Consultation', 'Health Checkup'] },
    { name: 'Pediatrics', department: 'Pediatrics', services: ['Child Vaccination', 'Growth Monitoring'] },
    { name: 'Dermatology', department: 'Dermatology', services: ['Skin Consultation', 'Laser Treatment'] },
  ];
  for (const spec of specs) {
    await prisma.specialization.upsert({
      where: { name: spec.name },
      update: {},
      create: spec,
    });
  }

  // CMS Pages
  const cmsPages = [
    { slug: 'about', title: 'About Us', content: 'Healthcare Platform — connecting patients with hospitals and clinics.', isPublished: true },
    { slug: 'terms', title: 'Terms & Conditions', content: 'Terms and conditions for using the platform.', isPublished: true },
    { slug: 'privacy', title: 'Privacy Policy', content: 'How we handle your data.', isPublished: true },
    { slug: 'faq', title: 'FAQ', content: 'Frequently asked questions.', isPublished: true },
  ];
  for (const page of cmsPages) {
    await prisma.cmsPage.upsert({ where: { slug: page.slug }, update: {}, create: page });
  }

  // Communication Templates
  const templates = [
    { name: 'Appointment Confirmation', channel: 'EMAIL', subject: 'Appointment Confirmed', body: 'Your appointment has been confirmed.' },
    { name: 'Payment Receipt', channel: 'EMAIL', subject: 'Payment Received', body: 'Thank you for your payment.' },
    { name: 'Welcome Message', channel: 'SMS', body: 'Welcome to Healthcare Platform!' },
    { name: 'Password Reset', channel: 'EMAIL', subject: 'Reset Password', body: 'Click the link to reset your password.' },
  ];
  for (const tpl of templates) {
    await prisma.communicationTemplate.create({ data: tpl });
  }

  // Locations
  const india = await prisma.location.create({ data: { name: 'India', type: 'COUNTRY' } });
  const mh = await prisma.location.create({ data: { name: 'Maharashtra', type: 'STATE', parentId: india.id } });
  await prisma.location.create({ data: { name: 'Mumbai', type: 'CITY', parentId: mh.id, pinCode: '400001' } });
  await prisma.location.create({ data: { name: 'Pune', type: 'CITY', parentId: mh.id, pinCode: '411001' } });

  // Platform Settings
  const settings = [
    { key: 'platformName', value: 'Healthcare Platform', category: 'general' },
    { key: 'currency', value: 'INR', category: 'general' },
    { key: 'supportEmail', value: 'support@healthcare.platform', category: 'contact' },
    { key: 'supportPhone', value: '+91-1800-000-000', category: 'contact' },
  ];
  for (const s of settings) {
    await prisma.platformSetting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
  }

  console.log('Seed completed!');
  console.log('\nDemo accounts (password: Password123!):');
  console.log('  Super Admin: admin@healthcare.platform');
  console.log('  Hospital Admin: admin@cityhospital.com');
  console.log('  Doctor: dr.sharma@cityhospital.com');
  console.log('  Patient: patient@example.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
