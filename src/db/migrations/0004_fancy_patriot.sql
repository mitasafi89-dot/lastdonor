CREATE TYPE "public"."donor_type" AS ENUM('individual', 'corporate', 'foundation');--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('email', 'call', 'meeting', 'note');--> statement-breakpoint
CREATE TABLE "donor_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_id" uuid NOT NULL,
	"related_donor_id" uuid,
	"organization_name" text,
	"relationship_type" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interaction_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"donor_id" uuid NOT NULL,
	"staff_id" uuid,
	"type" "interaction_type" NOT NULL,
	"subject" text NOT NULL,
	"body" text,
	"contacted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "donor_type" "donor_type" DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "organization_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_donation_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "donor_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "donor_relationships" ADD CONSTRAINT "donor_relationships_donor_id_users_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donor_relationships" ADD CONSTRAINT "donor_relationships_related_donor_id_users_id_fk" FOREIGN KEY ("related_donor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_donor_id_users_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_staff_id_users_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_donor_relationships_donor_id" ON "donor_relationships" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "idx_donor_relationships_related_id" ON "donor_relationships" USING btree ("related_donor_id");--> statement-breakpoint
CREATE INDEX "idx_interaction_logs_donor_id" ON "interaction_logs" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "idx_interaction_logs_staff_id" ON "interaction_logs" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "idx_interaction_logs_contacted_at" ON "interaction_logs" USING btree ("contacted_at");--> statement-breakpoint
CREATE INDEX "idx_users_donor_score" ON "users" USING btree ("donor_score");--> statement-breakpoint
CREATE INDEX "idx_users_donor_type" ON "users" USING btree ("donor_type");--> statement-breakpoint
CREATE INDEX "idx_users_last_donation_at" ON "users" USING btree ("last_donation_at");--> statement-breakpoint
CREATE INDEX "idx_users_total_donated" ON "users" USING btree ("total_donated");