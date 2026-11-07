ALTER TABLE "staff" DROP CONSTRAINT "staff_email_unique";--> statement-breakpoint
ALTER TABLE "staff" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ALTER COLUMN "work_email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ALTER COLUMN "phone" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "staff_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "allowed_branch_ids" jsonb;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "custom_privileges" jsonb;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "salt" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "must_change_password" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "lockout_until" timestamp;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "last_login_ip" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "guarantor_phone" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "guarantor_relationship" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "guarantor_address" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "guarantor_workplace" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "staff_name" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "staff_role" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD COLUMN "used" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "role" text NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "branch_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_activity" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "is_system" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "privileges" jsonb;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "reports" jsonb;--> statement-breakpoint
ALTER TABLE "roles" ADD COLUMN "order_summary_columns" jsonb;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_staff_id_unique" UNIQUE("staff_id");--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token");--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_token_unique" UNIQUE("token");--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_code_unique" UNIQUE("code");