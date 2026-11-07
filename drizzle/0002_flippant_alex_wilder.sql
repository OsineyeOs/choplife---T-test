CREATE TABLE "journal_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"date" timestamp NOT NULL,
	"description" text NOT NULL,
	"total_debit_kobo" integer NOT NULL,
	"total_credit_kobo" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text,
	"action" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cms_content" (
	"id" text PRIMARY KEY NOT NULL,
	"section" text NOT NULL,
	"content" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
