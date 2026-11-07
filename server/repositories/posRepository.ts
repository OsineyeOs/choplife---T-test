import { db } from '../db/db';
import {
  posChecks,
  posCheckItems,
  shifts,
  cashMovements,
  heldTickets,
  reconciliations,
} from '../db/schema/sales';
import { eq, desc } from 'drizzle-orm';

export const posRepository = {
  async getChecksByBranch(branchId?: string) {
    if (branchId) {
      return await db.select().from(posChecks).where(eq(posChecks.branchId, branchId)).orderBy(desc(posChecks.createdAt));
    }
    return await db.select().from(posChecks).orderBy(desc(posChecks.createdAt));
  },

  async upsertCheck(data: typeof posChecks.$inferInsert) {
    const [row] = await db
      .insert(posChecks)
      .values(data)
      .onConflictDoUpdate({
        target: posChecks.id,
        set: {
          status: data.status,
          paymentStatus: data.paymentStatus,
          subtotalAmount: data.subtotalAmount,
          packagingAmount: data.packagingAmount,
          discountAmount: data.discountAmount,
          serviceCharge: data.serviceCharge,
          taxAmount: data.taxAmount,
          totalAmount: data.totalAmount,
          paidAmount: data.paidAmount,
          itemsJson: data.itemsJson,
          paymentsJson: data.paymentsJson,
          metadata: data.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },

  async getCheckItems(checkId: string) {
    return await db.select().from(posCheckItems).where(eq(posCheckItems.checkId, checkId));
  },

  async getShifts(branchId?: string) {
    if (branchId) {
      return await db.select().from(shifts).where(eq(shifts.branchId, branchId)).orderBy(desc(shifts.startTime));
    }
    return await db.select().from(shifts).orderBy(desc(shifts.startTime));
  },

  async upsertShift(data: typeof shifts.$inferInsert) {
    const [row] = await db
      .insert(shifts)
      .values(data)
      .onConflictDoUpdate({
        target: shifts.id,
        set: {
          endTime: data.endTime,
          closingCash: data.closingCash,
          expectedCash: data.expectedCash,
          variance: data.variance,
          status: data.status,
          notes: data.notes,
          metadata: data.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },

  async recordCashMovement(data: typeof cashMovements.$inferInsert) {
    const [row] = await db.insert(cashMovements).values(data).returning();
    return row;
  },

  async getHeldTickets(branchId?: string) {
    if (branchId) {
      return await db.select().from(heldTickets).where(eq(heldTickets.branchId, branchId));
    }
    return await db.select().from(heldTickets);
  },

  async getReconciliations(branchId?: string) {
    if (branchId) {
      return await db.select().from(reconciliations).where(eq(reconciliations.branchId, branchId));
    }
    return await db.select().from(reconciliations);
  },
};
