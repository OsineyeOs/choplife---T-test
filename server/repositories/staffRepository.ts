import { db } from '../db/db';
import { staff } from '../db/schema/staff';
import { eq, and, isNotNull } from 'drizzle-orm';

export const staffRepository = {
  async getAll() {
    return db.select().from(staff);
  },
  async getById(id: string) {
    const results = await db.select().from(staff).where(eq(staff.id, id));
    return results[0];
  },
  async getByStaffId(staffId: string) {
    const results = await db.select().from(staff).where(eq(staff.staffId, staffId));
    return results[0];
  },
  async getByWorkEmail(workEmail: string) {
    const results = await db.select().from(staff).where(eq(staff.workEmail, workEmail));
    return results[0];
  },
  async create(data: typeof staff.$inferInsert) {
    return db.insert(staff).values(data).returning();
  },
  async update(id: string, data: Partial<typeof staff.$inferInsert>) {
    return db.update(staff).set(data).where(eq(staff.id, id)).returning();
  },
  async suspend(id: string) {
    return db.update(staff).set({ status: 'suspended' }).where(eq(staff.id, id)).returning();
  },
  async reactivate(id: string) {
    return db.update(staff).set({ status: 'active' }).where(eq(staff.id, id)).returning();
  },
  async getActiveSupervisors() {
    return db.select().from(staff).where(
      and(
        eq(staff.status, 'active'),
        isNotNull(staff.pinHash)
      )
    );
  },
};
