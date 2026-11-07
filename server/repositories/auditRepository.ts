import { db } from '../db/db';
import { auditLogs } from '../db/schema/audit';

export const auditRepository = {
  async log(data: typeof auditLogs.$inferInsert) {
    return db.insert(auditLogs).values(data).returning();
  },
};
