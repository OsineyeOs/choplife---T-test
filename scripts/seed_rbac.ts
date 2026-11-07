import { db } from '../server/db/db';
import { roles, permissions, rolePermissions } from '../server/db/schema/rbac';
import { CANONICAL_PRIVILEGE_CATEGORIES, DEFAULT_STANDARD_ROLES } from '../src/data/rbacCatalogue';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('Starting RBAC seeding...');

  try {
    await db.transaction(async (tx) => {
      // 1. Seed all permissions
      await tx.insert(permissions)
        .values({ id: 'perm-*', code: '*', description: 'Full wildcard superuser permission' })
        .onConflictDoNothing();
      const allPrivileges = CANONICAL_PRIVILEGE_CATEGORIES.flatMap((c) => c.privileges);
      for (const priv of allPrivileges) {
        await tx.insert(permissions)
          .values({ id: `perm-${priv.code}`, code: priv.code, description: priv.description })
          .onConflictDoNothing();
      }
      console.log('Permissions seeded.');

      // 2. Seed all roles
      for (const roleDef of DEFAULT_STANDARD_ROLES) {
        await tx.insert(roles)
          .values({
            id: roleDef.id,
            code: roleDef.code,
            name: roleDef.name,
            description: roleDef.description,
            isSystem: roleDef.isSystem,
            privileges: roleDef.privileges,
            reports: roleDef.reports,
            orderSummaryColumns: roleDef.orderSummaryColumns,
          })
          .onConflictDoUpdate({
            target: roles.code,
            set: {
              name: roleDef.name,
              description: roleDef.description,
              privileges: roleDef.privileges,
              reports: roleDef.reports,
              orderSummaryColumns: roleDef.orderSummaryColumns,
            }
          });

        // 3. Assign permissions to role
        for (const privCode of roleDef.privileges) {
          const permId = `perm-${privCode}`;
          await tx.insert(rolePermissions)
            .values({ id: `rp-${roleDef.id}-${permId}`, roleId: roleDef.id, permissionId: permId })
            .onConflictDoNothing();
        }
      }
      console.log('Roles and permissions assigned.');
    });
    console.log('RBAC seeding completed successfully.');
  } catch (error) {
    console.error('Error during RBAC seeding:', error);
    process.exit(1);
  }
}

seed();
