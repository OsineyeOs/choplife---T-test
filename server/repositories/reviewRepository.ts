import { db } from '../db/db';
import { customerReviews } from '../db/schema/customers';
import { eq, and, desc } from 'drizzle-orm';

export const reviewRepository = {
  async getAllApproved(branchId?: string) {
    const all = await db
      .select()
      .from(customerReviews)
      .where(eq(customerReviews.moderationStatus, 'approved'))
      .orderBy(desc(customerReviews.createdAt));
    if (branchId) {
      return all.filter((r) => r.branchId === branchId);
    }
    return all;
  },

  async getByOrderId(orderId: string) {
    return await db.select().from(customerReviews).where(eq(customerReviews.orderId, orderId));
  },

  async getByOrderAndProduct(orderId: string, productId: string | null) {
    if (productId) {
      const [row] = await db
        .select()
        .from(customerReviews)
        .where(and(eq(customerReviews.orderId, orderId), eq(customerReviews.productId, productId)));
      return row;
    }
    const [row] = await db.select().from(customerReviews).where(eq(customerReviews.orderId, orderId));
    return row;
  },

  async create(data: typeof customerReviews.$inferInsert) {
    const [row] = await db.insert(customerReviews).values(data).returning();
    return row;
  },
};
