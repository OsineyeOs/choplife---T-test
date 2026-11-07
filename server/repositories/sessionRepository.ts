import { db } from '../db/db';
import { sessions } from '../db/schema/auth';
import { eq, lt } from 'drizzle-orm';

export const sessionRepository = {
  async create(data: typeof sessions.$inferInsert) {
    return db.insert(sessions).values(data).returning();
  },
  async getByToken(token: string) {
    const results = await db.select().from(sessions).where(eq(sessions.token, token));
    return results[0];
  },
  async updateLastActivity(id: string) {
    return db.update(sessions).set({ lastActivity: new Date() }).where(eq(sessions.id, id)).returning();
  },
  async delete(id: string) {
    await db.delete(sessions).where(eq(sessions.id, id));
  },
  async deleteByStaffId(staffId: string) {
    await db.delete(sessions).where(eq(sessions.staffId, staffId));
  },
  async cleanupExpired() {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  }
};
