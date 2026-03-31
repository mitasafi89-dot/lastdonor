ALTER TYPE "public"."milestone_status" ADD VALUE 'reached' BEFORE 'evidence_submitted';--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "veriff_session_id" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "veriff_session_url" text;