import { db } from '../db/db';
import {
  journalEntries,
  ledgerLines,
  fixedAssets,
  expenseClaims,
  payrolls,
  capexRequisitions,
  supplierInvoices,
  expenditureBudgets,
} from '../db/schema/financials';
import { eq, desc } from 'drizzle-orm';

export const accountingRepository = {
  async getJournalEntries(branchId?: string) {
    if (branchId) {
      return await db.select().from(journalEntries).where(eq(journalEntries.branchId, branchId)).orderBy(desc(journalEntries.date));
    }
    return await db.select().from(journalEntries).orderBy(desc(journalEntries.date));
  },

  async getLedgerLines(journalId: string) {
    return await db.select().from(ledgerLines).where(eq(ledgerLines.journalId, journalId));
  },

  async getFixedAssets() {
    return await db.select().from(fixedAssets);
  },

  async getExpenseClaims() {
    return await db.select().from(expenseClaims);
  },

  async getPayrolls() {
    return await db.select().from(payrolls);
  },

  async getCapexRequisitions() {
    return await db.select().from(capexRequisitions);
  },

  async getSupplierInvoices() {
    return await db.select().from(supplierInvoices);
  },

  async getExpenditureBudgets() {
    return await db.select().from(expenditureBudgets);
  },
};
