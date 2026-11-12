ALTER TYPE "public"."income_source" ADD VALUE 'Loan';--> statement-breakpoint
ALTER TABLE "goal" ADD COLUMN "paused_at" timestamp with time zone;