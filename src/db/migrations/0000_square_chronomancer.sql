CREATE TYPE "public"."audit_severity" AS ENUM('info', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "public"."blog_category" AS ENUM('campaign_story', 'impact_report', 'news');--> statement-breakpoint
CREATE TYPE "public"."campaign_category" AS ENUM('medical', 'disaster', 'military', 'veterans', 'memorial', 'first-responders', 'community', 'essential-needs');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'last_donor_zone', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."donation_phase" AS ENUM('first_believers', 'the_push', 'closing_in', 'last_donor_zone');--> statement-breakpoint
CREATE TYPE "public"."donation_source" AS ENUM('real', 'seed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('donor', 'editor', 'admin');--> statement-breakpoint
CREATE TABLE "accounts" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"actor_id" uuid,
	"actor_role" "user_role",
	"actor_ip" text,
	"target_type" text,
	"target_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb,
	"severity" "audit_severity" DEFAULT 'info' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"body_html" text NOT NULL,
	"excerpt" text,
	"cover_image_url" text,
	"author_name" text NOT NULL,
	"author_bio" text,
	"category" "blog_category" NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "campaign_seed_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"message" text NOT NULL,
	"persona" text,
	"phase" "donation_phase" NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body_html" text NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"hero_image_url" text NOT NULL,
	"photo_credit" text,
	"story_html" text NOT NULL,
	"goal_amount" integer NOT NULL,
	"raised_amount" integer DEFAULT 0 NOT NULL,
	"donor_count" integer DEFAULT 0 NOT NULL,
	"category" "campaign_category" NOT NULL,
	"location" text,
	"subject_name" text NOT NULL,
	"subject_hometown" text,
	"impact_tiers" jsonb DEFAULT '[]'::jsonb,
	"source" text DEFAULT 'manual',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"last_donor_id" uuid,
	CONSTRAINT "campaigns_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "donations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid,
	"stripe_payment_id" text NOT NULL,
	"amount" integer NOT NULL,
	"donor_name" text NOT NULL,
	"donor_email" text NOT NULL,
	"donor_location" text,
	"message" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"phase_at_time" "donation_phase" NOT NULL,
	"source" "donation_source" DEFAULT 'real' NOT NULL,
	"refunded" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "donations_amount_check" CHECK ("donations"."amount" >= 500)
);
--> statement-breakpoint
CREATE TABLE "news_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"summary" text,
	"category" "campaign_category",
	"relevance_score" integer,
	"campaign_created" boolean DEFAULT false NOT NULL,
	"campaign_id" uuid,
	"published_at" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "news_items_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"source" text,
	CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"password_hash" text,
	"name" text,
	"image" text,
	"location" text,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'donor' NOT NULL,
	"total_donated" integer DEFAULT 0 NOT NULL,
	"campaigns_supported" integer DEFAULT 0 NOT NULL,
	"last_donor_count" integer DEFAULT 0 NOT NULL,
	"badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_seed_messages" ADD CONSTRAINT "campaign_seed_messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_updates" ADD CONSTRAINT "campaign_updates_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_last_donor_id_users_id_fk" FOREIGN KEY ("last_donor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_items" ADD CONSTRAINT "news_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_logs_event_type" ON "audit_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_timestamp" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_actor_id" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_blog_posts_published" ON "blog_posts" USING btree ("published","published_at");--> statement-breakpoint
CREATE INDEX "idx_seed_messages_campaign_used" ON "campaign_seed_messages" USING btree ("campaign_id","used");--> statement-breakpoint
CREATE INDEX "idx_campaigns_status" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaigns_category" ON "campaigns" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_campaigns_status_category" ON "campaigns" USING btree ("status","category");--> statement-breakpoint
CREATE INDEX "idx_campaigns_published_at" ON "campaigns" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_donations_campaign_id" ON "donations" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_donations_user_id" ON "donations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_donations_created_at" ON "donations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_donations_stripe_payment_id" ON "donations" USING btree ("stripe_payment_id");--> statement-breakpoint
CREATE INDEX "idx_news_items_fetched_at" ON "news_items" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "idx_news_items_campaign_created" ON "news_items" USING btree ("campaign_created");