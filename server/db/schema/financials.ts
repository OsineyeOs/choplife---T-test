import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { branches, timestamps } from './organisation';
import { staff } from './staff';

export const journalEntries = pgTable('journal_entries', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  staffId: text('staff_id').references(() => staff.id),
  date: timestamp('date').defaultNow().notNull(),
  description: text('description').notNull(),
  reference: text('reference'),
  status: text('status').default('posted').notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const ledgerLines = pgTable('ledger_lines', {
  id: text('id').primaryKey(),
  journalId: text('journal_id').references(() => journalEntries.id).notNull(),
  accountCode: text('account_code').notNull(),
  accountName: text('account_name').notNull(),
  debit: integer('debit').default(0).notNull(),
  credit: integer('credit').default(0).notNull(),
  ...timestamps,
});

export const fixedAssets = pgTable('fixed_assets', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  purchaseDate: timestamp('purchase_date').notNull(),
  purchaseCost: integer('purchase_cost').notNull(),
  currentValue: integer('current_value').notNull(),
  status: text('status').default('active').notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const expenseClaims = pgTable('expense_claims', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  staffId: text('staff_id').notNull(),
  staffName: text('staff_name'),
  category: text('category').notNull(),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  status: text('status').default('pending').notNull(),
  approvedBy: text('approved_by'),
  attachmentsJson: jsonb('attachments_json'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const payrolls = pgTable('payrolls', {
  id: text('id').primaryKey(),
  branchId: text('branch_id'),
  period: text('period').notNull(),
  status: text('status').default('draft').notNull(),
  totalGross: integer('total_gross').default(0).notNull(),
  totalDeductions: integer('total_deductions').default(0).notNull(),
  totalNet: integer('total_net').default(0).notNull(),
  preparedBy: text('prepared_by'),
  approvedBy: text('approved_by'),
  linesJson: jsonb('lines_json').notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const capexRequisitions = pgTable('capex_requisitions', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  title: text('title').notNull(),
  justification: text('justification'),
  estimatedCost: integer('estimated_cost').notNull(),
  status: text('status').default('pending').notNull(),
  requestedBy: text('requested_by').notNull(),
  approvedBy: text('approved_by'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const supplierInvoices = pgTable('supplier_invoices', {
  id: text('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull(),
  supplierId: text('supplier_id').notNull(),
  supplierName: text('supplier_name'),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  grnId: text('grn_id'),
  totalAmount: integer('total_amount').notNull(),
  paidAmount: integer('paid_amount').default(0).notNull(),
  status: text('status').default('unpaid').notNull(),
  dueDate: text('due_date'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const expenditureBudgets = pgTable('expenditure_budgets', {
  id: text('id').primaryKey(),
  branchId: text('branch_id'),
  category: text('category').notNull(),
  period: text('period').notNull(),
  allocatedAmount: integer('allocated_amount').notNull(),
  spentAmount: integer('spent_amount').default(0).notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});
