ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "pin_hash" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "pin_salt" text;
