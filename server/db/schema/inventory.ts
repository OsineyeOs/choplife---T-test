import { pgTable, text, integer, numeric, boolean, jsonb } from 'drizzle-orm/pg-core';
import { branches, timestamps } from './organisation';
import { menuProducts } from './menu';
import { staff } from './staff';

export const inventoryItems = pgTable('inventory_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku').unique().notNull(),
  unit: text('unit').notNull(),
  category: text('category').notNull(),
  minThreshold: numeric('min_threshold').default('0').notNull(),
  costPerUnit: integer('cost_per_unit').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  currentStockJson: jsonb('current_stock_json'),
  locationStockJson: jsonb('location_stock_json'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const inventoryBalances = pgTable('inventory_balances', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  itemId: text('item_id').references(() => inventoryItems.id).notNull(),
  quantity: numeric('quantity').default('0').notNull(),
  reservedQuantity: numeric('reserved_quantity').default('0'),
  ...timestamps,
});

export const stockMovements = pgTable('stock_movements', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  itemId: text('item_id').references(() => inventoryItems.id).notNull(),
  staffId: text('staff_id').references(() => staff.id),
  type: text('type').notNull(),
  quantity: numeric('quantity').notNull(),
  previousBalance: numeric('previous_balance'),
  newBalance: numeric('new_balance'),
  unitCost: integer('unit_cost').default(0),
  reason: text('reason'),
  referenceId: text('reference_id'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const recipes = pgTable('recipes', {
  id: text('id').primaryKey(),
  productId: text('product_id').references(() => menuProducts.id).notNull(),
  itemId: text('item_id').references(() => inventoryItems.id).notNull(),
  quantityRequired: numeric('quantity_required').notNull(),
  unit: text('unit'),
  ...timestamps,
});

export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  category: text('category'),
  bankDetails: jsonb('bank_details'),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const purchaseOrders = pgTable('purchase_orders', {
  id: text('id').primaryKey(),
  poNumber: text('po_number').unique().notNull(),
  supplierId: text('supplier_id').references(() => suppliers.id),
  supplierName: text('supplier_name'),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  status: text('status').default('draft').notNull(),
  totalAmount: integer('total_amount').default(0).notNull(),
  createdBy: text('created_by'),
  approvedBy: text('approved_by'),
  itemsJson: jsonb('items_json').notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const goodsReceiptNotes = pgTable('goods_receipt_notes', {
  id: text('id').primaryKey(),
  grnNumber: text('grn_number').unique().notNull(),
  purchaseOrderId: text('purchase_order_id'),
  supplierId: text('supplier_id'),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  receivedBy: text('received_by').notNull(),
  status: text('status').default('received').notNull(),
  totalValue: integer('total_value').default(0).notNull(),
  itemsJson: jsonb('items_json').notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const wastageRecords = pgTable('wastage_records', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  itemId: text('item_id').references(() => inventoryItems.id).notNull(),
  itemName: text('item_name'),
  quantity: numeric('quantity').notNull(),
  costLoss: integer('cost_loss').default(0),
  reason: text('reason').notNull(),
  reportedBy: text('reported_by').notNull(),
  approvedBy: text('approved_by'),
  status: text('status').default('approved').notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const stockCounts = pgTable('stock_counts', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  countedBy: text('counted_by').notNull(),
  approvedBy: text('approved_by'),
  status: text('status').default('submitted').notNull(),
  itemsJson: jsonb('items_json').notNull(),
  varianceSummary: jsonb('variance_summary'),
  ...timestamps,
});

export const stockAlerts = pgTable('stock_alerts', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  itemId: text('item_id').references(() => inventoryItems.id).notNull(),
  alertType: text('alert_type').notNull(),
  severity: text('severity').default('warning').notNull(),
  message: text('message').notNull(),
  isResolved: boolean('is_resolved').default(false).notNull(),
  resolvedAt: text('resolved_at'),
  ...timestamps,
});

export const productionBatches = pgTable('production_batches', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  outputItemId: text('output_item_id').notNull(),
  outputQuantity: numeric('output_quantity').notNull(),
  producedBy: text('produced_by').notNull(),
  status: text('status').default('completed').notNull(),
  inputsJson: jsonb('inputs_json').notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});
