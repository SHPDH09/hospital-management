import { PrismaClient } from '@prisma/client';
import { DEFAULT_DEPARTMENTS, DEFAULT_ROLE_TEMPLATES } from '../src/lib/platform-staff';

export async function seedPlatformStaff(prisma: PrismaClient) {
  for (const name of DEFAULT_DEPARTMENTS) {
    await prisma.platformDepartment.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: true },
    });
  }

  for (const tpl of DEFAULT_ROLE_TEMPLATES) {
    await prisma.platformStaffRole.upsert({
      where: { name: tpl.name },
      update: {
        permissions: tpl.permissions,
        roleType: tpl.roleType,
        level: tpl.level,
        organizationScope: tpl.organizationScope,
        description: tpl.description,
      },
      create: {
        name: tpl.name,
        code: tpl.code,
        description: tpl.description,
        roleType: tpl.roleType,
        level: tpl.level,
        permissions: tpl.permissions,
        organizationScope: tpl.organizationScope,
        isSystem: true,
      },
    });
  }

  console.log(`  Platform staff: ${DEFAULT_DEPARTMENTS.length} departments, ${DEFAULT_ROLE_TEMPLATES.length} roles seeded`);
}
