import { db } from '../db/db';
import { roles, permissions, rolePermissions } from '../db/schema/rbac';
import { eq, and } from 'drizzle-orm';

export const rbacRepository = {
  async getAllRoles() {
    return db.select().from(roles);
  },
  async getRoleById(id: string) {
    const results = await db.select().from(roles).where(eq(roles.id, id));
    return results[0] || null;
  },
  async getRoleByCode(code: string) {
    const results = await db.select().from(roles).where(eq(roles.code, code));
    return results[0] || null;
  },
  async createRole(data: typeof roles.$inferInsert) {
    return db.insert(roles).values(data).returning();
  },
  async updateRole(id: string, data: Partial<typeof roles.$inferInsert>) {
    return db.update(roles).set(data).where(eq(roles.id, id)).returning();
  },
  async deleteRole(id: string) {
    const existing = await this.getRoleById(id);
    if (existing?.isSystem) {
      throw new Error('System roles cannot be deleted.');
    }
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, id));
    await db.delete(roles).where(eq(roles.id, id));
  },
  async getAllPermissions() {
    return db.select().from(permissions);
  },
  async getPermissionByCode(code: string) {
    const results = await db.select().from(permissions).where(eq(permissions.code, code));
    return results[0] || null;
  },
  async createPermission(code: string, description?: string) {
    return db.insert(permissions).values({ id: `perm-${code}`, code, description }).onConflictDoNothing().returning();
  },
  async getPermissionsForRole(roleId: string) {
    return db.select({
      id: rolePermissions.id,
      roleId: rolePermissions.roleId,
      permissionId: rolePermissions.permissionId,
      code: permissions.code,
    })
      .from(rolePermissions)
      .leftJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
  },
  async assignPermissionToRole(roleId: string, permissionId: string) {
    const id = `rp-${roleId}-${permissionId}`;
    return db.insert(rolePermissions).values({ id, roleId, permissionId }).onConflictDoNothing().returning();
  },
  async removePermissionFromRole(roleId: string, permissionId: string) {
    await db.delete(rolePermissions).where(
      and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId))
    );
  },
  async syncRolePermissions(roleId: string, privilegeCodes: string[]) {
    await db.transaction(async (tx) => {
      // 1. Ensure all permissions exist
      for (const code of privilegeCodes) {
        const permId = `perm-${code}`;
        await tx.insert(permissions)
          .values({ id: permId, code, description: `Auto-generated for ${code}` })
          .onConflictDoNothing();
      }

      // 2. Remove old mappings
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

      // 3. Insert new mappings
      if (privilegeCodes.length > 0) {
        const mappings = privilegeCodes.map((code) => ({
          id: `rp-${roleId}-perm-${code}`,
          roleId,
          permissionId: `perm-${code}`,
        }));
        await tx.insert(rolePermissions).values(mappings).onConflictDoNothing();
      }
    });
  },
};
