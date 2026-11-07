import { pgTable, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { branches, timestamps } from './organisation';

export const riders = pgTable('riders', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  vehicleType: text('vehicle_type').default('motorcycle'),
  plateNumber: text('plate_number'),
  status: text('status').default('available').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const deliveryTasks = pgTable('delivery_tasks', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  riderId: text('rider_id').references(() => riders.id),
  riderName: text('rider_name'),
  status: text('status').default('pending').notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  deliveryAddress: text('delivery_address').notNull(),
  deliveryFee: integer('delivery_fee').default(0).notNull(),
  dispatchedAt: timestamp('dispatched_at'),
  deliveredAt: timestamp('delivered_at'),
  proofOfDelivery: jsonb('proof_of_delivery'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  channel: text('channel').notNull(),
  recipient: text('recipient').notNull(),
  templateKey: text('template_key'),
  subject: text('subject'),
  body: text('body').notNull(),
  status: text('status').default('queued').notNull(),
  referenceId: text('reference_id'),
  providerResponse: jsonb('provider_response'),
  ...timestamps,
});

export const printers = pgTable('printers', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  name: text('name').notNull(),
  station: text('station').notNull(),
  connectionType: text('connection_type').default('network').notNull(),
  ipAddress: text('ip_address'),
  port: integer('port').default(9100),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const receiptTemplates = pgTable('receipt_templates', {
  id: text('id').primaryKey(),
  branchId: text('branch_id'),
  name: text('name').notNull(),
  headerText: text('header_text'),
  footerText: text('footer_text'),
  showLogo: boolean('show_logo').default(true),
  configJson: jsonb('config_json'),
  ...timestamps,
});

export const printJobs = pgTable('print_jobs', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  printerId: text('printer_id'),
  station: text('station').notNull(),
  documentType: text('document_type').notNull(),
  referenceId: text('reference_id').notNull(),
  status: text('status').default('completed').notNull(),
  payload: jsonb('payload').notNull(),
  ...timestamps,
});

export const cateringEvents = pgTable('catering_events', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone').notNull(),
  clientEmail: text('client_email'),
  eventType: text('event_type').notNull(),
  eventDate: text('event_date').notNull(),
  guestCount: integer('guest_count').notNull(),
  status: text('status').default('inquiry').notNull(),
  totalQuoteAmount: integer('total_quote_amount').default(0).notNull(),
  depositPaid: integer('deposit_paid').default(0).notNull(),
  packagesJson: jsonb('packages_json'),
  notes: text('notes'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const migrationBatches = pgTable('migration_batches', {
  id: text('id').primaryKey(),
  sourceSystem: text('source_system').notNull(),
  reportType: text('report_type').notNull(),
  fileName: text('file_name').notNull(),
  checksum: text('checksum').unique().notNull(),
  branchId: text('branch_id'),
  status: text('status').default('staged').notNull(),
  totalRows: integer('total_rows').default(0).notNull(),
  validRows: integer('valid_rows').default(0).notNull(),
  rejectedRows: integer('rejected_rows').default(0).notNull(),
  importedBy: text('imported_by'),
  committedAt: timestamp('committed_at'),
  rolledBackAt: timestamp('rolled_back_at'),
  summaryJson: jsonb('summary_json'),
  errorsJson: jsonb('errors_json'),
  ...timestamps,
});

export const historicalEzeeRecords = pgTable('historical_ezee_records', {
  id: text('id').primaryKey(),
  batchId: text('batch_id').references(() => migrationBatches.id).notNull(),
  sourceSystem: text('source_system').default('ezee_optimus').notNull(),
  reportType: text('report_type').notNull(),
  branchId: text('branch_id').notNull(),
  externalReferenceId: text('external_reference_id').notNull(),
  businessDate: text('business_date'),
  itemName: text('item_name'),
  mappedProductId: text('mapped_product_id'),
  quantity: integer('quantity').default(0),
  grossAmount: integer('gross_amount').default(0),
  discountAmount: integer('discount_amount').default(0),
  taxAmount: integer('tax_amount').default(0),
  netAmount: integer('net_amount').default(0),
  historicalRecord: boolean('historical_record').default(true).notNull(),
  rawRowJson: jsonb('raw_row_json').notNull(),
  ...timestamps,
});
