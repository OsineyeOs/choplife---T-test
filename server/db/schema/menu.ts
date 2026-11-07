import { pgTable, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { timestamps } from './organisation';

export const menuCategories = pgTable('menu_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  icon: text('icon'),
  ...timestamps,
});

export const menuProducts = pgTable('menu_products', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').references(() => menuCategories.id).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  price: integer('price').notNull(),
  costPrice: integer('cost_price').default(0),
  sku: text('sku').unique(),
  isAvailable: boolean('is_available').default(true).notNull(),
  status: text('status').default('active').notNull(),
  productType: text('product_type').default('single').notNull(),
  isCombo: boolean('is_combo').default(false).notNull(),
  isPackage: boolean('is_package').default(false).notNull(),
  isFeatured: boolean('is_featured').default(false),
  isPopular: boolean('is_popular').default(false),
  imageUrl: text('image_url'),
  preparationStation: text('preparation_station').default('kitchen'),
  packagingInventoryItemId: text('packaging_inventory_item_id'),
  packagingPolicy: jsonb('packaging_policy'),
  variants: jsonb('variants'),
  modifierGroups: jsonb('modifier_groups'),
  components: jsonb('components'),
  recipe: jsonb('recipe'),
  branchAvailability: jsonb('branch_availability'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const packagingCatalogue = pgTable('packaging_catalogue', {
  id: text('id').primaryKey(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  price: integer('price').notNull().default(0),
  costPrice: integer('cost_price').default(0),
  capacityPortions: integer('capacity_portions').default(4),
  inventoryItemId: text('inventory_item_id'),
  isDefaultFoodPack: boolean('is_default_food_pack').default(false),
  isActive: boolean('is_active').default(true).notNull(),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const packageCompositions = pgTable('package_compositions', {
  id: text('id').primaryKey(),
  packageProductId: text('package_product_id').references(() => menuProducts.id).notNull(),
  componentProductId: text('component_product_id'),
  componentName: text('component_name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unit: text('unit').default('pcs'),
  packagingSkuId: text('packaging_sku_id'),
  packagingQuantity: integer('packaging_quantity').default(1),
  sourceDocument: text('source_document'),
  metadata: jsonb('metadata'),
  ...timestamps,
});

export const promotions = pgTable('promotions', {
  id: text('id').primaryKey(),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  description: text('description'),
  discountType: text('discount_type').notNull().default('percentage'),
  discountValue: integer('discount_value').notNull().default(0),
  minOrderAmount: integer('min_order_amount').default(0),
  maxDiscountAmount: integer('max_discount_amount'),
  isActive: boolean('is_active').default(true).notNull(),
  startsAt: text('starts_at'),
  expiresAt: text('expires_at'),
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').default(0),
  metadata: jsonb('metadata'),
  ...timestamps,
});
