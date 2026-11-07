import { db } from '../db/db';
import { branches } from '../db/schema/organisation';
import { eq } from 'drizzle-orm';

export const branchRepository = {
  async getAll() {
    return db.select().from(branches);
  },
  async getById(id: string) {
    const rows = await db.select().from(branches).where(eq(branches.id, id));
    return rows[0] || null;
  },
  async create(data: typeof branches.$inferInsert) {
    return db.insert(branches).values(data).returning();
  },
  async update(id: string, data: Partial<typeof branches.$inferInsert>) {
    return db.update(branches).set(data).where(eq(branches.id, id)).returning();
  },
};
