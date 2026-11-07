import { pgTable, text, boolean, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

export const timestamps = {
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
};

export const branches = pgTable('branches', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').unique().notNull(),
  address: text('address'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  email: text('email'),
  city: text('city').default('Benin City'),
  state: text('state').default('Edo'),
  coordinates: jsonb('coordinates'),
  operatingHours: jsonb('operating_hours'),
  deliveryConfig: jsonb('delivery_config'),
  pickupConfig: jsonb('pickup_config'),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const branchSettings = pgTable('branch_settings', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  settingKey: text('setting_key').notNull(),
  settingValue: text('setting_value').notNull(),
  ...timestamps,
});

export const deliveryZones = pgTable('delivery_zones', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  name: text('name').notNull(),
  fee: integer('fee').notNull().default(0),
  minOrderAmount: integer('min_order_amount').default(0),
  estimatedMinutes: integer('estimated_minutes').default(45),
  isActive: boolean('is_active').default(true).notNull(),
  areas: jsonb('areas'),
  ...timestamps,
});

export const diningTables = pgTable('dining_tables', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  number: text('number').notNull(),
  name: text('name'),
  section: text('section').default('Main Hall'),
  capacity: integer('capacity').default(4).notNull(),
  status: text('status').default('available').notNull(),
  guestCount: integer('guest_count').default(0),
  currentCheckId: text('current_check_id'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const systemSettings = pgTable('system_settings', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  settingKey: text('setting_key').unique().notNull(),
  settingValue: jsonb('setting_value').notNull(),
  updatedBy: text('updated_by'),
  ...timestamps,
});
