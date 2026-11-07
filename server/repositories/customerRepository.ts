import { db } from '../db/db';
import {
  customers,
  customerAddresses,
  customerDevices,
  walletTransactions,
  houseAccounts,
  houseAccountTransactions,
  customerCareTickets,
} from '../db/schema/customers';
import { eq, or, ilike, desc } from 'drizzle-orm';

export const customerRepository = {
  async getAll() {
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  },

  async getById(id: string) {
    const [row] = await db.select().from(customers).where(eq(customers.id, id));
    return row;
  },

  async getByPhone(phone: string) {
    const [row] = await db.select().from(customers).where(eq(customers.phone, phone));
    return row;
  },

  async search(query: string) {
    const q = `%${query.trim()}%`;
    return await db
      .select()
      .from(customers)
      .where(or(ilike(customers.name, q), ilike(customers.phone, q), ilike(customers.email, q)))
      .orderBy(desc(customers.totalSpent));
  },

  async upsert(data: typeof customers.$inferInsert) {
    const [row] = await db
      .insert(customers)
      .values(data)
      .onConflictDoUpdate({
        target: customers.id,
        set: {
          name: data.name,
          phone: data.phone,
          email: data.email,
          loyaltyPoints: data.loyaltyPoints,
          loyaltyTier: data.loyaltyTier,
          walletBalance: data.walletBalance,
          totalOrders: data.totalOrders,
          totalSpent: data.totalSpent,
          preferredBranchId: data.preferredBranchId,
          preferredFulfilment: data.preferredFulfilment,
          addressesJson: data.addressesJson,
          metadata: data.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },

  async getAddresses(customerId: string) {
    return await db.select().from(customerAddresses).where(eq(customerAddresses.customerId, customerId));
  },

  async getDeviceByHash(deviceTokenHash: string) {
    const [device] = await db
      .select()
      .from(customerDevices)
      .where(eq(customerDevices.deviceTokenHash, deviceTokenHash));
    return device;
  },

  async upsertDevicePreference(data: typeof customerDevices.$inferInsert) {
    const [device] = await db
      .insert(customerDevices)
      .values(data)
      .onConflictDoUpdate({
        target: customerDevices.deviceTokenHash,
        set: {
          customerId: data.customerId,
          preferredBranchId: data.preferredBranchId,
          preferredFulfilment: data.preferredFulfilment,
          preferredCategory: data.preferredCategory,
          consentGiven: data.consentGiven,
          isRevoked: data.isRevoked ?? false,
          lastSeenAt: new Date(),
          userAgent: data.userAgent,
          metadata: data.metadata,
          updatedAt: new Date(),
        },
      })
      .returning();
    return device;
  },

  async revokeDevice(deviceTokenHash: string) {
    return await db
      .update(customerDevices)
      .set({ isRevoked: true, consentGiven: false, updatedAt: new Date() })
      .where(eq(customerDevices.deviceTokenHash, deviceTokenHash))
      .returning();
  },

  async recordWalletTransaction(data: typeof walletTransactions.$inferInsert) {
    const [tx] = await db.insert(walletTransactions).values(data).returning();
    return tx;
  },

  async getHouseAccounts() {
    return await db.select().from(houseAccounts);
  },

  async recordHouseAccountTransaction(data: typeof houseAccountTransactions.$inferInsert) {
    const [tx] = await db.insert(houseAccountTransactions).values(data).returning();
    return tx;
  },

  async getCustomerCareTickets() {
    return await db.select().from(customerCareTickets).orderBy(desc(customerCareTickets.createdAt));
  },
};
