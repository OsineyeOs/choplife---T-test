import { db } from '../db/db';
import { menuProducts } from '../db/schema/menu';
import { eq } from 'drizzle-orm';

export const menuRepository = {
  async getAll() {
    return db.select().from(menuProducts);
  },
  async getById(id: string) {
    return db.select().from(menuProducts).where(eq(menuProducts.id, id)).then(rows => rows[0]);
  },
  async create(data: typeof menuProducts.$inferInsert) {
    return db.insert(menuProducts).values(data).returning();
  },
};
