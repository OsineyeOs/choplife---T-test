import { db } from '../db/db';
import {
  inventoryItems,
  inventoryBalances,
  stockMovements,
  recipes,
  suppliers,
  purchaseOrders,
  goodsReceiptNotes,
  wastageRecords,
  stockCounts,
  stockAlerts,
  productionBatches,
} from '../db/schema/inventory';
import { eq, desc } from 'drizzle-orm';

export const inventoryRepository = {
  async getAllItems() {
    return await db.select().from(inventoryItems);
  },

  async getItemById(id: string) {
    const [row] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return row;
  },

  async upsertItem(data: typeof inventoryItems.$inferInsert) {
    const [row] = await db
      .insert(inventoryItems)
      .values(data)
      .onConflictDoUpdate({
        target: inventoryItems.id,
        set: {
          name: data.name,
          sku: data.sku,
          unit: data.unit,
          category: data.category,
          minThreshold: data.minThreshold,
          costPerUnit: data.costPerUnit,
          isActive: data.isActive,
          currentStockJson: data.currentStockJson,
          locationStockJson: data.locationStockJson,
          metadata: data.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },

  async getBalances(branchId?: string) {
    if (branchId) {
      return await db.select().from(inventoryBalances).where(eq(inventoryBalances.branchId, branchId));
    }
    return await db.select().from(inventoryBalances);
  },

  async upsertBalance(data: typeof inventoryBalances.$inferInsert) {
    const [row] = await db
      .insert(inventoryBalances)
      .values(data)
      .onConflictDoUpdate({
        target: inventoryBalances.id,
        set: {
          quantity: data.quantity,
          reservedQuantity: data.reservedQuantity,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },

  async recordMovement(data: typeof stockMovements.$inferInsert) {
    const [row] = await db.insert(stockMovements).values(data).returning();
    return row;
  },

  async getMovements(branchId?: string) {
    if (branchId) {
      return await db.select().from(stockMovements).where(eq(stockMovements.branchId, branchId)).orderBy(desc(stockMovements.createdAt));
    }
    return await db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt));
  },

  async getRecipes() {
    return await db.select().from(recipes);
  },

  async getSuppliers() {
    return await db.select().from(suppliers);
  },

  async getPurchaseOrders() {
    return await db.select().from(purchaseOrders);
  },

  async getGoodsReceiptNotes() {
    return await db.select().from(goodsReceiptNotes);
  },

  async getWastageRecords() {
    return await db.select().from(wastageRecords);
  },

  async getStockCounts() {
    return await db.select().from(stockCounts);
  },

  async getStockAlerts() {
    return await db.select().from(stockAlerts);
  },

  async getProductionBatches() {
    return await db.select().from(productionBatches);
  },
};
