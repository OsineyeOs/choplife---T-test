import { db } from '../db/db';
import { orders } from '../db/schema/sales';
import { eq } from 'drizzle-orm';

export const orderRepository = {
  async getById(id: string) {
    return db.select().from(orders).where(eq(orders.id, id)).then(rows => rows[0]);
  },
  async getByOrderNumber(orderNumber: string) {
    return db.select().from(orders).where(eq(orders.id, orderNumber)).then(rows => rows[0]);
  },
  async create(data: typeof orders.$inferInsert) {
    return db.insert(orders).values(data).returning();
  },
  async update(id: string, data: Partial<typeof orders.$inferInsert>) {
    return db.update(orders).set(data).where(eq(orders.id, id)).returning();
  },
};
