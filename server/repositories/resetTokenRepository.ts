import { db } from '../db/db';
import { passwordResetTokens } from '../db/schema/auth';
import { eq } from 'drizzle-orm';

export const resetTokenRepository = {
  async create(data: typeof passwordResetTokens.$inferInsert) {
    return db.insert(passwordResetTokens).values(data).returning();
  },
  async getByToken(token: string) {
    const results = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token));
    return results[0];
  },
  async markUsed(id: string) {
    return db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.id, id)).returning();
  },
  async invalidateAllForStaff(staffId: string) {
    return db.update(passwordResetTokens).set({ used: true }).where(eq(passwordResetTokens.staffId, staffId)).returning();
  },
};
