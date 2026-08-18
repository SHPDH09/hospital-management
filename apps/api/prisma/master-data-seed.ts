import { MasterCatalogKind, PrismaClient } from '@prisma/client';

export async function seedMasterData(prisma: PrismaClient) {
  const upsertSpec = async (name: string, sortOrder: number) => {
    await prisma.specialization.upsert({
      where: { name },
      update: { isActive: true, sortOrder },
      create: { name, isActive: true, sortOrder },
    });
  };

  const specializations = [
    'Cardiology', 'Neurology', 'Dermatology', 'Orthopedics', 'Pediatrics',
    'Gynecology', 'General Medicine', 'Psychiatry', 'ENT', 'Ophthalmology',
    'Dentistry', 'Urology', 'Oncology', 'Nephrology', 'Pulmonology', 'Gastroenterology',
  ];
  for (let i = 0; i < specializations.length; i++) await upsertSpec(specializations[i], i + 1);

  const upsertDept = async (name: string, sortOrder: number) => {
    await prisma.platformDepartment.upsert({
      where: { name },
      update: { isActive: true, sortOrder },
      create: { name, isActive: true, sortOrder },
    });
  };
  const departments = [
    'Emergency', 'OPD', 'ICU', 'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics',
    'Pharmacy', 'Laboratory', 'Radiology', 'Surgery', 'Physiotherapy',
  ];
  for (let i = 0; i < departments.length; i++) await upsertDept(departments[i], i + 1);

  const serviceCategories = [
    'Consultation', 'Diagnostic', 'Laboratory', 'Radiology', 'Surgery',
    'Therapy', 'Preventive Care', 'Emergency', 'Pharmacy',
  ];
  const catMap: Record<string, string> = {};
  for (let i = 0; i < serviceCategories.length; i++) {
    const c = await prisma.serviceCategory.upsert({
      where: { name: serviceCategories[i] },
      update: { isActive: true, sortOrder: i + 1 },
      create: { name: serviceCategories[i], isActive: true, sortOrder: i + 1 },
    });
    catMap[c.name] = c.id;
  }

  const services = [
    { name: 'General Consultation', category: 'Consultation', price: 500, duration: 30 },
    { name: 'Specialist Consultation', category: 'Consultation', price: 1000, duration: 30 },
    { name: 'ECG', category: 'Diagnostic', price: 800, duration: 15 },
    { name: 'Ultrasound', category: 'Radiology', price: 1500, duration: 30 },
    { name: 'X-Ray', category: 'Radiology', price: 600, duration: 15 },
    { name: 'CT Scan', category: 'Radiology', price: 5000, duration: 45 },
    { name: 'MRI', category: 'Radiology', price: 8000, duration: 60 },
    { name: 'Blood Test', category: 'Laboratory', price: 400, duration: 10 },
    { name: 'Health Checkup', category: 'Preventive Care', price: 2500, duration: 60 },
    { name: 'Vaccination', category: 'Preventive Care', price: 300, duration: 15 },
    { name: 'Physiotherapy', category: 'Therapy', price: 700, duration: 45 },
    { name: 'Dental Cleaning', category: 'Consultation', price: 1200, duration: 30 },
    { name: 'Surgery', category: 'Surgery', price: 25000, duration: 120 },
  ];
  for (let i = 0; i < services.length; i++) {
    const s = services[i];
    const existing = await prisma.platformHealthcareService.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.platformHealthcareService.create({
        data: {
          name: s.name,
          categoryId: catMap[s.category],
          defaultPrice: s.price,
          duration: s.duration,
          isActive: true,
          sortOrder: i + 1,
        },
      });
    }
  }

  const testGroups = [
    { group: 'Laboratory', categories: ['Blood', 'Urine', 'Stool', 'Hormonal', 'Biochemistry'] },
    { group: 'Imaging', categories: ['X-Ray', 'CT', 'MRI', 'Ultrasound'] },
  ];
  const testCatMap: Record<string, string> = {};
  let tcOrder = 1;
  for (const g of testGroups) {
    for (const cat of g.categories) {
      const key = `${g.group}:${cat}`;
      const existing = await prisma.testCategory.findFirst({ where: { name: cat, group: g.group } });
      const row = existing || await prisma.testCategory.create({
        data: { name: cat, group: g.group, isActive: true, sortOrder: tcOrder++ },
      });
      testCatMap[key] = row.id;
    }
  }

  const tests = [
    { name: 'CBC', group: 'Laboratory', cat: 'Blood', sample: 'Blood', price: 350 },
    { name: 'Blood Sugar', group: 'Laboratory', cat: 'Blood', sample: 'Blood', price: 150 },
    { name: 'HbA1c', group: 'Laboratory', cat: 'Blood', sample: 'Blood', price: 500 },
    { name: 'Lipid Profile', group: 'Laboratory', cat: 'Biochemistry', sample: 'Blood', price: 800 },
    { name: 'LFT', group: 'Laboratory', cat: 'Biochemistry', sample: 'Blood', price: 700 },
    { name: 'KFT', group: 'Laboratory', cat: 'Biochemistry', sample: 'Blood', price: 700 },
    { name: 'Thyroid', group: 'Laboratory', cat: 'Hormonal', sample: 'Blood', price: 600 },
    { name: 'Urine Test', group: 'Laboratory', cat: 'Urine', sample: 'Urine', price: 200 },
    { name: 'ECG', group: 'Imaging', cat: 'X-Ray', sample: 'N/A', price: 400 },
    { name: 'X-Ray', group: 'Imaging', cat: 'X-Ray', sample: 'N/A', price: 600 },
    { name: 'CT Scan', group: 'Imaging', cat: 'CT', sample: 'N/A', price: 5000 },
    { name: 'MRI', group: 'Imaging', cat: 'MRI', sample: 'N/A', price: 8000 },
    { name: 'Ultrasound', group: 'Imaging', cat: 'Ultrasound', sample: 'N/A', price: 1500 },
  ];
  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    const existing = await prisma.diagnosticTest.findFirst({ where: { name: t.name } });
    if (!existing) {
      await prisma.diagnosticTest.create({
        data: {
          name: t.name,
          categoryId: testCatMap[`${t.group}:${t.cat}`],
          sampleType: t.sample,
          defaultPrice: t.price,
          isActive: true,
          sortOrder: i + 1,
        },
      });
    }
  }

  const medicines = [
    { name: 'Paracetamol', genericName: 'Paracetamol', dosageForm: 'Tablet', strength: '500mg' },
    { name: 'Amoxicillin', genericName: 'Amoxicillin', dosageForm: 'Capsule', strength: '250mg' },
    { name: 'Metformin', genericName: 'Metformin', dosageForm: 'Tablet', strength: '500mg' },
    { name: 'Amlodipine', genericName: 'Amlodipine', dosageForm: 'Tablet', strength: '5mg' },
    { name: 'Omeprazole', genericName: 'Omeprazole', dosageForm: 'Capsule', strength: '20mg' },
  ];
  for (let i = 0; i < medicines.length; i++) {
    const m = medicines[i];
    const existing = await prisma.medicine.findFirst({ where: { name: m.name } });
    if (!existing) await prisma.medicine.create({ data: { ...m, isActive: true, sortOrder: i + 1 } });
  }

  const catalog = (kind: MasterCatalogKind, names: string[]) =>
    names.map(async (name, i) => prisma.masterCatalog.upsert({
      where: { kind_name: { kind, name } },
      update: { isActive: true, sortOrder: i + 1 },
      create: { kind, name, isActive: true, sortOrder: i + 1 },
    }));

  await Promise.all(catalog('HOSPITAL_TYPE', [
    'General Hospital', 'Multi-Specialty Hospital', 'Super-Specialty Hospital',
    'Government Hospital', 'Private Hospital', 'Nursing Home', 'Teaching Hospital', 'Specialty Hospital',
  ]));
  await Promise.all(catalog('CLINIC_TYPE', [
    'General Clinic', 'Dental Clinic', 'Eye Clinic', 'Skin Clinic',
    'Pediatric Clinic', 'Physiotherapy Clinic', 'Diagnostic Clinic', 'Specialty Clinic',
  ]));
  await Promise.all(catalog('FACILITY', [
    'Emergency', 'ICU', 'NICU', 'Ambulance', 'Pharmacy', 'Laboratory', 'Blood Bank',
    'Parking', 'Wheelchair Access', '24×7 Service', 'Insurance Support',
  ]));
  await Promise.all(catalog('HEALTH_PACKAGE_CATEGORY', [
    'Full Body Checkup', 'Senior Citizen', "Women's Health", "Men's Health",
    'Child Health', 'Diabetes', 'Heart Health', 'Preventive Health',
  ]));

  const qualifications = ['MBBS', 'MD', 'MS', 'BDS', 'MDS', 'BAMS', 'BHMS', 'BPT', 'DNB'];
  for (let i = 0; i < qualifications.length; i++) {
    await prisma.doctorQualification.upsert({
      where: { name: qualifications[i] },
      update: { isActive: true, sortOrder: i + 1 },
      create: { name: qualifications[i], shortName: qualifications[i], isActive: true, sortOrder: i + 1 },
    });
  }

  const staffRoles = [
    { name: 'Hospital Admin', code: 'HOSPITAL_ADMIN' },
    { name: 'Branch Manager', code: 'BRANCH_MANAGER' },
    { name: 'Doctor', code: 'DOCTOR' },
    { name: 'Nurse', code: 'NURSE' },
    { name: 'Receptionist', code: 'RECEPTIONIST' },
    { name: 'Accountant', code: 'ACCOUNTANT' },
    { name: 'Pharmacist', code: 'PHARMACIST' },
    { name: 'Lab Technician', code: 'LAB_TECH' },
    { name: 'Radiologist', code: 'RADIOLOGIST' },
    { name: 'Support Staff', code: 'SUPPORT' },
  ];
  for (let i = 0; i < staffRoles.length; i++) {
    const r = staffRoles[i];
    await prisma.staffRoleMaster.upsert({
      where: { name: r.name },
      update: { isActive: true, sortOrder: i + 1, code: r.code },
      create: { ...r, isActive: true, sortOrder: i + 1 },
    });
  }

  const insurers = ['Star Health', 'ICICI Lombard', 'HDFC ERGO', 'Max Bupa', 'Care Health', 'New India Assurance'];
  for (let i = 0; i < insurers.length; i++) {
    await prisma.insuranceProvider.upsert({
      where: { name: insurers[i] },
      update: { isActive: true, sortOrder: i + 1 },
      create: { name: insurers[i], isActive: true, sortOrder: i + 1 },
    });
  }

  console.log('  Master data seeded');
}
