import { db } from '../db/db';
import { paymentTransactions, processedWebhookEvents } from '../db/schema/sales';
import { eq, desc } from 'drizzle-orm';

export const paymentRepository = {
  async getAll() {
    return await db.select().from(paymentTransactions).orderBy(desc(paymentTransactions.createdAt));
  },

  async getByReference(reference: string) {
    const [row] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.reference, reference));
    return row;
  },

  async upsertTransaction(data: typeof paymentTransactions.$inferInsert) {
    const [row] = await db
      .insert(paymentTransactions)
      .values(data)
      .onConflictDoUpdate({
        target: paymentTransactions.reference,
        set: {
          status: data.status,
          verifiedAt: data.verifiedAt,
          rawPayload: data.rawPayload,
          metadata: data.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },

  async hasProcessedWebhook(eventKey: string) {
    const [row] = await db.select().from(processedWebhookEvents).where(eq(processedWebhookEvents.eventKey, eventKey));
    return Boolean(row);
  },

  async recordWebhookEvent(data: typeof processedWebhookEvents.$inferInsert) {
    const [row] = await db
      .insert(processedWebhookEvents)
      .values(data)
      .onConflictDoNothing()
      .returning();
    return row;
  },
};
