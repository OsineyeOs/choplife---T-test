import { db } from '../db/db';
import {
  riders,
  deliveryTasks,
  notifications,
  printers,
  receiptTemplates,
  printJobs,
  cateringEvents,
  migrationBatches,
  historicalEzeeRecords,
} from '../db/schema/operations';
import { eq, desc } from 'drizzle-orm';

export const dispatchRepository = {
  async getRiders(branchId?: string) {
    if (branchId) {
      return await db.select().from(riders).where(eq(riders.branchId, branchId));
    }
    return await db.select().from(riders);
  },

  async getDeliveryTasks(branchId?: string) {
    if (branchId) {
      return await db.select().from(deliveryTasks).where(eq(deliveryTasks.branchId, branchId)).orderBy(desc(deliveryTasks.createdAt));
    }
    return await db.select().from(deliveryTasks).orderBy(desc(deliveryTasks.createdAt));
  },

  async getCateringEvents() {
    return await db.select().from(cateringEvents);
  },
};

export const notificationRepository = {
  async getNotifications() {
    return await db.select().from(notifications).orderBy(desc(notifications.createdAt));
  },

  async getPrinters(branchId?: string) {
    if (branchId) {
      return await db.select().from(printers).where(eq(printers.branchId, branchId));
    }
    return await db.select().from(printers);
  },

  async getReceiptTemplates() {
    return await db.select().from(receiptTemplates);
  },

  async getPrintJobs(branchId?: string) {
    if (branchId) {
      return await db.select().from(printJobs).where(eq(printJobs.branchId, branchId));
    }
    return await db.select().from(printJobs);
  },
};

export const migrationRepository = {
  async getAllBatches() {
    return await db.select().from(migrationBatches).orderBy(desc(migrationBatches.createdAt));
  },

  async getBatchByChecksum(checksum: string) {
    const [row] = await db.select().from(migrationBatches).where(eq(migrationBatches.checksum, checksum));
    return row;
  },

  async upsertBatch(data: typeof migrationBatches.$inferInsert) {
    const [row] = await db
      .insert(migrationBatches)
      .values(data)
      .onConflictDoUpdate({
        target: migrationBatches.id,
        set: {
          status: data.status,
          totalRows: data.totalRows,
          validRows: data.validRows,
          rejectedRows: data.rejectedRows,
          committedAt: data.committedAt,
          rolledBackAt: data.rolledBackAt,
          summaryJson: data.summaryJson,
          errorsJson: data.errorsJson,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },

  async insertHistoricalRecord(data: typeof historicalEzeeRecords.$inferInsert) {
    const [row] = await db.insert(historicalEzeeRecords).values(data).onConflictDoNothing().returning();
    return row;
  },

  async getHistoricalRecords(batchId?: string) {
    if (batchId) {
      return await db.select().from(historicalEzeeRecords).where(eq(historicalEzeeRecords.batchId, batchId));
    }
    return await db.select().from(historicalEzeeRecords).orderBy(desc(historicalEzeeRecords.createdAt));
  },
};
