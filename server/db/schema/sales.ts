import { pgTable, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { branches, timestamps } from './organisation';
import { staff } from './staff';
import { menuProducts } from './menu';

export const shifts = pgTable('shifts', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  staffId: text('staff_id').references(() => staff.id).notNull(),
  staffName: text('staff_name'),
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  openingCash: integer('opening_cash').default(0).notNull(),
  closingCash: integer('closing_cash'),
  expectedCash: integer('expected_cash'),
  variance: integer('variance'),
  status: text('status').default('open').notNull(),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  shiftId: text('shift_id').references(() => shifts.id),
  customerName: text('customer_name'),
  customerPhone: text('customer_phone'),
  customerEmail: text('customer_email'),
  customerId: text('customer_id'),
  orderType: text('order_type').notNull(),
  status: text('status').default('pending').notNull(),
  subtotalAmount: integer('subtotal_amount').default(0),
  packagingAmount: integer('packaging_amount').default(0),
  deliveryFee: integer('delivery_fee').default(0),
  discountAmount: integer('discount_amount').default(0),
  taxAmount: integer('tax_amount').default(0),
  totalAmount: integer('total_amount').notNull(),
  paymentStatus: text('payment_status').default('unpaid').notNull(),
  paymentMethod: text('payment_method'),
  paymentReference: text('payment_reference'),
  deliveryAddress: text('delivery_address'),
  packagingApprovalStatus: text('packaging_approval_status'),
  packagingUpgradeDetails: jsonb('packaging_upgrade_details'),
  sourceSystem: text('source_system').default('choplife_live'),
  historicalRecord: boolean('historical_record').default(false),
  itemsJson: jsonb('items_json'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey(),
  orderId: text('order_id').references(() => orders.id).notNull(),
  productId: text('product_id').references(() => menuProducts.id).notNull(),
  productName: text('product_name'),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  totalPrice: integer('total_price').notNull(),
  isPackage: boolean('is_package').default(false),
  selectedModifiers: jsonb('selected_modifiers'),
  packageBreakdown: jsonb('package_breakdown'),
  notes: text('notes'),
  ...timestamps,
});

export const posChecks = pgTable('pos_checks', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  shiftId: text('shift_id').references(() => shifts.id).notNull(),
  staffId: text('staff_id').references(() => staff.id).notNull(),
  tableNumber: text('table_number'),
  tableId: text('table_id'),
  serviceMode: text('service_mode').default('dine_in'),
  status: text('status').default('open').notNull(),
  paymentStatus: text('payment_status').default('unpaid'),
  subtotalAmount: integer('subtotal_amount').default(0),
  packagingAmount: integer('packaging_amount').default(0),
  discountAmount: integer('discount_amount').default(0),
  serviceCharge: integer('service_charge').default(0),
  taxAmount: integer('tax_amount').default(0),
  totalAmount: integer('total_amount').default(0).notNull(),
  paidAmount: integer('paid_amount').default(0),
  itemsJson: jsonb('items_json'),
  paymentsJson: jsonb('payments_json'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const posCheckItems = pgTable('pos_check_items', {
  id: text('id').primaryKey(),
  checkId: text('check_id').references(() => posChecks.id).notNull(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: integer('unit_price').notNull().default(0),
  totalPrice: integer('total_price').notNull().default(0),
  status: text('status').default('active').notNull(),
  voidReason: text('void_reason'),
  voidedBy: text('voided_by'),
  modifiersJson: jsonb('modifiers_json'),
  ...timestamps,
});

export const cashMovements = pgTable('cash_movements', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  shiftId: text('shift_id').references(() => shifts.id),
  staffId: text('staff_id'),
  type: text('type').notNull(),
  amount: integer('amount').notNull(),
  reason: text('reason').notNull(),
  approvedBy: text('approved_by'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const heldTickets = pgTable('held_tickets', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  staffId: text('staff_id'),
  label: text('label').notNull(),
  status: text('status').default('held').notNull(),
  payload: jsonb('payload').notNull(),
  ...timestamps,
});

export const reconciliations = pgTable('reconciliations', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  shiftId: text('shift_id'),
  date: text('date').notNull(),
  expectedTotal: integer('expected_total').default(0).notNull(),
  actualTotal: integer('actual_total').default(0).notNull(),
  variance: integer('variance').default(0).notNull(),
  status: text('status').default('completed').notNull(),
  reconciledBy: text('reconciled_by'),
  details: jsonb('details'),
  ...timestamps,
});

export const paymentTransactions = pgTable('payment_transactions', {
  id: text('id').primaryKey(),
  reference: text('reference').unique().notNull(),
  orderId: text('order_id'),
  checkId: text('check_id'),
  branchId: text('branch_id'),
  provider: text('provider').default('paystack').notNull(),
  method: text('method').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').default('NGN').notNull(),
  status: text('status').default('pending').notNull(),
  verifiedAt: timestamp('verified_at'),
  rawPayload: jsonb('raw_payload'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const processedWebhookEvents = pgTable('processed_webhook_events', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  eventKey: text('event_key').unique().notNull(),
  reference: text('reference'),
  eventType: text('event_type').notNull(),
  status: text('status').default('processed').notNull(),
  payloadHash: text('payload_hash'),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
  ...timestamps,
});
