ALTER TABLE "branches" ALTER COLUMN "address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "code" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "phone" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "whatsapp" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "city" text DEFAULT 'Benin City';--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "state" text DEFAULT 'Edo';--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "coordinates" jsonb;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "operating_hours" jsonb;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "delivery_config" jsonb;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "pickup_config" jsonb;--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint

ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "permissions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "branch_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "delivery_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"name" text NOT NULL,
	"fee" integer DEFAULT 0 NOT NULL,
	"min_order_amount" integer DEFAULT 0,
	"estimated_minutes" integer DEFAULT 45,
	"is_active" boolean DEFAULT true NOT NULL,
	"areas" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "dining_tables" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"number" text NOT NULL,
	"name" text,
	"section" text DEFAULT 'Main Hall',
	"capacity" integer DEFAULT 4 NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"guest_count" integer DEFAULT 0,
	"current_check_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "system_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"setting_key" text UNIQUE NOT NULL,
	"setting_value" jsonb NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "menu_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"icon" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "menu_products" ALTER COLUMN "base_price_kobo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_products" ALTER COLUMN "category" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_products" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "category_id" text;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "price" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "cost_price" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "sku" text;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "is_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "product_type" text DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "is_combo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "is_package" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "is_popular" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "image_url" text;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "preparation_station" text DEFAULT 'kitchen';--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "packaging_inventory_item_id" text;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "packaging_policy" jsonb;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "variants" jsonb;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "modifier_groups" jsonb;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "components" jsonb;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "recipe" jsonb;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "branch_availability" jsonb;--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "packaging_catalogue" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text UNIQUE NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"cost_price" integer DEFAULT 0,
	"capacity_portions" integer DEFAULT 4,
	"inventory_item_id" text,
	"is_default_food_pack" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "package_compositions" (
	"id" text PRIMARY KEY NOT NULL,
	"package_product_id" text NOT NULL REFERENCES "menu_products"("id"),
	"component_product_id" text,
	"component_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit" text DEFAULT 'pcs',
	"packaging_sku_id" text,
	"packaging_quantity" integer DEFAULT 1,
	"source_document" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "promotions" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text UNIQUE NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"discount_type" text DEFAULT 'percentage' NOT NULL,
	"discount_value" integer DEFAULT 0 NOT NULL,
	"min_order_amount" integer DEFAULT 0,
	"max_discount_amount" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" text,
	"expires_at" text,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"staff_id" text NOT NULL REFERENCES "staff"("id"),
	"staff_name" text,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp,
	"opening_cash" integer DEFAULT 0 NOT NULL,
	"closing_cash" integer,
	"expected_cash" integer,
	"variance" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "orders" ALTER COLUMN "total_amount_kobo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shift_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_email" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_type" text DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subtotal_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "packaging_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_fee" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax_amount" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_reference" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_address" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "packaging_approval_status" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "packaging_upgrade_details" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "source_system" text DEFAULT 'choplife_live';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "historical_record" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "items_json" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL REFERENCES "orders"("id"),
	"product_id" text NOT NULL REFERENCES "menu_products"("id"),
	"product_name" text,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"total_price" integer NOT NULL,
	"is_package" boolean DEFAULT false,
	"selected_modifiers" jsonb,
	"package_breakdown" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pos_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"shift_id" text NOT NULL REFERENCES "shifts"("id"),
	"staff_id" text NOT NULL REFERENCES "staff"("id"),
	"table_number" text,
	"table_id" text,
	"service_mode" text DEFAULT 'dine_in',
	"status" text DEFAULT 'open' NOT NULL,
	"payment_status" text DEFAULT 'unpaid',
	"subtotal_amount" integer DEFAULT 0,
	"packaging_amount" integer DEFAULT 0,
	"discount_amount" integer DEFAULT 0,
	"service_charge" integer DEFAULT 0,
	"tax_amount" integer DEFAULT 0,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"paid_amount" integer DEFAULT 0,
	"items_json" jsonb,
	"payments_json" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pos_check_items" (
	"id" text PRIMARY KEY NOT NULL,
	"check_id" text NOT NULL REFERENCES "pos_checks"("id"),
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"total_price" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"void_reason" text,
	"voided_by" text,
	"modifiers_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "cash_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"shift_id" text REFERENCES "shifts"("id"),
	"staff_id" text,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"approved_by" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "held_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"staff_id" text,
	"label" text NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "reconciliations" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"shift_id" text,
	"date" text NOT NULL,
	"expected_total" integer DEFAULT 0 NOT NULL,
	"actual_total" integer DEFAULT 0 NOT NULL,
	"variance" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"reconciled_by" text,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payment_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text UNIQUE NOT NULL,
	"order_id" text,
	"check_id" text,
	"branch_id" text,
	"provider" text DEFAULT 'paystack' NOT NULL,
	"method" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verified_at" timestamp,
	"raw_payload" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "processed_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_key" text UNIQUE NOT NULL,
	"reference" text,
	"event_type" text NOT NULL,
	"status" text DEFAULT 'processed' NOT NULL,
	"payload_hash" text,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "min_threshold" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "cost_per_unit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "current_stock_json" jsonb;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "location_stock_json" jsonb;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint

ALTER TABLE "inventory_balances" DROP CONSTRAINT IF EXISTS "inventory_balances_inventory_item_id_inventory_items_id_fk";--> statement-breakpoint
ALTER TABLE "inventory_balances" ALTER COLUMN "inventory_item_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD COLUMN IF NOT EXISTS "item_id" text;--> statement-breakpoint
ALTER TABLE "inventory_balances" ALTER COLUMN "quantity" TYPE numeric USING quantity::numeric;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD COLUMN IF NOT EXISTS "reserved_quantity" numeric DEFAULT '0';--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "stock_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"item_id" text NOT NULL REFERENCES "inventory_items"("id"),
	"staff_id" text REFERENCES "staff"("id"),
	"type" text NOT NULL,
	"quantity" numeric NOT NULL,
	"previous_balance" numeric,
	"new_balance" numeric,
	"unit_cost" integer DEFAULT 0,
	"reason" text,
	"reference_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL REFERENCES "menu_products"("id"),
	"item_id" text NOT NULL REFERENCES "inventory_items"("id"),
	"quantity_required" numeric NOT NULL,
	"unit" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"email" text,
	"address" text,
	"category" text,
	"bank_details" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"po_number" text UNIQUE NOT NULL,
	"supplier_id" text REFERENCES "suppliers"("id"),
	"supplier_name" text,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"status" text DEFAULT 'draft' NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"approved_by" text,
	"items_json" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "goods_receipt_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"grn_number" text UNIQUE NOT NULL,
	"purchase_order_id" text,
	"supplier_id" text,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"received_by" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"total_value" integer DEFAULT 0 NOT NULL,
	"items_json" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "wastage_records" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"item_id" text NOT NULL REFERENCES "inventory_items"("id"),
	"item_name" text,
	"quantity" numeric NOT NULL,
	"cost_loss" integer DEFAULT 0,
	"reason" text NOT NULL,
	"reported_by" text NOT NULL,
	"approved_by" text,
	"status" text DEFAULT 'approved' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "stock_counts" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"counted_by" text NOT NULL,
	"approved_by" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"items_json" jsonb NOT NULL,
	"variance_summary" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "stock_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"item_id" text NOT NULL REFERENCES "inventory_items"("id"),
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "production_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"output_item_id" text NOT NULL,
	"output_quantity" numeric NOT NULL,
	"produced_by" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"inputs_json" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "journal_entries" ALTER COLUMN "total_debit_kobo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entries" ALTER COLUMN "total_credit_kobo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "branch_id" text;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "staff_id" text;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "reference" text;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'posted' NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "metadata" jsonb;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ledger_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"journal_id" text NOT NULL REFERENCES "journal_entries"("id"),
	"account_code" text NOT NULL,
	"account_name" text NOT NULL,
	"debit" integer DEFAULT 0 NOT NULL,
	"credit" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fixed_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"name" text NOT NULL,
	"category" text NOT NULL,
	"purchase_date" timestamp NOT NULL,
	"purchase_cost" integer NOT NULL,
	"current_value" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "expense_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"staff_id" text NOT NULL,
	"staff_name" text,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"attachments_json" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payrolls" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text,
	"period" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_gross" integer DEFAULT 0 NOT NULL,
	"total_deductions" integer DEFAULT 0 NOT NULL,
	"total_net" integer DEFAULT 0 NOT NULL,
	"prepared_by" text,
	"approved_by" text,
	"lines_json" jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "capex_requisitions" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"title" text NOT NULL,
	"justification" text,
	"estimated_cost" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" text NOT NULL,
	"approved_by" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "supplier_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_number" text NOT NULL,
	"supplier_id" text NOT NULL,
	"supplier_name" text,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"grn_id" text,
	"total_amount" integer NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'unpaid' NOT NULL,
	"due_date" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "expenditure_budgets" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text,
	"category" text NOT NULL,
	"period" text NOT NULL,
	"allocated_amount" integer NOT NULL,
	"spent_amount" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text UNIQUE NOT NULL,
	"email" text,
	"loyalty_points" integer DEFAULT 0 NOT NULL,
	"loyalty_tier" text DEFAULT 'Bronze' NOT NULL,
	"wallet_balance" integer DEFAULT 0 NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"preferred_branch_id" text,
	"preferred_fulfilment" text,
	"addresses_json" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL REFERENCES "customers"("id"),
	"label" text DEFAULT 'Home' NOT NULL,
	"address_line" text NOT NULL,
	"landmark" text,
	"city" text DEFAULT 'Benin City',
	"branch_id" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"device_token_hash" text UNIQUE NOT NULL,
	"customer_id" text REFERENCES "customers"("id"),
	"preferred_branch_id" text,
	"preferred_fulfilment" text DEFAULT 'delivery',
	"preferred_category" text,
	"consent_given" boolean DEFAULT true NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"user_agent" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "wallet_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL REFERENCES "customers"("id"),
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reference" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "house_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"email" text,
	"credit_limit" integer DEFAULT 0 NOT NULL,
	"current_balance" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "house_account_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"house_account_id" text NOT NULL REFERENCES "house_accounts"("id"),
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"reference_id" text,
	"recorded_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text,
	"customer_id" text,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"branch_id" text NOT NULL,
	"order_type" text DEFAULT 'delivery' NOT NULL,
	"product_rating" integer,
	"product_tags" jsonb,
	"delivery_rating" integer,
	"delivery_tags" jsonb,
	"service_rating" integer,
	"service_tags" jsonb,
	"overall_rating" integer NOT NULL,
	"comment" text,
	"verified_purchase" boolean DEFAULT true NOT NULL,
	"is_public_display_name" boolean DEFAULT true NOT NULL,
	"moderation_status" text DEFAULT 'approved' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "customer_care_tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_number" text UNIQUE NOT NULL,
	"customer_id" text,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"order_id" text,
	"branch_id" text,
	"category" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"subject" text NOT NULL,
	"description" text NOT NULL,
	"resolution_notes" text,
	"assigned_to" text,
	"messages_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "riders" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"vehicle_type" text DEFAULT 'motorcycle',
	"plate_number" text,
	"status" text DEFAULT 'available' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "delivery_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"rider_id" text REFERENCES "riders"("id"),
	"rider_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"delivery_address" text NOT NULL,
	"delivery_fee" integer DEFAULT 0 NOT NULL,
	"dispatched_at" timestamp,
	"delivered_at" timestamp,
	"proof_of_delivery" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"recipient" text NOT NULL,
	"template_key" text,
	"subject" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"reference_id" text,
	"provider_response" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "printers" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"name" text NOT NULL,
	"station" text NOT NULL,
	"connection_type" text DEFAULT 'network' NOT NULL,
	"ip_address" text,
	"port" integer DEFAULT 9100,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "receipt_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text,
	"name" text NOT NULL,
	"header_text" text,
	"footer_text" text,
	"show_logo" boolean DEFAULT true,
	"config_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "print_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"printer_id" text,
	"station" text NOT NULL,
	"document_type" text NOT NULL,
	"reference_id" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "catering_events" (
	"id" text PRIMARY KEY NOT NULL,
	"branch_id" text NOT NULL REFERENCES "branches"("id"),
	"client_name" text NOT NULL,
	"client_phone" text NOT NULL,
	"client_email" text,
	"event_type" text NOT NULL,
	"event_date" text NOT NULL,
	"guest_count" integer NOT NULL,
	"status" text DEFAULT 'inquiry' NOT NULL,
	"total_quote_amount" integer DEFAULT 0 NOT NULL,
	"deposit_paid" integer DEFAULT 0 NOT NULL,
	"packages_json" jsonb,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "migration_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"source_system" text NOT NULL,
	"report_type" text NOT NULL,
	"file_name" text NOT NULL,
	"checksum" text UNIQUE NOT NULL,
	"branch_id" text,
	"status" text DEFAULT 'staged' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"rejected_rows" integer DEFAULT 0 NOT NULL,
	"imported_by" text,
	"committed_at" timestamp,
	"rolled_back_at" timestamp,
	"summary_json" jsonb,
	"errors_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "historical_ezee_records" (
	"id" text PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL REFERENCES "migration_batches"("id"),
	"source_system" text DEFAULT 'ezee_optimus' NOT NULL,
	"report_type" text NOT NULL,
	"branch_id" text NOT NULL,
	"external_reference_id" text NOT NULL,
	"business_date" text,
	"item_name" text,
	"mapped_product_id" text,
	"quantity" integer DEFAULT 0,
	"gross_amount" integer DEFAULT 0,
	"discount_amount" integer DEFAULT 0,
	"tax_amount" integer DEFAULT 0,
	"net_amount" integer DEFAULT 0,
	"historical_record" boolean DEFAULT true NOT NULL,
	"raw_row_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
