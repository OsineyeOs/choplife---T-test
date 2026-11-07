import { pgTable, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { timestamps } from './organisation';

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').unique().notNull(),
  email: text('email'),
  loyaltyPoints: integer('loyalty_points').default(0).notNull(),
  loyaltyTier: text('loyalty_tier').default('Bronze').notNull(),
  walletBalance: integer('wallet_balance').default(0).notNull(),
  totalOrders: integer('total_orders').default(0).notNull(),
  totalSpent: integer('total_spent').default(0).notNull(),
  preferredBranchId: text('preferred_branch_id'),
  preferredFulfilment: text('preferred_fulfilment'),
  addressesJson: jsonb('addresses_json'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const customerAddresses = pgTable('customer_addresses', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').references(() => customers.id).notNull(),
  label: text('label').default('Home').notNull(),
  addressLine: text('address_line').notNull(),
  landmark: text('landmark'),
  city: text('city').default('Benin City'),
  branchId: text('branch_id'),
  isDefault: boolean('is_default').default(false).notNull(),
  ...timestamps,
});

export const customerDevices = pgTable('customer_devices', {
  id: text('id').primaryKey(),
  deviceTokenHash: text('device_token_hash').unique().notNull(),
  customerId: text('customer_id').references(() => customers.id),
  preferredBranchId: text('preferred_branch_id'),
  preferredFulfilment: text('preferred_fulfilment').default('delivery'),
  preferredCategory: text('preferred_category'),
  consentGiven: boolean('consent_given').default(true).notNull(),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const walletTransactions = pgTable('wallet_transactions', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').references(() => customers.id).notNull(),
  type: text('type').notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  reference: text('reference'),
  description: text('description'),
  ...timestamps,
});

export const houseAccounts = pgTable('house_accounts', {
  id: text('id').primaryKey(),
  accountName: text('account_name').notNull(),
  contactName: text('contact_name'),
  phone: text('phone'),
  email: text('email'),
  creditLimit: integer('credit_limit').default(0).notNull(),
  currentBalance: integer('current_balance').default(0).notNull(),
  status: text('status').default('active').notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const houseAccountTransactions = pgTable('house_account_transactions', {
  id: text('id').primaryKey(),
  houseAccountId: text('house_account_id').references(() => houseAccounts.id).notNull(),
  type: text('type').notNull(),
  amount: integer('amount').notNull(),
  referenceId: text('reference_id'),
  recordedBy: text('recorded_by'),
  notes: text('notes'),
  ...timestamps,
});

export const customerReviews = pgTable('customer_reviews', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  productId: text('product_id'),
  customerId: text('customer_id'),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone'),
  branchId: text('branch_id').notNull(),
  orderType: text('order_type').default('delivery').notNull(),
  productRating: integer('product_rating'),
  productTags: jsonb('product_tags'),
  deliveryRating: integer('delivery_rating'),
  deliveryTags: jsonb('delivery_tags'),
  serviceRating: integer('service_rating'),
  serviceTags: jsonb('service_tags'),
  overallRating: integer('overall_rating').notNull(),
  comment: text('comment'),
  verifiedPurchase: boolean('verified_purchase').default(true).notNull(),
  isPublicDisplayName: boolean('is_public_display_name').default(true).notNull(),
  moderationStatus: text('moderation_status').default('approved').notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const customerCareTickets = pgTable('customer_care_tickets', {
  id: text('id').primaryKey(),
  ticketNumber: text('ticket_number').unique().notNull(),
  customerId: text('customer_id'),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  orderId: text('order_id'),
  branchId: text('branch_id'),
  category: text('category').notNull(),
  priority: text('priority').default('medium').notNull(),
  status: text('status').default('open').notNull(),
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  resolutionNotes: text('resolution_notes'),
  assignedTo: text('assigned_to'),
  messagesJson: jsonb('messages_json'),
  ...timestamps,
});
